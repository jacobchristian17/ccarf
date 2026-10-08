// Provided: turns your Zod schemas into Anthropic tool definitions.
// z.toJSONSchema() emits a few keywords that strict tool use / structured outputs reject (minimum and maximum
// from z.number().int(), the $schema URI), so they are stripped here. Everything else passes through unchanged.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

const UNSUPPORTED = new Set(["$schema", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "minLength", "maxLength"]);
function sanitize(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(sanitize);
  if (node && typeof node === "object")
    return Object.fromEntries(Object.entries(node).filter(([k]) => !UNSUPPORTED.has(k)).map(([k, v]) => [k, sanitize(v)]));
  return node;
}

export type ToolSpec = { name: string; description: string; schema: z.ZodType };

export function toTools(specs: readonly ToolSpec[]): Anthropic.Tool[] {
  return specs.map(s => ({
    name: s.name,
    description: s.description,
    input_schema: sanitize(z.toJSONSchema(s.schema)) as Anthropic.Tool.InputSchema,
    // STRICT=1 adds strict: true (API backend only; not verified in this lab, which runs without API credits).
    ...(process.env.STRICT ? { strict: true } : {}),
  }));
}
