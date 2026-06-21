export class EventPublishException extends Error {
  constructor(
    public readonly eventType: string,
    message: string,
    public readonly cause?: Error,
  ) {
    super(`Event publish failed for '${eventType}': ${message}`);
    this.name = 'EventPublishException';
  }
}
