import * as t from 'io-ts'

const identityService = t.type({
  region: t.string,
  poolId: t.string,
  identityPoolId: t.string,
})

const siteReputationService = t.type({
  bucket: t.string,
  region: t.string,
})

/**
 * The portion of the SDK Config that is required by SR client.
 */
export const IotsConfig = t.type({
  identityService,
  siteReputationService,
})

/**
 * The SDK Config required for {@link SudoSiteReputationClient}.
 * @see https://docs.sudoplatform.com/guides/getting-started#step-2-download-the-sdk-configuration-file
 */
export type Config = t.TypeOf<typeof IotsConfig>
