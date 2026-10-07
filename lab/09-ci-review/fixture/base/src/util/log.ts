export function log(event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), event, ...data });
  process.stdout.write(line + "\n");
}
