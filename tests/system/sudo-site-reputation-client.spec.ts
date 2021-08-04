import {
  SudoSiteReputationClient,
  SudoSiteReputationClientProps,
} from '../../lib'
import {
  DefaultRulesetProvider,
  DefaultRulesetProviderProps,
} from '../../lib/default-ruleset-provider'
import { MemoryStorageProvider } from '../../lib/memory-storage-provider'
import { RulesetProvider } from '../../lib/ruleset-provider'
import { StorageProvider } from '../../lib/storage-provider'
import {
  Status,
  lastUpdatePerformedAtStorageKey,
  rulesetStorageKey,
} from '../../lib/sudo-site-reputation-client'
import { registerUser, sdkConfig } from './test-registration'

let storageProvider: StorageProvider
let testProps: SudoSiteReputationClientProps
let rulesetProviderTestProps: DefaultRulesetProviderProps
let rulesetProvider: RulesetProvider
beforeAll(async () => {
  const services = await registerUser()
  rulesetProviderTestProps = {
    userClient: services.userClient,
    poolId: sdkConfig.identityService.poolId,
    identityPoolId: sdkConfig.identityService.identityPoolId,
    bucket: sdkConfig.siteReputationService.bucket,
    bucketRegion: sdkConfig.siteReputationService.region,
  }
  rulesetProvider = new DefaultRulesetProvider(rulesetProviderTestProps)
  storageProvider = new MemoryStorageProvider()
  testProps = {
    sudoUserClient: services.userClient,
    storageProvider,
    rulesetProvider,
  }
})

beforeEach(() => storageProvider.clear())

describe('SudoSiteReputationClient', () => {
  describe('getSiteReputation()', () => {
    it.each`
      domain                     | expected
      ${'www.example.com'}       | ${false}
      ${'8.8.8.8'}               | ${false}
      ${'federation.org'}        | ${false}
      ${'vulcan.federation.org'} | ${false}
    `('should return false for safe sites', async ({ domain, expected }) => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      await siteReputationClient.update()
      const siteReputationData = await siteReputationClient.getSiteReputation(
        domain,
      )

      expect(siteReputationData.isMalicious).toBe(expected)
    })

    it('should return true for malicious sites', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      const rulesetContent = await rulesetProvider.downloadRuleset()

      if (rulesetContent === 'not-modified') fail()

      // Use 5 domains from ruleset for test
      const maliciousDomains = rulesetContent.data
        .split('\n')
        .filter((d) => !!d && !d.startsWith('#'))
        .map((d) => d.trim())
        .slice(0, 5)

      await siteReputationClient.update()
      const siteReputationDatas = await Promise.all(
        maliciousDomains.map((md) =>
          siteReputationClient.getSiteReputation(md),
        ),
      )

      expect(siteReputationDatas.every((srd) => srd.isMalicious)).toBe(true)
    })

    it('should throw if no ruleset list', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      const promise = siteReputationClient.getSiteReputation('federation.com')

      await expect(promise).rejects.toThrow(
        'Reputation data is not present. Call `update` to obtain the latest reputation data.',
      )
      expect(siteReputationClient.status).toBe(Status.NeedUpdate)
    })
  })

  describe('update()', () => {
    it('should update the ruleset', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)
      const promise = siteReputationClient.getSiteReputation('federation.com')

      await expect(promise).rejects.toThrow(
        'Reputation data is not present. Call `update` to obtain the latest reputation data.',
      )

      await siteReputationClient.update()
      const siteReputationData = await siteReputationClient.getSiteReputation(
        'federation.com',
      )
      expect(siteReputationData.isMalicious).toBe(false)

      // New client should be able to access same ruleset list without update
      const siteReputationClient2 = new SudoSiteReputationClient(testProps)
      const siteReputationData2 = await siteReputationClient2.getSiteReputation(
        'federation.com',
      )
      expect(siteReputationData2.isMalicious).toBe(false)
    })
  })

  describe('getMaliciousSites', () => {
    it('should return full malicious sites list', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)
      await siteReputationClient.update()

      const sites = await siteReputationClient.getMaliciousSites()
      expect(sites.length).toBeGreaterThan(0)
    })
  })

  describe('clearStorage()', () => {
    it('should clear all stored data', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      await siteReputationClient.update()
      await siteReputationClient.getSiteReputation('www.domain.com')

      const rulesetDataBeforeClear = await storageProvider.getItem(
        rulesetStorageKey,
      )
      const lastUpdateBeforeClear = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )
      expect(JSON.parse(rulesetDataBeforeClear ?? '').cacheKey).toBeTruthy()
      expect(JSON.parse(rulesetDataBeforeClear ?? '').data).toBeTruthy()
      expect(lastUpdateBeforeClear).toBeTruthy()

      await siteReputationClient.clearStorage()

      const rulesetDataAfterClear = await storageProvider.getItem(
        rulesetStorageKey,
      )
      const lastUpdateAfterClear = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )
      expect(rulesetDataAfterClear).toBe(undefined)
      expect(lastUpdateAfterClear).toBe(undefined)
    })
  })
})
