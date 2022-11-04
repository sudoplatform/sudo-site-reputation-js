import { url } from 'inspector'

import { DefaultApiClientManager } from '@sudoplatform/sudo-api-client'

import { RealtimeReputationClient } from '../../src/realtime-site-reputation-client'
import { registerUser, sdkConfig } from './test-registration'

let testProps: RealtimeReputationClientProps
beforeAll(async () => {
  const services = await registerUser()
  const apiClient = DefaultApiClientManager.getInstance()
  apiClient.setAuthClient(services.userClient)
  testProps = {
    apiclient: apiClient,
  }
})

describe('RealtimeReputationClient', () => {
  describe('getSiteReputation()', () => {
    it.each`
      domain                            | expected
      ${'http://www.example.com'}       | ${false}
      ${'http://8.8.8.8'}               | ${false}
      ${'http://federation.org'}        | ${false}
      ${'http://vulcan.federation.org'} | ${false}
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
      expect(reputationResult.isMalicious).toBe(true)
    })
  })
})
