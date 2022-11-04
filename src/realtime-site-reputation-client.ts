import { ApiClient } from './apiClient'
import { SiteReputation } from './sudo-site-reputation-client'

export interface RealtimeReputationClientProps {
  /**
   * API client for interacting with the site reputation service.
   */
  apiClient?: ApiClient
}

/**
 * Client that provides realtime site reputation data
 */
export class RealtimeReputationClient {
  private apiClient: ApiClient

  constructor(props: RealtimeReputationClientProps) {
    this.apiClient = props.apiClient ?? new ApiClient()
  }

  public async getSiteReputation(url: string): Promise<SiteReputation> {
    const reputation = await this.apiClient.getSiteReputation(url)
    // TODO: Implement a cache to speed up duplicate lookups.
    return { isMalicious: reputation.isMalicious ?? false }
  }
}
