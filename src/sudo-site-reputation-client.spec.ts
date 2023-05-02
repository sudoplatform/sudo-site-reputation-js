require('fake-indexeddb/auto')

import { ReputationStatus } from './gen/graphqlTypes'
import { IDBStorageProvider } from './idb-storage-provider'
import { SudoSiteReputationClient } from './sudo-site-reputation-client'

const reputationCache = new IDBStorageProvider()
const apiClient = {
  getSiteReputation: jest.fn().mockResolvedValue({
    reputationStatus: ReputationStatus.Malicious,
  }),
} as any

const client = new SudoSiteReputationClient({ apiClient, reputationCache })

describe('SudoSiteReputationClient', () => {
  afterEach(() => {
    reputationCache.clear()
  })

  it('get a known malicious site', async () => {
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Malicious,
    })
  })

  it('get a known safe site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      reputationStatus: ReputationStatus.Notmalicious,
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Notmalicious,
    })
  })

  it('get a unknown site', async () => {
    apiClient.getSiteReputation.mockResolvedValue({
      reputationStatus: ReputationStatus.Unknown,
    })
    const result = await client.getSiteReputation('someurl.com')
    expect(result).toEqual({
      reputationStatus: ReputationStatus.Unknown,
    })
  })

  it('should return cached data', async () => {
    await expect(
      reputationCache.getItem('http://someunknownsite.com'),
    ).resolves.toEqual(undefined)
    const unknownResult = await client.getSiteReputation(
      'http://someunknownsite.com',
    )
    expect(unknownResult.reputationStatus).toBe(ReputationStatus.Unknown)
    await expect(
      reputationCache.getItem('http://someunknownsite.com'),
    ).resolves.toEqual(ReputationStatus.Unknown)
    await reputationCache.setItem(
      'http://somenonmalicioussite.com',
      ReputationStatus.Notmalicious,
    )
    const nonMaliciousResult = await client.getSiteReputation(
      'http://somenonmalicioussite.com',
    )
    expect(nonMaliciousResult.reputationStatus).toBe(
      ReputationStatus.Notmalicious,
    )
  })
})
