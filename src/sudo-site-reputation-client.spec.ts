require('fake-indexeddb/auto')

import { ReputationStatus } from './gen/graphqlTypes'
import { IDBStorageProvider } from './idb-storage-provider'
import { SudoSiteReputationClient } from './sudo-site-reputation-client'

const reputationCache = new IDBStorageProvider()
const apiClient = {
  getSiteReputation: jest.fn().mockResolvedValue({
    reputationStatus: ReputationStatus.Malicious,
    categories: [],
  }),
} as any

const client = new SudoSiteReputationClient({ apiClient, reputationCache })

describe('SudoSiteReputationClient', () => {
  afterEach(() => {
    reputationCache.clear()
  })

  it('get a known malicious site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      reputationStatus: ReputationStatus.Malicious,
      categories: ['MEAN_COFFEE_DRINKERS'],
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Malicious,
      categories: ['MEAN_COFFEE_DRINKERS'],
    })
  })

  it('get a known safe site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      reputationStatus: ReputationStatus.Notmalicious,
      categories: [],
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Notmalicious,
      categories: [],
    })
  })

  it('get a unknown site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      reputationStatus: ReputationStatus.Unknown,
      categories: [],
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Unknown,
      categories: [],
    })
  })

  it('should return cached data', async () => {
    await expect(
      reputationCache.getItem('http://someunknownsite.com'),
    ).resolves.toEqual(undefined)
    const unknownResult = await client.getSiteReputation(
      'http://someunknownsite.com',
    )
    expect(unknownResult).toEqual({
      reputationStatus: ReputationStatus.Unknown,
      categories: [],
    })
    await expect(
      reputationCache.getItem('http://someunknownsite.com'),
    ).resolves.toEqual(
      JSON.stringify({
        reputationStatus: ReputationStatus.Unknown,
        categories: [],
      }),
    )
    await reputationCache.setItem(
      'http://somenonmalicioussite.com',
      JSON.stringify({
        reputationStatus: ReputationStatus.Notmalicious,
        categories: [],
      }),
    )
    const nonMaliciousResult = await client.getSiteReputation(
      'http://somenonmalicioussite.com',
    )
    expect(nonMaliciousResult).toEqual({
      reputationStatus: ReputationStatus.Notmalicious,
      categories: [],
    })
  })
})
