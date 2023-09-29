import fs from 'fs'
import path from 'path'

import {
  DefaultConfigurationManager,
  DefaultSudoKeyManager,
  KeyDataKeyType,
  SudoKeyManager,
} from '@sudoplatform/sudo-common'
import { Entitlement } from '@sudoplatform/sudo-entitlements'
import {
  DefaultSudoEntitlementsAdminClient,
  ExternalUserEntitlements,
  SudoEntitlementsAdminClient,
} from '@sudoplatform/sudo-entitlements-admin'
import {
  DefaultSudoUserClient,
  SudoUserClient,
  TESTAuthenticationProvider,
} from '@sudoplatform/sudo-user'
import { WebSudoCryptoProvider } from '@sudoplatform/sudo-web-crypto-provider'
import * as dotenv from 'dotenv'
import { sortBy, uniqBy } from 'lodash'

import { requireEnv } from '../../utils/require-env'
import { logger } from './logger'

dotenv.config()

interface Env {
  REGISTER_KEY: string
  REGISTER_KEY_ID: string
  SDK_CONFIG: string
}

export const SR_ENTITLEMENT_NAME = 'sudoplatform.sr.srUserEntitled'

export function loadEnv(): Env {
  const env: Partial<Env> = {}
  Object.keys(process.env)
    .sort()
    .filter((key) => key.startsWith('config_'))
    .forEach((key) => {
      const path = key.replace(/^config_/, '')
      const value = process.env[key]
      env[path] = mapConfigValue(value)
    })
  return env as Env
}

function mapConfigValue(value: unknown): string {
  // If value is a path, resolve HOME
  if (typeof value === 'string' && value[0] === '~') {
    value = path.join(process.env.HOME ?? './', value.slice(1))
  }

  // If a file exists for that path, use the file contents as the value
  if (typeof value === 'string' && fs.existsSync(value)) {
    value = fs.readFileSync(path.resolve(value)).toString('utf-8').trim()
  }

  return value as string
}

const loaded = loadEnv()
const env = requireEnv({
  REGISTER_KEY: {
    type: 'string',
    default: loaded.REGISTER_KEY,
  },
  REGISTER_KEY_ID: {
    type: 'string',
    default: loaded.REGISTER_KEY_ID,
  },
  SDK_CONFIG: {
    type: 'string',
    default: loaded.SDK_CONFIG,
  },
})

export const sdkConfig = {
  ...JSON.parse(env.SDK_CONFIG),
  federatedSignIn: {
    appClientId: 'n/a',
    refreshTokenLifetime: 0,
    signInRedirectUri: 'n/a',
    signOutRedirectUri: 'n/a',
    webDomain: 'n/a',
    identityProvider: 'n/a',
  },
}

DefaultConfigurationManager.getInstance().setConfig(JSON.stringify(sdkConfig))

const testAuthProvider = new TESTAuthenticationProvider(
  'system-test',
  env.REGISTER_KEY,
  env.REGISTER_KEY_ID,
)

const adminEnv = requireEnv({
  ADMIN_API_KEY: { type: 'string' },
})

export async function registerUser(): Promise<{
  keyManager: SudoKeyManager
  userClient: SudoUserClient
  entitlementAdminClient: SudoEntitlementsAdminClient
}> {
  const cryptoProvider = new WebSudoCryptoProvider('ns', 'sr-service')
  const keyManager = new DefaultSudoKeyManager(cryptoProvider)
  const userClient = new DefaultSudoUserClient({
    sudoKeyManager: keyManager,
    logger,
  })
  const entitlementAdminClient = new DefaultSudoEntitlementsAdminClient(
    adminEnv.ADMIN_API_KEY,
  )

  // Register
  await userClient.registerWithAuthenticationProvider(testAuthProvider)
  await userClient.signInWithKey()

  // Add entitlements
  const externalId = (await userClient.getUserName()) ?? ''
  await entitlementAdminClient.applyEntitlementsToUser(externalId, [
    { name: SR_ENTITLEMENT_NAME, value: 1 },
  ])

  return { userClient, keyManager, entitlementAdminClient }
}

export async function invalidateAuthTokens(
  keyManager: SudoKeyManager,
  userClient: SudoUserClient,
): Promise<void> {
  // Get current tokens
  const keyData = await keyManager.exportKeys()

  // Do global signout to invalidate the tokens
  await userClient.globalSignOut() // this clears auth store

  // Set tokens back
  keyData.map((value) => {
    switch (value.type) {
      case KeyDataKeyType.SymmetricKey:
        void keyManager.addSymmetricKey(value.data, value.name)
        break
      case KeyDataKeyType.RSAPublicKey:
        void keyManager.addPublicKey(value.data, value.name)
        break
      case KeyDataKeyType.RSAPrivateKey:
        void keyManager.addPrivateKey(value.data, value.name)
        break
      case KeyDataKeyType.Password:
        void keyManager.addPassword(value.data, value.name)
        break
      default:
        throw new Error(`Unknown KeyDataKeyType: ${value.type}`)
    }
  })
}

export async function removeEntitlementsByName(
  externalId: string,
  entitlementNamesToRemove: string[],
  entitlementAdminClient: SudoEntitlementsAdminClient,
): Promise<void> {
  const { entitlements } = await entitlementAdminClient.getEntitlementsForUser(
    externalId,
  )
  const updatedEntitlements = entitlements.entitlements.filter(
    (userEntitlement) =>
      !entitlementNamesToRemove.some(
        (entitlementNameToRemove) =>
          entitlementNameToRemove === userEntitlement.name,
      ),
  )
  await entitlementAdminClient.applyEntitlementsToUser(
    externalId,
    updatedEntitlements,
  )
}

export async function updateEntitlements(
  externalId: string,
  entitlementsToUpdate: Entitlement[],
  entitlementAdminClient: SudoEntitlementsAdminClient,
): Promise<ExternalUserEntitlements> {
  const userEntitlements = await entitlementAdminClient.getEntitlementsForUser(
    externalId,
  )

  const existingEntitlements = (
    userEntitlements.entitlements.entitlements ?? []
  ).map((e) => ({
    name: e.name,
    value: e.value,
  }))

  const entitlementsToApply = sortBy(
    uniqBy(
      [...entitlementsToUpdate, ...existingEntitlements],
      (entitlement) => entitlement.name,
    ),
    'name',
  )

  return entitlementAdminClient.applyEntitlementsToUser(
    externalId,
    entitlementsToApply,
  )
}
