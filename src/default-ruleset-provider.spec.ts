import { DefaultRulesetProvider } from './default-ruleset-provider'

jest.mock('aws-sdk/clients/s3', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getObject: (props: any) => ({
        promise: async () => {
          const bucket = {
            Key: '/path/to/ruleset.txt',
            Body: Buffer.from('LIST1', 'utf8'),
            ETag: 'etag1',
            LastModified: new Date('2020-01-01T00:00:00Z'),
          }

          if (props.IfNoneMatch && props.IfNoneMatch === bucket.ETag) {
            throw { code: 'NotModified' }
          } else {
            return bucket
          }
        },
      }),
    }
  })
})

jest.mock('aws-sdk/lib/core', () => ({
  CognitoIdentityCredentials: jest.fn((props) => ({
    props,
    getPromise: jest.fn(),
  })),
}))

const mockUserClient = {
  getLatestAuthToken: jest.fn(),
}

const testProps = {
  userClient: mockUserClient as any,
  bucket: 'BUCKET',
  poolId: 'POOL',
  identityPoolId: 'ID_POOL',
}

describe('DefaultRuleSetProvider', () => {
  describe('downloadRuleset()', () => {
    it('should download ruleset data with no cache', async () => {
      const provider = new DefaultRulesetProvider(testProps)

      const result = await provider.downloadRuleset()

      expect(result).toEqual({ cacheKey: 'etag1', data: 'LIST1' })
    })

    it('should download ruleset data with cache key miss', async () => {
      const provider = new DefaultRulesetProvider(testProps)

      const result = await provider.downloadRuleset('OLD_ETAG')

      expect(result).toEqual({ cacheKey: 'etag1', data: 'LIST1' })
    })

    it('should not download rules with cache key hit', async () => {
      const provider = new DefaultRulesetProvider(testProps)

      const result = await provider.downloadRuleset('etag1')
      expect(result).toEqual('not-modified')
    })
  })
})
