export function log(event: string, data: Record<string, unknown> = {}): void {
  const entry = JSON.stringify({ t: new Date().toISOString(), event, ...data });
  process.stdout.write(entry + "\n");
}
