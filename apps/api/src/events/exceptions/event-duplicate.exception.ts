export class EventDuplicateException extends Error {
  constructor(
    public readonly eventId: string,
    public readonly eventType: string,
  ) {
    super(`Duplicate event detected: '${eventType}' (id=${eventId}) — skipping execution`);
    this.name = 'EventDuplicateException';
  }
}
