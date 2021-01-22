import { SudoUserClient } from '@sudoplatform/sudo-user'

import {
  DefaultRulesetProvider,
  DefaultRulesetProviderProps,
} from '../../src/default-ruleset-provider'
import { RulesetContent } from '../../src/ruleset-provider'
import { registerUser, sdkConfig } from './test-registration'

let userClient: SudoUserClient
let testProps: DefaultRulesetProviderProps
beforeAll(async () => {
  userClient = await registerUser()
  testProps = {
    userClient,
    poolId: sdkConfig.identityService.poolId,
    identityPoolId: sdkConfig.identityService.identityPoolId,
    bucket: sdkConfig.identityService.staticDataBucket,
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
})
