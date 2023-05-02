import { ApiClient } from './apiClient'
import { IDBStorageProvider } from './idb-storage-provider'
import { StorageProvider } from './storage-provider'

/**
 * The state of knowledge of a site's reputation.
 */
export type ReputationStatus = 'NOTMALICIOUS' | 'MALICIOUS' | 'UNKNOWN'

/**
 * The response of a given url's site reputation.
 */
export interface SiteReputation {
  /** Returns `MALICIOUS` if malicious, `NOTMALICIOUS` if not, and `UNKNOWN` if unable to be determined. */
  reputationStatus: ReputationStatus
}

export interface SudoSiteReputationClientProps {
  /**
   * API client for interacting with the site reputation service.
   */
  apiClient?: ApiClient
  reputationCache?: StorageProvider
}

/**
 * Client that provides realtime site reputation data
 */
export class SudoSiteReputationClient {
  private apiClient: ApiClient
  private reputationCache: StorageProvider

  constructor(props: SudoSiteReputationClientProps) {
    this.apiClient = props.apiClient ?? new ApiClient()
    this.reputationCache = props.reputationCache ?? new IDBStorageProvider()
  }

  public async getSiteReputation(url: string): Promise<SiteReputation> {
    const reputationStatus = await this.reputationCache.getItem(url)
    if (reputationStatus) {
      return { reputationStatus: reputationStatus as ReputationStatus }
    }
    const response = await this.apiClient.getSiteReputation(url)
    const reputation = {
      reputationStatus: response.reputationStatus,
    }
    await this.reputationCache.setItem(url, response.reputationStatus)
    return reputation
  }

  /**
   * Clears all local site reputation cached data
   */
  public async reset(): Promise<void> {
    await this.reputationCache.clear()
  }
}
