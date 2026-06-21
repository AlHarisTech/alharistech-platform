export class EventScheduleException extends Error {
  constructor(
    public readonly eventType: string,
    public readonly delayMs: number,
    message: string,
    public readonly cause?: Error,
  ) {
    super(`Event schedule failed for '${eventType}' (delay=${delayMs}ms): ${message}`);
    this.name = 'EventScheduleException';
  }
}
