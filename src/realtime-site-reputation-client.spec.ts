import { RealtimeReputationClient } from './realtime-site-reputation-client'

const mockReputation = {
  categories: [39],
  confidence: 0.9,
  isMalicious: true,
  scope: 'Domain',
  status: 'Success',
}

const apiClient = {
  getSiteReputation: jest.fn().mockResolvedValue(mockReputation),
} as any

const client = new RealtimeReputationClient({ apiClient })

describe('RealtimeReputationClient', () => {
  it('get a known malicious site', async () => {
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      categories: [39],
      confidence: 0.9,
      isMalicious: 'malicious',
      scope: 'domain',
      status: 'success',
    })
  })

  it('get a known safe site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      ...mockReputation,
      categories: [1],
      scope: 'Path',
      isMalicious: false,
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      categories: [1],
      confidence: 0.9,
      isMalicious: 'notMalicious',
      scope: 'path',
      status: 'success',
    })
  })

  it('get a unknown site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      confidence: 0,
      categories: [],
      scope: 'Domain',
      status: 'NotFound',
      isMalicious: undefined,
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      categories: [],
      confidence: 0,
      isMalicious: 'unknown',
      scope: 'domain',
      status: 'notFound',
    })
  })
})
