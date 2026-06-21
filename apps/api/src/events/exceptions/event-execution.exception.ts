export class EventExecutionException extends Error {
  constructor(
    public readonly eventId: string,
    public readonly eventType: string,
    public readonly attempt: number,
    message: string,
    public readonly cause?: Error,
  ) {
    super(`Event execution failed for '${eventType}' (id=${eventId}, attempt=${attempt}): ${message}`);
    this.name = 'EventExecutionException';
  }
}
