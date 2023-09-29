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
  categories: string[]
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
    const cachedReputationString = await this.reputationCache.getItem(url)

    if (cachedReputationString) {
      // Try to parse the cached string into an object
      try {
        const cachedReputation = JSON.parse(
          cachedReputationString,
        ) as SiteReputation
        return cachedReputation
      } catch (error) {
        // Handle potential JSON parsing errors, logging them
        console.error('Error parsing cached reputation:', error)
      }
    }

    const response = await this.apiClient.getSiteReputation(url)

    // Filter out undefined values from response.categories
    const categories = (response.categories ?? []).filter(
      (category): category is string => category !== undefined,
    )

    const reputation: SiteReputation = {
      reputationStatus: response.reputationStatus,
      categories: categories,
    }

    // When caching, convert the SiteReputation object back to a string
    await this.reputationCache.setItem(url, JSON.stringify(reputation))

    return reputation
  }

  /**
   * Clears all local site reputation cached data
   */
  public async reset(): Promise<void> {
    await this.reputationCache.clear()
  }
}
