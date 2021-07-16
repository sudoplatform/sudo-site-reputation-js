import { NotAuthorizedError } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'
import S3 from 'aws-sdk/clients/s3'
import { CognitoIdentityCredentials } from 'aws-sdk/lib/core'

import { RulesetContent, RulesetProvider } from './ruleset-provider'

const s3Region = 'us-east-1'
const s3Prefix = '/site-reputation/reputation-lists/'
const s3RulesetKey = `${s3Prefix}MALICIOUSDOMAIN/urlhaus-filter-domains-online.txt`

export interface DefaultRulesetProviderProps {
  userClient: SudoUserClient
  poolId: string
  identityPoolId: string
  bucket: string
}

export class DefaultRulesetProvider implements RulesetProvider {
  constructor(private props: DefaultRulesetProviderProps) {}

  public async downloadRuleset(
    cacheKey?: string,
  ): Promise<RulesetContent | 'not-modified'> {
    const s3 = await this.getS3Client()

    let response
    try {
      response = await s3
        .getObject({
          Bucket: this.props.bucket,
          Key: s3RulesetKey,
          IfNoneMatch: cacheKey,
        })
        .promise()
    } catch (error) {
      if (error?.code === 'NotModified') {
        return 'not-modified'
      } else {
        throw error
      }
    }

    if (!response.Body) {
      throw new Error('Unexpected. Could not get body from S3 response.')
    }

    return {
      data: response.Body.toString('utf-8'),
      cacheKey: response.ETag,
    }
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
      region: s3Region,
      credentials: credentials,
    })
  }
}
