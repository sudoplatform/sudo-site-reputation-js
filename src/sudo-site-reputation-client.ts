import { DefaultConfigurationManager } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'

import { Config, IotsConfig } from './config'
import { DefaultRulesetProvider } from './default-ruleset-provider'
import { ReputationDataNotPresentError } from './errors'
import { MemoryStorageProvider } from './memory-storage-provider'
import { RulesetContent, RulesetProvider } from './ruleset-provider'
import { RulesetType } from './ruleset-type'
import { StorageProvider } from './storage-provider'

export const malwareRulesetStorageKey = 'maliciousRulesetStorageKey'
export const phishingRulesetStorageKey = 'phishingRulesetStorageKey'
export const lastUpdatePerformedAtStorageKey = 'lastUpdatePerformedAtStorageKey'

export enum Status {
  /**
   * Client is (re)initializing and is not ready to process calls
   * to {@link SudoSiteReputationClient.getSiteReputation}.
   */
  Preparing = 'preparing',

  /**
   * Client is initialized and ready to process calls
   * to {@link SudoSiteReputationClient.getSiteReputation}.
   */
  Ready = 'ready',

  /**
   * There is no stored ruleset data and the client cannot
   * process calls to {@link SudoSiteReputationClient.getSiteReputation}.
   */
  NeedUpdate = 'need-update',

  /**
   * There was an error initializing the Client and cannot
   * process calls to {@link SudoSiteReputationClient.getSiteReputation}.
   */
  Error = 'error',
}

/**
 * Return type of {@link SudoSiteReputationClient.getSiteReputation}
 */
export interface SiteReputation {
  /** True if a site is malicious; false if not. */
  isMalicious: boolean
}

export interface SudoSiteReputationClientProps {
  /**
   * `SudoUserClient` instance.
   * This is required for authenticated access to the Sudo Platform.
   * @see https://docs.sudoplatform.com/guides/users/integrate-the-user-sdk#integrate-the-js-sdk
   */
  sudoUserClient: SudoUserClient

  /**
   * Sudo Platform SDK Config.
   * If not provided, then DefaultConfigurationManager will be used.
   * @see https://docs.sudoplatform.com/guides/getting-started#step-2-download-the-sdk-configuration-file
   * @see https://docs.sudoplatform.com/guides/users/integrate-the-user-sdk#sdk-configuration
   */
  config?: Config

  /**
   * A {@link StorageProvider} implementation.
   * An in-memory implementation is used by default.
   */
  storageProvider?: StorageProvider

  /**
   * @internal
   * Overrides the default ruleset provider.
   * This is used for testing purposes.
   */
  rulesetProvider?: RulesetProvider

  /**
   * Callback invoked whenever the client status
   * {@link SudoSiteReputationClient.status} changes.
   */
  onStatusChanged?: () => void
}

/**
 * This is the main class used for checking a site's reputation.
 * Each instance of `SudoSiteReputationClient` will be configured with
 * a ruleset from a ruleset provider to check a site's reputation against.
 * To determine a site's reputation, you can
 * call {@link SudoSiteReputationClient.getSiteReputation}.
 */
export class SudoSiteReputationClient {
  private _lastUpdatePerformedAt: Date | undefined
  private _status: Status = Status.Preparing
  private config: Config
  private storageProvider: StorageProvider
  private rulesetProvider: RulesetProvider
  private rulesetList!: Promise<Record<RulesetType, string[]>>

  constructor(private props: SudoSiteReputationClientProps) {
    this.config =
      props?.config ??
      DefaultConfigurationManager.getInstance().bindConfigSet(IotsConfig)

    this.storageProvider = props?.storageProvider ?? new MemoryStorageProvider()

    this.rulesetProvider =
      props?.rulesetProvider ??
      new DefaultRulesetProvider({
        userClient: props.sudoUserClient,
        poolId: this.config.identityService.poolId,
        identityPoolId: this.config.identityService.identityPoolId,
        bucket: this.config.siteReputationService.bucket,
        bucketRegion: this.config.siteReputationService.region,
      })

    this.initializeRulesetLists()
  }

