import { MemoryStorageProvider } from './memory-storage-provider'
import {
  MockRuleSetProvider,
  mockRuleset1,
  mockRuleset2,
  mockRuleset3,
  mockRuleset4,
} from './mock-ruleset-provider'
import {
  Status,
  SudoSiteReputationClient,
  SudoSiteReputationClientProps,
  lastUpdatePerformedAtStorageKey,
  malwareRulesetStorageKey,
  phishingRulesetStorageKey,
} from './sudo-site-reputation-client'

const storageProvider = new MemoryStorageProvider()
const rulesetProvider = new MockRuleSetProvider()
const testProps: SudoSiteReputationClientProps = {
  config: {} as any,
  sudoUserClient: {} as any,
  rulesetProvider,
  storageProvider,
}
const rulesetProviderDownloadSpy = jest.spyOn(
  rulesetProvider,
  'downloadRuleset',
)

beforeEach(async () => {
  storageProvider.clear()
  rulesetProviderDownloadSpy.mockClear()
})

describe('SudoSiteReputationClient', () => {
  describe('construction', () => {
    it('should set ruleset in storage', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      await siteReputationClient.update()
      await siteReputationClient.getSiteReputation('www.domain.com')

      const storageItem = await storageProvider.getItem(
        malwareRulesetStorageKey,
      )
      expect(JSON.parse(storageItem).data).toBe(mockRuleset1._rules.join('\n'))
      expect(JSON.parse(storageItem).cacheKey).toBe(mockRuleset1.location)
    })

    it('should initialize client in Status.Preparing', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      expect(siteReputationClient.status).toBe(Status.Preparing)
    })

    it('should set client in Status.Error if initialize fails', async () => {
      const newStorageProvider = new MemoryStorageProvider()
      const onStatusChangedSpy = jest.fn()
      newStorageProvider.getItem = jest
        .fn()
        .mockRejectedValue(new Error('bad things'))
      const siteReputationClient = new SudoSiteReputationClient({
        ...testProps,
        onStatusChanged: onStatusChangedSpy,
        storageProvider: newStorageProvider,
      })

      const promise = siteReputationClient.update()

      await expect(promise).rejects.toThrow('bad things')
      expect(siteReputationClient.status).toBe(Status.Error)
      expect(onStatusChangedSpy).toBeCalled()
    })

    it('should initialize from cached data', async () => {
      const lastUpdate = new Date('2021-01-01T00:00:00Z')
      await storageProvider.setItem(
        malwareRulesetStorageKey,
        JSON.stringify({
          data: mockRuleset1._rules.join('\n'),
          cacheKey: mockRuleset1.location,
        }),
      )
      await storageProvider.setItem(
        phishingRulesetStorageKey,
        JSON.stringify({
          data: mockRuleset2._rules.join('\n'),
          cacheKey: mockRuleset2.location,
        }),
      )
      await storageProvider.setItem(
        lastUpdatePerformedAtStorageKey,
        lastUpdate.toISOString(),
      )

      const client = new SudoSiteReputationClient(testProps)

      await expect(client.getSiteReputation('worf.org')).resolves.toEqual({
        isMalicious: true,
      })
      expect(client.lastUpdatePerformedAt).toEqual(lastUpdate)
      expect(rulesetProviderDownloadSpy).toBeCalledTimes(0)
    })
  })

  describe('getSiteReputation()', () => {
    it('should set client in Status.Ready', async () => {
      const onStatusChangedSpy = jest.fn()
      const siteReputationClient = new SudoSiteReputationClient({
        ...testProps,
        onStatusChanged: onStatusChangedSpy,
      })

      expect(siteReputationClient.status).toBe(Status.Preparing)

      await siteReputationClient.update()
      await siteReputationClient.getSiteReputation('www.domain.com')

      expect(siteReputationClient.status).toBe(Status.Ready)
      expect(onStatusChangedSpy).toBeCalled()
    })

    // Note that the MockRulesetProvider will return rules for:
    // - federation.com, romulan.com, and buybuybuy.com
    it.each`
      site                                         | isMalicious
      ${'domain.com'}                              | ${false}
      ${'domain.com/'}                             | ${false}
      ${'www.domain.com'}                          | ${false}
      ${'www.domain.us.com'}                       | ${false}
      ${'www.us.domain.com'}                       | ${false}
      ${'www.safe-romulan.com'}                    | ${false}
      ${'www.safe-romulan.com/page/whatever.html'} | ${false}
      ${'www.us.safe-buybuybuy.com'}               | ${false}
      ${'safe-federation.com'}                     | ${false}
      ${'romulan.com'}                             | ${true}
      ${'www.romulan.com'}                         | ${true}
      ${'www.us.romulan.com'}                      | ${true}
      ${'buybuybuy.com'}                           | ${true}
      ${'buybuybuy.com/'}                          | ${true}
      ${'buybuybuy.com/page/whatever.html'}        | ${true}
      ${'www.us.buybuybuy.com'}                    | ${true}
    `(
      'should return CheckSiteReputationResult.safe if site is safe',
      async ({ site, isMalicious }) => {
        const siteReputationClient = new SudoSiteReputationClient(testProps)

        await siteReputationClient.update()
        const siteReputationData = await siteReputationClient.getSiteReputation(
          site,
        )
        expect(siteReputationData.isMalicious).toBe(isMalicious)
      },
    )

    it('should not unnecessarily download data when calling getSiteReputation', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      // Ensure that initialization has completed
      await siteReputationClient.update()
      await siteReputationClient.getSiteReputation('meh')
      rulesetProviderDownloadSpy.mockClear()
      expect(rulesetProviderDownloadSpy).toBeCalledTimes(0)

      // Query site reputation
      await siteReputationClient.getSiteReputation('site.com')

      expect(rulesetProviderDownloadSpy).toBeCalledTimes(0)
    })

    it('should throw if no ruleset list', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      await siteReputationClient.clearStorage()
      const promise = siteReputationClient.getSiteReputation('federation.com')

      await expect(promise).rejects.toThrow(
        'Reputation data is not present. Call `update` to obtain the latest reputation data.',
      )
      expect(siteReputationClient.status).toBe(Status.NeedUpdate)
    })

    it.each`
      hasLastUpdatePerformedAt | expectation
      ${true}                  | ${'no-error'}
    `(
      'should throw if no lastUpdate',
      async ({ hasLastUpdatePerformedAt, expectation }) => {
        // Arrange
        await storageProvider.setItem(
          malwareRulesetStorageKey,
          JSON.stringify({
            data: mockRuleset2._rules.join('\n'),
            cacheKey: mockRuleset2.location,
          }),
        )

        // Act
        if (hasLastUpdatePerformedAt) {
          await storageProvider.setItem(
            lastUpdatePerformedAtStorageKey,
            '2021-01-01T00:00:00Z',
          )
        }
        const siteReputationClient = new SudoSiteReputationClient(testProps)

        // Assert
        if (expectation === 'error') {
          await expect(async () =>
            siteReputationClient.getSiteReputation('federation.com'),
          ).rejects.toThrow(
            'Reputation data is not present. Call `update` to obtain the latest reputation data.',
          )
        }
      },
    )
  })

  describe('getMaliciousSites', () => {
    it('should return full malicious sites list', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)
      await siteReputationClient.update()

      const sites = await siteReputationClient.getMaliciousSites()
      expect(sites).toEqual([...mockRuleset1._rules, ...mockRuleset2._rules])
    })

    it('should throw if update is needed', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)
      const sitesPromise = siteReputationClient.getMaliciousSites()
      await expect(sitesPromise).rejects.toThrow(
        'Reputation data is not present. Call `update` to obtain the latest reputation data.',
      )
    })
  })

  describe('update()', () => {
    it('should update ruleset', async () => {
      const newRulesetProvider = new MockRuleSetProvider()
      const siteReputationClient = new SudoSiteReputationClient({
        ...testProps,
        rulesetProvider: newRulesetProvider,
      })

      // Test default ruleset
      await siteReputationClient.update()
      const siteReputationData = await siteReputationClient.getSiteReputation(
        'spock.org',
      )
      expect(siteReputationData.isMalicious).toBe(false)

      // Test initial cache
      const cacheValue = await storageProvider.getItem(malwareRulesetStorageKey)
      expect(JSON.parse(cacheValue).cacheKey).toBe(mockRuleset1.location)

      // Act
      newRulesetProvider.malwareRuleset = mockRuleset3
      newRulesetProvider.phishingRuleset = mockRuleset4
      await siteReputationClient.update()

      // Test update ruleset
      const updatedSiteReputationData =
        await siteReputationClient.getSiteReputation('spock.org')
      expect(updatedSiteReputationData.isMalicious).toBe(true)

      // Test updated cache
      const updatedCacheValue = await storageProvider.getItem(
        malwareRulesetStorageKey,
      )
      expect(JSON.parse(updatedCacheValue).cacheKey).toBe(mockRuleset3.location)
    })

    it('should not set cache if not modified', async () => {
      const newRulesetProvider = new MockRuleSetProvider()
      const siteReputationClient = new SudoSiteReputationClient({
        ...testProps,
        rulesetProvider: newRulesetProvider,
      })

      // Test default ruleset
      await siteReputationClient.update()
      const siteReputationData = await siteReputationClient.getSiteReputation(
        'buybuybuy.com',
      )
      expect(siteReputationData.isMalicious).toBe(true)

      // Test initial cache
      const cacheValue = await storageProvider.getItem(malwareRulesetStorageKey)
      expect(JSON.parse(cacheValue).cacheKey).toBe(mockRuleset1.location)

      // Act
      await siteReputationClient.update()

      // Test update ruleset
      const updatedSiteReputationData =
        await siteReputationClient.getSiteReputation('buybuybuy.com')
      expect(updatedSiteReputationData.isMalicious).toBe(true)

      // Test updated cache
      const updatedCacheValue = await storageProvider.getItem(
        malwareRulesetStorageKey,
      )
      expect(JSON.parse(updatedCacheValue).cacheKey).toBe(mockRuleset1.location)
    })

    it('should update client.lastUpdatePerformedAt and stored value', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      const storedValueBeforeUpdate = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )
      const lastUpdateBeforeUpdate = siteReputationClient.lastUpdatePerformedAt
      expect(storedValueBeforeUpdate).toBe(undefined)
      expect(lastUpdateBeforeUpdate).toEqual(storedValueBeforeUpdate)

      await siteReputationClient.update()

      const storedValueAfterUpdate = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )
      const lastUpdatePerformedAtAfterUpdate =
        siteReputationClient.lastUpdatePerformedAt
      expect(storedValueAfterUpdate).toBeTruthy()
      expect(lastUpdatePerformedAtAfterUpdate).toEqual(
        new Date(storedValueAfterUpdate),
      )
    })
  })

  describe('clearStorage()', () => {
    it('should clear stored ruleset and lastUpdatePerformedAt', async () => {
      const siteReputationClient = new SudoSiteReputationClient(testProps)

      await siteReputationClient.update()
      await siteReputationClient.getSiteReputation('federation.com')

      const rulesetDataBeforeClear = await storageProvider.getItem(
        malwareRulesetStorageKey,
      )
      const lastUpdateBeforeClear = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )

      expect(JSON.parse(rulesetDataBeforeClear).data).toContain(
        'federation.com',
      )
      expect(lastUpdateBeforeClear).toBeTruthy()
      expect(siteReputationClient.lastUpdatePerformedAt).toBeTruthy()
      expect(siteReputationClient.status).toBe(Status.Ready)

      await siteReputationClient.clearStorage()
      const rulesetDataAfterClear = await storageProvider.getItem(
        malwareRulesetStorageKey,
      )
      const lastUpdateAfterClear = await storageProvider.getItem(
        lastUpdatePerformedAtStorageKey,
      )

      expect(rulesetDataAfterClear).toBe(undefined)
      expect(lastUpdateAfterClear).toBe(undefined)
      expect(siteReputationClient.lastUpdatePerformedAt).toBe(undefined)
      expect(siteReputationClient.status).toBe(Status.NeedUpdate)
    })
  })
})
