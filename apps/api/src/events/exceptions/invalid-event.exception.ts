export class InvalidEventException extends Error {
  public readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(
    public readonly eventType: string,
    message: string,
    validationErrors: Array<{ field: string; message: string }> = [],
  ) {
    super(`Invalid event '${eventType}': ${message}`);
    this.name = 'InvalidEventException';
    this.validationErrors = validationErrors;
  }
}
