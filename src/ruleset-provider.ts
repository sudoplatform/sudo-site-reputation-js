import { RulesetType } from './ruleset-type'

/**
 * Ruleset meta data.
 */
export interface RulesetMetaData {
  type: RulesetType
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

export interface RulesetProvider {
  /**
   * Downloads rule set if cacheKey is valid.
   * @param cacheKey A key that determines whether or not to download Ruleset.
   */
  downloadRuleset(cacheKey?: string): Promise<RulesetContent | 'not-modified'>
}
