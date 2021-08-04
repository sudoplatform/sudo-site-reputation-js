import { NotAuthorizedError } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'
import { AuthenticationStore } from '@sudoplatform/sudo-user/lib/core/auth-store'

import {
  DefaultRulesetProvider,
  DefaultRulesetProviderProps,
} from '../../src/default-ruleset-provider'
import { RulesetContent } from '../../src/ruleset-provider'
import {
  invalidateAuthTokens,
  registerUser,
  sdkConfig,
} from './test-registration'

let authStore: AuthenticationStore
let userClient: SudoUserClient
let testProps: DefaultRulesetProviderProps
beforeEach(async () => {
  const services = await registerUser()
  authStore = services.authStore
  userClient = services.userClient
  testProps = {
    userClient,
    poolId: sdkConfig.identityService.poolId,
    identityPoolId: sdkConfig.identityService.identityPoolId,
    bucket: sdkConfig.siteReputationService.bucket,
    bucketRegion: sdkConfig.siteReputationService.region,
  }
})

describe('DefaultRulesetProvider', () => {
  it('should download ruleset', async () => {
    const eTagRegex = /"[0-9a-f]*"$/
    const rulesetProvider = new DefaultRulesetProvider(testProps)

    const result = await rulesetProvider.downloadRuleset()

    if (result === 'not-modified') fail()
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.cacheKey).toEqual(expect.stringMatching(eTagRegex))
  })

  it('should not download if etag has not changed', async () => {
    const ruleSetProvider = new DefaultRulesetProvider(testProps)

    const result1 = await ruleSetProvider.downloadRuleset()
    const result2 = await ruleSetProvider.downloadRuleset(
      (result1 as RulesetContent).cacheKey,
    )

    expect(result2 as string).toBe('not-modified')
  })

  fit('should throw `NotAuthorizedError` if user is not authorized', async () => {
    await invalidateAuthTokens(authStore, userClient)
    const ruleSetProvider = new DefaultRulesetProvider(testProps)

    const promise = ruleSetProvider.downloadRuleset()

    await expect(promise).rejects.toThrow(NotAuthorizedError)
  })
})
