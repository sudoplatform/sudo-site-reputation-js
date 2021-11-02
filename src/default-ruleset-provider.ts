import { NotAuthorizedError } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'
import S3 from 'aws-sdk/clients/s3'
import { CognitoIdentityCredentials } from 'aws-sdk/lib/core'

import { RulesetContent, RulesetProvider } from './ruleset-provider'
import { RulesetType } from './ruleset-type'

const s3Prefix = '/reputation-lists/'

export interface DefaultRulesetProviderProps {
  userClient: SudoUserClient
  poolId: string
  identityPoolId: string
  bucket: string
  bucketRegion: string
}

export class DefaultRulesetProvider implements RulesetProvider {
  constructor(private props: DefaultRulesetProviderProps) {}

  private availableRulesetKeys: string[] = []

  public async downloadRuleset(
    rulesetType: RulesetType,
    cacheKey?: string,
  ): Promise<RulesetContent | 'not-modified'> {
    const s3 = await this.getS3Client()

    let rulesetDataString = ''
    let eTag = ''
    try {
      // download the available rulesets if none are available
      if (this.availableRulesetKeys.length === 0) {
        await this.listAvailableRulesets()
      }
      const rulesetKeysOfThisType = this.availableRulesetKeys.filter((key) => {
        const pathComponents = key.split('/')
        const availableRulesetType = pathComponents[2]
        // grab the third item [0] should be an empty string, [1] should be the root path, [2] should be the ruleset type
        return (
          (availableRulesetType === RulesetType.MALWARE ||
            availableRulesetType === RulesetType.PHISHING) &&
          pathComponents.length > 2 &&
          availableRulesetType === rulesetType
        )
      })
      for (const rulesetKey of rulesetKeysOfThisType) {
        const response = await s3
          .getObject({
            Bucket: this.props.bucket,
            Key: rulesetKey,
            IfNoneMatch: cacheKey,
          })
          .promise()
        if (!response.Body) {
          throw new Error('Unexpected. Could not get body from S3 response.')
        }
        if (!response.ETag) {
          throw new Error('Unexpected. Could not get ETag from S3 response.')
        }
        rulesetDataString += response.Body.toString('utf-8')
        // grab the etag of the last item for caching purposes
        eTag = response.ETag
      }
    } catch (error) {
      if (error?.code === 'NotModified') {
        return 'not-modified'
      } else {
        throw error
      }
    }

    return {
      data: rulesetDataString,
      cacheKey: eTag,
    }
  }

  async listAvailableRulesets(): Promise<string[]> {
    const s3 = await this.getS3Client()
    const result = await s3
      .listObjects({
        Bucket: this.props.bucket,
        Prefix: s3Prefix,
      })
      .promise()

    if (!result.Contents) {
      throw new Error('Unexpected. Cannot get Contents from S3 result.')
    }

    this.availableRulesetKeys = result.Contents.map(({ Key }) => {
      if (!Key) {
        throw new Error('Cannot interpret S3 Object result.')
      }
      return Key
    })
    return this.availableRulesetKeys
  }

  private async getS3Client(): Promise<S3> {
    const authToken = await this.props.userClient.getLatestAuthToken()
    const providerName = `cognito-idp.us-east-1.amazonaws.com/${this.props.poolId}`
    const credentials = new CognitoIdentityCredentials(
      {
        IdentityPoolId: this.props.identityPoolId,
        Logins: {
          [providerName]: authToken,
        },
      },
      {
        region: 'us-east-1',
      },
    )

    credentials.clearCachedId()

    try {
      await credentials.getPromise()
    } catch (error) {
      if (error.code === 'NotAuthorizedException') {
        throw new NotAuthorizedError()
      }

      throw error
    }

    return new S3({
      region: this.props.bucketRegion,
      credentials: credentials,
    })
  }
}
