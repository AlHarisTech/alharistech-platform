export class DlqRoutingException extends Error {
  constructor(
    public readonly eventId: string,
    public readonly eventType: string,
    public readonly queueName: string,
    message: string,
    public readonly cause?: Error,
  ) {
    super(`DLQ routing failed for '${eventType}' (id=${eventId}, queue=${queueName}): ${message}`);
    this.name = 'DlqRoutingException';
  }
}
