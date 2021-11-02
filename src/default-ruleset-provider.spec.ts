import { NotAuthorizedError } from '@sudoplatform/sudo-common'
import { CognitoIdentityCredentials } from 'aws-sdk/lib/core'

import { DefaultRulesetProvider } from './default-ruleset-provider'
import { RulesetType } from './ruleset-type'

jest.mock('aws-sdk/clients/s3', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getObject: (props: any) => ({
        promise: async () => {
          let bodyContent
          if (props.Key == '/path/MALWARE/ruleset.txt') {
            bodyContent = 'MalwareList'
          } else if (props.Key == '/path/PHISHING/ruleset.txt') {
            bodyContent = 'PhishingList'
          } else {
            bodyContent = 'MaliciousDomainList'
          }
          const bucket = {
            Key: props.Key,
            Body: Buffer.from(bodyContent, 'utf8'),
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
      listObjects: () => ({
        promise: async () => {
          const content1 = {
            Key: '/path/MALWARE/ruleset.txt',
            LastModified: new Date('2020-01-01T00:00:00Z'),
          }
          const content2 = {
            Key: '/path/PHISHING/ruleset.txt',
            LastModified: new Date('2020-01-01T00:00:00Z'),
          }
          const content3 = {
            Key: '/path/MALICIOUSDOMAIN/ruleset.txt',
            LastModified: new Date('2020-01-01T00:00:00Z'),
          }
          const result = {
            Contents: [content1, content2, content3],
          }
          return result
        },
      }),
    }
  })
})

jest.mock('aws-sdk/lib/core', () => {
  const CognitoIdentityCredentials = Object.assign(
    jest.fn((props) => ({
      props,
      getPromise: jest.fn().mockImplementation(async () => {
        if (CognitoIdentityCredentials.alwaysThrowAuthError) {
          throw CognitoIdentityCredentials.alwaysThrowAuthError
        }
      }),
      clearCachedId: jest.fn(),
    })),
    {
      alwaysThrowAuthError: undefined,
    },
  )

  return {
    CognitoIdentityCredentials,
  }
})

const mockUserClient = {
  getLatestAuthToken: jest.fn(),
}

const testProps = {
  userClient: mockUserClient as any,
  bucket: 'BUCKET',
  bucketRegion: 'REGION',
  poolId: 'POOL',
  identityPoolId: 'ID_POOL',
}

beforeEach(() => {
  ;(CognitoIdentityCredentials as any).alwaysThrowAuthError = undefined
})

describe('DefaultRuleSetProvider', () => {
  describe('downloadRuleset()', () => {
    it('should download ruleset data with no cache', async () => {
      const provider = new DefaultRulesetProvider(testProps)
      const result = await provider.downloadRuleset(RulesetType.MALWARE)
      expect(result).toEqual({ cacheKey: 'etag1', data: 'MalwareList' })
    })

    it('should download ruleset data with cache key miss', async () => {
      const provider = new DefaultRulesetProvider(testProps)
      const result = await provider.downloadRuleset(
        RulesetType.MALWARE,
        'OLD_ETAG',
      )
      expect(result).toEqual({ cacheKey: 'etag1', data: 'MalwareList' })
    })

    it('should not download rules with cache key hit', async () => {
      const provider = new DefaultRulesetProvider(testProps)
      const result = await provider.downloadRuleset(
        RulesetType.MALWARE,
        'etag1',
      )
      expect(result).toEqual('not-modified')
    })

    it('should only download MALWARE and PHISHING rulesets', async () => {
      const provider = new DefaultRulesetProvider(testProps)
      const result1 = await provider.downloadRuleset(RulesetType.MALWARE)
      expect(result1).toEqual({ cacheKey: 'etag1', data: 'MalwareList' })

      const result2 = await provider.downloadRuleset(RulesetType.PHISHING)
      expect(result2).toEqual({ cacheKey: 'etag1', data: 'PhishingList' })

      const result3 = await provider.downloadRuleset(
        RulesetType.MALICIOUSDOMAIN,
      )
      expect(result3).toEqual({ cacheKey: '', data: '' })
    })

    it('should throw a `NotAuthorizedError` if user is not authorized', async () => {
      ;(CognitoIdentityCredentials as any).alwaysThrowAuthError = {
        code: 'NotAuthorizedException',
      }
      const provider = new DefaultRulesetProvider(testProps)
      const promise = provider.downloadRuleset(RulesetType.MALWARE)
      await expect(promise).rejects.toThrow(NotAuthorizedError)
    })

    it('should throw unspecified errors', async () => {
      ;(CognitoIdentityCredentials as any).alwaysThrowAuthError = {
        code: 'ServerError',
      }
      const provider = new DefaultRulesetProvider(testProps)
      const promise = provider.downloadRuleset(RulesetType.MALWARE)
      await expect(promise).rejects.not.toThrow(NotAuthorizedError)
    })
  })
})
