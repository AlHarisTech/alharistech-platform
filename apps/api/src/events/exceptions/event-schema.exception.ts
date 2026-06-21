export class EventSchemaException extends Error {
  constructor(
    public readonly eventType: string,
    public readonly version: number,
    message: string,
  ) {
    super(`Event schema error '${eventType}:v${version}': ${message}`);
    this.name = 'EventSchemaException';
  }
}

export class EventSchemaCompilationException extends EventSchemaException {
  constructor(eventType: string, version: number, detail: string) {
    super(eventType, version, `Schema compilation failed: ${detail}`);
    this.name = 'EventSchemaCompilationException';
  }
}
