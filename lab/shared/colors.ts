// ANSI colours for grader output. Off when piped (no TTY) or NO_COLOR is set; FORCE_COLOR turns them on.
const enabled = !process.env.NO_COLOR && (process.stdout.isTTY || !!process.env.FORCE_COLOR);
const paint = (code: number) => (s: string) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : s);

export const green = paint(32);
export const red = paint(31);
