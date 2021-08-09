import * as Entitlements from './entitlements'

it('should expose srUserEntitled entitlement name', () => {
  expect(Entitlements.userEntitled).toEqual('sudoplatform.sr.srUserEntitled')
})