  /**
   * Returns a {@link SiteReputation} with SiteReputationData.isMalicious
   * set to true if `url` is malicious; false if not.
   * @param url A full URL or domain
   */
  public async getSiteReputation(url: string): Promise<SiteReputation> {
    let domainToCheck: string

    try {
      domainToCheck = new URL(url).host
    } catch {
      try {
        domainToCheck = new URL(`https://${url}`).host
      } catch {
        domainToCheck = url
      }
    }

    const isMalicious = await this.checkIfDomainIsMalicious(domainToCheck)

    return { isMalicious }
  }

  /**
   * Returns full list of known malicious sites
   */
  public async getMaliciousSites(): Promise<string[]> {
    const rulesetList = await this.rulesetList
    return [...rulesetList.MALWARE, ...rulesetList.PHISHING]
  }

  /**
   * Updates reputation data to latest server data
   */
  public async update(): Promise<void> {
    // Cache latest data
    await this.fetchRulesetList()

    // Re-prepare, using cached data
    await this.initializeRulesetLists()
  }

  public get lastUpdatePerformedAt(): Date | undefined {
    return this._lastUpdatePerformedAt
  }

  public get status(): Status {
    return this._status
  }

  /**
   * Clears cached ruleset list and `lastUpdatePerformedAt`
   */
  public async clearStorage(): Promise<void> {
    // Clear specific cache data
    await this.storageProvider.clearItem(malwareRulesetStorageKey)
    await this.storageProvider.clearItem(phishingRulesetStorageKey)
    await this.storageProvider.clearItem(lastUpdatePerformedAtStorageKey)

    this._lastUpdatePerformedAt = undefined

    this.initializeRulesetLists()
  }

  /**
   * Retrieves ruleset list from cache and prepares client for
   * queries to {@link SudoSiteReputationClient.getSiteReputation}.
   */
  private async initializeRulesetLists(): Promise<void> {
    this.updateStatus(Status.Preparing)

    const newRulesetList = new Promise<Record<RulesetType, string[]>>(
      async (resolve, reject) => {
        try {
          const rulesetList: Record<RulesetType, string[]> = {
            [RulesetType.MALWARE]: [],
            [RulesetType.PHISHING]: [],
            [RulesetType.MALICIOUSDOMAIN]: [],
          }
          rulesetList.MALWARE = await this.getUpdatedRulesetList(
            RulesetType.MALWARE,
          )
          rulesetList.PHISHING = await this.getUpdatedRulesetList(
            RulesetType.PHISHING,
          )

          this.updateStatus(Status.Ready)
          resolve(rulesetList)
        } catch (error) {
          if (error instanceof ReputationDataNotPresentError) {
            this.updateStatus(Status.NeedUpdate)
          } else {
            this.updateStatus(Status.Error)
          }
          reject(error)
        }
      },
    )

    this.rulesetList = newRulesetList
    this.rulesetList.catch(() => undefined)
  }

  private async getUpdatedRulesetList(
    rulesetType: RulesetType,
  ): Promise<string[]> {
    return new Promise<string[]>(async (resolve, reject) => {
      try {
        let rulesetList
        const lastUpdatePerformedAt = await this.storageProvider.getItem(
          lastUpdatePerformedAtStorageKey,
        )
        let storedRulesetContent
        switch (rulesetType) {
          case RulesetType.MALWARE:
            storedRulesetContent = await this.getStoredRulesetContent(
              malwareRulesetStorageKey,
            )
            break
          case RulesetType.PHISHING:
            storedRulesetContent = await this.getStoredRulesetContent(
              phishingRulesetStorageKey,
            )
            break
          default:
            throw new Error('Ruleset type ${type} not supported')
        }

        if (!storedRulesetContent || !lastUpdatePerformedAt) {
          throw new ReputationDataNotPresentError()
        } else {
          rulesetList = this.parseRulesetData(storedRulesetContent.data)
          this._lastUpdatePerformedAt = new Date(lastUpdatePerformedAt)
        }

        resolve(rulesetList)
      } catch (error) {
        if (error instanceof ReputationDataNotPresentError) {
          this.updateStatus(Status.NeedUpdate)
        } else {
          this.updateStatus(Status.Error)
        }
        reject(error)
      }
    })
  }

