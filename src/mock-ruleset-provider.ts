import { RulesetContent, RulesetProvider } from './ruleset-provider'
import { RulesetType } from './ruleset-type'

export const mockRuleset1 = {
  rulesetType: RulesetType.MALWARE,
  location: 'list1',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['buybuybuy.com', 'federation.com', 'romulan.com'],
}

export const mockRuleset2 = {
  rulesetType: RulesetType.PHISHING,
  location: 'list2',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['buybuybuy.com', 'worf.org', 'data.ninja'],
}

export const mockRuleset3 = {
  rulesetType: RulesetType.MALWARE,
  location: 'list3',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['sellsellsell.com', 'republic.com', 'vulcan.com'],
}

export const mockRuleset4 = {
  rulesetType: RulesetType.PHISHING,
  location: 'list4',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['sellsellsell.com', 'spock.org', 'jean.ninja'],
}

export class MockRuleSetProvider implements RulesetProvider {
  public malwareRuleset = mockRuleset1
  public phishingRuleset = mockRuleset2

  async downloadRuleset(
    rulesetType: RulesetType,
    cacheKey?: string,
  ): Promise<RulesetContent | 'not-modified'> {
    const ruleset =
      rulesetType === RulesetType.MALWARE
        ? this.malwareRuleset
        : this.phishingRuleset
    if (cacheKey === ruleset.location) {
      return 'not-modified'
    }

    return {
      data: ruleset._rules.join('\n'),
      cacheKey: ruleset.location,
    }
  }

  async listAvailableRulesets(): Promise<string[]> {
    return ['list1', 'list2']
  }
}
