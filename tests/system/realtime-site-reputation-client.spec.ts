import { DefaultApiClientManager } from '@sudoplatform/sudo-api-client'
import { NotAuthorizedError, SudoKeyManager } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'

import { ApiClient } from '../../src/apiClient'
import {
  RealtimeReputationClient,
  RealtimeReputationClientProps,
} from '../../src/realtime-site-reputation-client'
import { invalidateAuthTokens, registerUser } from './test-registration'

let keyManager: SudoKeyManager
let userClient: SudoUserClient
let testProps: RealtimeReputationClientProps
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

describe('RealtimeReputationClient', () => {
  describe('getSiteReputation()', () => {
    it.each`
      domain                            | expected
      ${'http://www.example.com'}       | ${'notMalicious'}
      ${'http://8.8.8.8'}               | ${'notMalicious'}
      ${'http://federation.org'}        | ${'notMalicious'}
      ${'http://vulcan.federation.org'} | ${'notMalicious'}
    `('should return false for safe sites', async ({ domain, expected }) => {
      const testInstance = new RealtimeReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(domain)
      expect(reputationResult.isMalicious).toBe(expected)
    })

    it('should return true for malicious sites', async () => {
      const testInstance = new RealtimeReputationClient(testProps)
      const reputationResult = await testInstance.getSiteReputation(
        'http://malware.wicar.org/data/eicar.com',
      )
      expect(reputationResult.isMalicious).toBe('malicious')
    })
  })

  // This test needs to be last.
  it('should throw NotAuthorizedError', async () => {
    await invalidateAuthTokens(keyManager, userClient)

    const testInstance = new RealtimeReputationClient(testProps)

    await expect(testInstance.getSiteReputation('anysite.com')).rejects.toThrow(
      NotAuthorizedError,
    )
  })
})
