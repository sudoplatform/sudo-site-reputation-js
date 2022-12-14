import { ApiClient } from './apiClient'

/**
 * The state of knowledge if a site is malicious.
 */
export type MaliciousState = 'malicious' | 'notMalicious' | 'unknown'

/**
 * The response of a given url's site reputation.
 */
export interface RealtimeReputation {
  /** Numerical categories the site is categorized by. */
  categories: number[]

  /** The algorithmic calculation of the confidence of the rating */
  confidence?: number

  /** Returns `malicious` if malicious,
   * `notMalicious` if not, and `unknown`
   * if unable to be determined. */
  isMalicious: MaliciousState

  /** The scope of the search */
  scope?: 'domain' | 'path'

  /** The returned result of the lookup for the site */
  status: 'success' | 'notFound'
}

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

  public async getSiteReputation(url: string): Promise<RealtimeReputation> {
    const reputation = await this.apiClient.getSiteReputation(url)
    // TODO: Implement a cache to speed up duplicate lookups.
    const malicousState =
      reputation.isMalicious === undefined
        ? 'unknown'
        : reputation.isMalicious
        ? 'malicious'
        : 'notMalicious'
    return {
      categories: reputation.categories.map((c) => Number(c)),
      confidence: reputation.confidence,
      isMalicious: malicousState,
      scope: reputation.scope === 'Domain' ? 'domain' : 'path',
      status: reputation.status === 'Success' ? 'success' : 'notFound',
    }
  }
}
