import { RulesetContent, RulesetProvider } from './ruleset-provider'
import { RulesetType } from './ruleset-type'

export const mockRuleset1 = {
  type: RulesetType.MALICIOUSDOMAIN,
  location: 'list1',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['buybuybuy.com', 'federation.com', 'romulan.com'],
}

export const mockRuleset2 = {
  type: RulesetType.MALICIOUSDOMAIN,
  location: 'list2',
  updatedAt: new Date('2020-01-01T00:00:00Z'),
  _rules: ['buybuybuy.com', 'worf.org', 'data.ninja'],
}

export class MockRuleSetProvider implements RulesetProvider {
  public ruleset = mockRuleset1

  async downloadRuleset(
    cacheKey?: string,
  ): Promise<RulesetContent | 'not-modified'> {
    if (cacheKey === this.ruleset.location) {
      return 'not-modified'
    }

    return {
      data: this.ruleset._rules.join('\n'),
      cacheKey: this.ruleset.location,
    }
  }
}
