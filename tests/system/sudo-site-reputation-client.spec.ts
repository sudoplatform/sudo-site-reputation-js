require('fake-indexeddb/auto')

import { DefaultApiClientManager } from '@sudoplatform/sudo-api-client'
import { NotAuthorizedError, SudoKeyManager } from '@sudoplatform/sudo-common'
import { DefaultSudoEntitlementsClient } from '@sudoplatform/sudo-entitlements'
import { SudoEntitlementsAdminClient } from '@sudoplatform/sudo-entitlements-admin'
import { SudoUserClient } from '@sudoplatform/sudo-user'

import { ApiClient, InsufficientEntitlementsError } from '../../src/apiClient'
import {
  SudoSiteReputationClient,
  SudoSiteReputationClientProps,
} from '../../src/sudo-site-reputation-client'
import {
  SR_ENTITLEMENT_NAME,
  invalidateAuthTokens,
  registerUser,
  removeEntitlementsByName,
} from './test-registration'

let keyManager: SudoKeyManager
let userClient: SudoUserClient
let testProps: SudoSiteReputationClientProps
let apiClient: ApiClient
let entitlementAdminClient: SudoEntitlementsAdminClient

beforeAll(async () => {
  const services = await registerUser()
  keyManager = services.keyManager
  userClient = services.userClient
  entitlementAdminClient = services.entitlementAdminClient
  DefaultApiClientManager.getInstance().setAuthClient(services.userClient)
  // Need to redeem entitlements after setting the auth client
  const entitlementClient = new DefaultSudoEntitlementsClient(userClient)
  await entitlementClient.redeemEntitlements()
  const client = DefaultApiClientManager.getInstance()
  apiClient = new ApiClient(client)
  testProps = {
    apiClient,
  }
})

describe('SudoSiteReputationClient', () => {
  describe('getSiteReputation()', () => {
    it('should return UNKNOWN for a known unknown site', async () => {
      const testInstance = new SudoSiteReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(
        'http://unknown.example.com',
      )
      expect(reputationResult.reputationStatus).toBe('UNKNOWN')
    })

    it('should return MALICIOUS for malicious sites', async () => {
      const testInstance = new SudoSiteReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(
        'http://malware.wicar.org/data/eicar.com',
      )
      expect(reputationResult.reputationStatus).toBe('MALICIOUS')
      expect(reputationResult.categories).toContain('MALWARE')
    })

    it('should return NOTMALICIOUS for not malicious sites', async () => {
      const testInstance = new SudoSiteReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(
        'https://anonyome.com',
      )
      expect(reputationResult.reputationStatus).toBe('NOTMALICIOUS')
      expect(reputationResult.categories).toStrictEqual([])
    })
  })

  it('should throw InsufficientEntitlementsError', async () => {
    const externalId = (await userClient.getUserName()) ?? ''
    await removeEntitlementsByName(
      externalId,
      [SR_ENTITLEMENT_NAME],
      entitlementAdminClient,
    )

    const testInstance = new SudoSiteReputationClient(testProps)

    await expect(testInstance.getSiteReputation('anysite.com')).rejects.toThrow(
      InsufficientEntitlementsError,
    )
  })

  // This test needs to be last.
  it('should throw NotAuthorizedError', async () => {
    await invalidateAuthTokens(keyManager, userClient)

    const testInstance = new SudoSiteReputationClient(testProps)

    await expect(testInstance.getSiteReputation('anysite.com')).rejects.toThrow(
      NotAuthorizedError,
    )
  })
})
