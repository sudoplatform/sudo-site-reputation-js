require('fake-indexeddb/auto')

import { DefaultApiClientManager } from '@sudoplatform/sudo-api-client'
import { NotAuthorizedError, SudoKeyManager } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'

import { ApiClient } from '../../src/apiClient'
import {
  SudoSiteReputationClient,
  SudoSiteReputationClientProps,
} from '../../src/sudo-site-reputation-client'
import { invalidateAuthTokens, registerUser } from './test-registration'

let keyManager: SudoKeyManager
let userClient: SudoUserClient
let testProps: SudoSiteReputationClientProps
let apiClient: ApiClient

beforeAll(async () => {
  const services = await registerUser()
  keyManager = services.keyManager
  userClient = services.userClient
  DefaultApiClientManager.getInstance().setAuthClient(services.userClient)
  const client = DefaultApiClientManager.getInstance()
  apiClient = new ApiClient(client)
  testProps = {
    apiClient,
  }
})

describe('SudoSiteReputationClient', () => {
  describe('getSiteReputation()', () => {
    it.each`
      domain                            | expected
      ${'http://www.example.com'}       | ${'UNKNOWN'}
      ${'http://8.8.8.8'}               | ${'UNKNOWN'}
      ${'http://federation.org'}        | ${'UNKNOWN'}
      ${'http://vulcan.federation.org'} | ${'UNKNOWN'}
    `(
      'should return UNKNOWN for sites not in db',
      async ({ domain, expected }) => {
        const testInstance = new SudoSiteReputationClient(testProps)
        const reputationResult = await testInstance.getSiteReputation(domain)
        expect(reputationResult.reputationStatus).toBe(expected)
      },
    )

    it('should return MALICIOUS for malicious sites', async () => {
      const testInstance = new SudoSiteReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(
        'http://malware.wicar.org/data/eicar.com',
      )
      expect(reputationResult.reputationStatus).toBe('MALICIOUS')
    })
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
