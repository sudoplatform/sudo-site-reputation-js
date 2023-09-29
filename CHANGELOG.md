## 6.0.0

### New

- Update to node 18
- Added support for additional site reputation categories from the API response.

### Breaking

- Removed legacy site reputation client and associated files.

## 5.0.1

### Fixes

- Returns `InsufficientEntitlementsError` if the user has not redeemed entitlements.
- Updates nonbreaking dependencies.

## 5.0.0

#### Enhancements

- **BREAKING** `SudoSiteReputationClient` renamed to `LegacySudoSiteReputationClient`
  - Old types prefixed with `Legacy`
- New `SudoSiteReputationClient` with simplified `SiteReputation` response
- `SudoSiteReputationClient` now uses `idb-storage-provider` to cache responses from our api
- `SudoSiteReputationClient` now has a `reset` function you can use to reset the cache
- Updates dependencies

#### Upgrade Path

- Rename current `SudoSiteReputationClient` to `LegacySudoSiteReputationClient` along with any legacy types
  or
- Consume simplified `SiteReputation` response from new api client

#### Fixes
