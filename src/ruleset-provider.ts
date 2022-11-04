import { RulesetType } from './ruleset-type'

/**
 * Ruleset meta data.
 */
export interface RulesetMetaData {
  rulesetType: RulesetType
  location: string
  updatedAt: Date
}

/**
 * The data result of downloading a rule set.
 */
export interface RulesetContent {
  data: string
  cacheKey?: string
}

/**
 * A provider that manages downloading and providing available lists for consumption.
 */
export interface RulesetProvider {
  /**
   * Downloads rule set if cacheKey is valid.
   * @param cacheKey A key that determines whether or not to download Ruleset.
   */
  downloadRuleset(
    rulesetType: RulesetType,
    cacheKey?: string,
  ): Promise<RulesetContent | 'not-modified'>

  /**
   * Downloads the metadata of all available rulesets and returns a list of keys
   * which can be used to download the rulesets by type
   */
  listAvailableRulesets(): Promise<string[]>
}
