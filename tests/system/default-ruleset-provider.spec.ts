import { NotAuthorizedError, SudoKeyManager } from '@sudoplatform/sudo-common'
import { SudoUserClient } from '@sudoplatform/sudo-user'

import { RulesetType } from '../../src'
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

let keyManager: SudoKeyManager
let userClient: SudoUserClient
let testProps: DefaultRulesetProviderProps
beforeEach(async () => {
  const services = await registerUser()
  keyManager = services.keyManager
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

    const result = await rulesetProvider.downloadRuleset(RulesetType.MALWARE)

    if (result === 'not-modified') fail()
    expect(result.data.length).toBeGreaterThan(0)
    expect(result.cacheKey).toEqual(expect.stringMatching(eTagRegex))
  })

  it('should not download if etag has not changed', async () => {
    const ruleSetProvider = new DefaultRulesetProvider(testProps)

    const result1 = await ruleSetProvider.downloadRuleset(RulesetType.MALWARE)
    const result2 = await ruleSetProvider.downloadRuleset(
      RulesetType.MALWARE,
      (result1 as RulesetContent).cacheKey,
    )

    expect(result2 as string).toBe('not-modified')
  })

  it('should throw `NotAuthorizedError` if user is not authorized', async () => {
    await invalidateAuthTokens(keyManager, userClient)
    const ruleSetProvider = new DefaultRulesetProvider(testProps)

    await expect(
      ruleSetProvider.downloadRuleset(RulesetType.MALWARE),
    ).rejects.toThrow(NotAuthorizedError)
  })
})