  private async setLastUpdatePerformedAt(): Promise<void> {
    this._lastUpdatePerformedAt = new Date()
    return this.storageProvider.setItem(
      lastUpdatePerformedAtStorageKey,
      this._lastUpdatePerformedAt.toISOString(),
    )
  }

  private parseRulesetData(rulesetData: string): string[] {
    return rulesetData
      .split('\n')
      .filter((d) => !!d && !d.startsWith('#'))
      .map((d) => d.trim())
  }

  private updateStatus(status: Status): void {
    if (this._status !== status) {
      this._status = status
      this.props.onStatusChanged?.()
    }
  }

  /**
   * Fetches latest ruleset lists from provider and
   * updates cache.
   */
  private async fetchRulesetList(): Promise<void> {
    // First get the MALWARE list
    const storedMalwareRulesetContent = await this.getStoredRulesetContent(
      malwareRulesetStorageKey,
    )

    // Check for latest data
    const rulesetContentMalware = await this.rulesetProvider.downloadRuleset(
      RulesetType.MALWARE,
      storedMalwareRulesetContent?.cacheKey,
    )

    // Return stored ruleset if we have it cached
    if (rulesetContentMalware === 'not-modified') {
      if (!storedMalwareRulesetContent) {
        throw new Error('Unexpected: no stored MALWARE ruleset')
      }
    } else if (rulesetContentMalware.cacheKey) {
      // Cache new ruleset data
      await this.setStoredRulesetContent(
        RulesetType.MALWARE,
        rulesetContentMalware.cacheKey,
        rulesetContentMalware.data,
      )
    }

    // Then get the PHISHING list
    const storedPhishingRulesetContent = await this.getStoredRulesetContent(
      phishingRulesetStorageKey,
    )

    // Check for latest data
    const rulesetContentPhishing = await this.rulesetProvider.downloadRuleset(
      RulesetType.PHISHING,
      storedPhishingRulesetContent?.cacheKey,
    )

    // Return stored ruleset if we have it cached
    if (rulesetContentPhishing === 'not-modified') {
      if (!storedPhishingRulesetContent) {
        throw new Error('Unexpected: no stored PHISHING ruleset')
      }
    } else if (rulesetContentPhishing.cacheKey) {
      // Cache new ruleset data
      await this.setStoredRulesetContent(
        RulesetType.PHISHING,
        rulesetContentPhishing.cacheKey,
        rulesetContentPhishing.data,
      )
    }
    await this.setLastUpdatePerformedAt()
  }

  /**
   * Returns the ruleset that is stored in the cache
   */
  private async getStoredRulesetContent(
    storageKey: string,
  ): Promise<RulesetContent | undefined> {
    const storedRulesetContent = await this.storageProvider.getItem(storageKey)
    return storedRulesetContent && JSON.parse(storedRulesetContent)
  }

  private async setStoredRulesetContent(
    rulesetType: RulesetType,
    cacheKey: string,
    data: string,
  ): Promise<void> {
    let key = ''
    switch (rulesetType) {
      case RulesetType.MALICIOUSDOMAIN:
        // no-op
        break
      case RulesetType.MALWARE:
        key = malwareRulesetStorageKey
        break
      case RulesetType.PHISHING:
        key = phishingRulesetStorageKey
        break
    }
    await this.storageProvider.setItem(key, JSON.stringify({ data, cacheKey }))
  }

  private async checkIfDomainIsMalicious(domain: string): Promise<boolean> {
    const rulesetList = await this.getMaliciousSites()
    if (rulesetList.length === 0) {
      this.updateStatus(Status.NeedUpdate)
      throw new ReputationDataNotPresentError()
    }
    return rulesetList.some((d) => d === domain || domain.endsWith(`.${d}`))
  }
}
