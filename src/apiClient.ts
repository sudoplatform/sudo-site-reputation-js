import {
  ApiClientManager,
  DefaultApiClientManager,
} from '@sudoplatform/sudo-api-client'
import {
  AppSyncNetworkError,
  DefaultLogger,
  Logger,
  isAppSyncNetworkError,
  mapNetworkErrorToClientError,
} from '@sudoplatform/sudo-common'
import { NormalizedCacheObject } from 'apollo-cache-inmemory'
import { ApolloError } from 'apollo-client/errors/ApolloError'
import AWSAppSyncClient from 'aws-appsync'

import {
  GetSiteReputationDocument,
  GetSiteReputationQuery,
  Reputation,
} from './gen/graphqlTypes'

/// AppSync wrapper to invoke Site Reputation Service APIs.
export class ApiClient {
  private readonly log: Logger
  private readonly client: AWSAppSyncClient<NormalizedCacheObject>

  public constructor(apiClientManager?: ApiClientManager) {
    this.log = new DefaultLogger(this.constructor.name)

    // Use the singleton graphql client instance if one isn't passed in.
    const clientManager =
      apiClientManager ?? DefaultApiClientManager.getInstance()
    this.client = clientManager.getClient({ disableOffline: true })
  }

  public async getSiteReputation(uri: string): Promise<Reputation> {
    let result
    try {
      result = await this.client.query<GetSiteReputationQuery>({
        query: GetSiteReputationDocument,
        variables: { uri: uri },
        fetchPolicy: 'no-cache',
      })
    } catch (error) {
      if (isAppSyncNetworkError(error as Error)) {
        throw mapNetworkErrorToClientError(error as AppSyncNetworkError)
      }

      const clientError = error as ApolloError
      this.log.debug('error received', {
        function: 'getSiteReputation',
        clientError,
      })
      const [graphQLError] = clientError.graphQLErrors
      if (graphQLError) {
        this.log.debug('appSync query failed with error', { graphQLError })
        if (
          graphQLError.message === 'sudoplatform.InsufficientEntitlementsError'
        ) {
          throw new InsufficientEntitlementsError()
        }
      }

      // Log until we can figure out what errors to handle
      this.log.debug('An error occurred:', { clientError })

      throw new NotImplementedError()
    }

    // TODO: Implement any required erorr handling here.
    return {
      reputationStatus: result.data.getSiteReputation.reputationStatus,
      categories: result.data.getSiteReputation.categories ?? [], // provide a default if it's missing
    }
  }
}

/**
 * Error thrown for insufficient entitlements to use service.
 */
export class InsufficientEntitlementsError extends Error {
  constructor() {
    super(
      'Insufficient entitlements. Redeem entitlements before using the service.',
    )
    this.name = 'InsufficientEntitlementsError'
  }
}

/**
 * Used as a catch all for any errors that we don't know.
 */
export class NotImplementedError extends Error {
  constructor() {
    super('Not implemented')
    this.name = 'NotImplementedError'
  }
}
