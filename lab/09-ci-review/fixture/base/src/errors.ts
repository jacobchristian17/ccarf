export class NotFoundError extends Error {}
export class ValidationError extends Error {}

export type Err = { ok: false; error: string };
export const err = (error: string): Err => ({ ok: false, error });
