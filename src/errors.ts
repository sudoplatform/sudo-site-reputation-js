export class ReputationDataNotPresentError extends Error {
  constructor() {
    super(
      'Reputation data is not present. Call `update` to obtain the latest reputation data.',
    )
    this.name = 'ReputationDataNotPresentError'
  }
}
