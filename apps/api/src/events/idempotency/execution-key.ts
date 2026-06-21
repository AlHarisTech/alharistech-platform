export function buildExecutionKey(eventType: string, eventId: string): string {
  return `exec:${eventType}:${eventId}`;
}

export function parseExecutionKey(key: string): { eventType: string; eventId: string } | null {
  const parts = key.split(':');
  if (parts.length < 3 || parts[0] !== 'exec') return null;
  return { eventType: parts[1], eventId: parts.slice(2).join(':') };
}
