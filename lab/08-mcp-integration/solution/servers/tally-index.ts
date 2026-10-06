// Lesson 8 reference: the tally-index MCP server (stdio), with the two TODOs done.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SCHEMA, authError, findReferences, schemaMarkdown } from "../../servers/core.js";

// Server instructions go into the system prompt of every session that connects, even while the tools themselves
// are deferred behind tool search. Use them for when-to-use-this-server guidance (reality lever; the exam talks about descriptions).
const server = new McpServer({ name: "tally-index", version: "1.0.0" }, { instructions:
  "tally-index knows the tally codebase and database. For any question about who calls a function or what a change " +
  "would break, use find_references instead of Grep: it follows re-export aliases and wrapper functions that text " +
  "search misses. For the database, read the tally://schema resource before calling describe_table." });
const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });

// Auth (core.ts): every tool refuses with a permission error until TALLY_INDEX_TOKEN is a real token.
const denied = (): CallToolResult | null => { const e = authError(); return e ? { isError: true, content: [{ type: "text", text: JSON.stringify({ errorCategory: "permission", isRetryable: false, message: e }) }] } : null; };

// TODO 3 (done): a description that says what the tool does that Grep can't, what it returns, and when to use it.
server.registerTool("find_references", {
  description:
    "Find every call site of a TypeScript function across the tally repo, including calls made through " +
    "re-export aliases (export { toCents as parseAmount }) and thin wrapper functions (amountToCents → toCents). " +
    "Plain text search (Grep) misses those indirect callers. Use this instead of Grep whenever the question is " +
    "'who calls X', 'what breaks if I change X', or 'find all usages of X'. " +
    "Input: the exported function name. Returns: the set of names it resolved (with how each relates to the " +
    "original), then one line per call site as file:line, the name used there, and the source line. " +
    "Does not search comments, strings or non-TypeScript files: use Grep for those.",
  inputSchema: { symbol: z.string().describe("Exported function name, e.g. toCents") },
  annotations: { readOnlyHint: true }, // reality: lets plan mode call it (unannotated MCP tools are blocked there)
}, async ({ symbol }) => {
  const no = denied(); if (no) return no;
  const { names, refs } = findReferences(symbol);
  return text([
    "Resolved names:", ...Object.entries(names).map(([n, why]) => `  ${n}: ${why}`),
    `Call sites (${refs.length}):`, ...refs.map(r => `  ${r.file}:${r.line}  [${r.via}]  ${r.text}`),
  ].join("\n"));
});

server.registerTool("list_tables", {
  description: "List the table names in the tally Postgres database. Names only, no columns.",
  inputSchema: {},
  annotations: { readOnlyHint: true },
}, async () => denied() ?? text(Object.keys(SCHEMA).join("\n")));

server.registerTool("describe_table", {
  description: "Columns of one tally database table: name, type and a note. Call list_tables first if you don't know the name.",
  inputSchema: { table: z.string() },
  annotations: { readOnlyHint: true },
}, async ({ table }) => {
  const no = denied(); if (no) return no;
  const t = SCHEMA[table];
  if (!t) return { isError: true, content: [{ type: "text", text: `No table "${table}". Known: ${Object.keys(SCHEMA).join(", ")}` }] };
  return text(t.columns.map(([c, ty, note]) => `${c} ${ty}${note ? ` (${note})` : ""}`).join("\n"));
});

// TODO 4 (done): the whole schema as one readable catalog, so the agent sees what exists without exploring.
server.registerResource("schema", "tally://schema", {
  title: "tally database schema",
  description: "Every table in the tally Postgres database with all columns, types and notes (money columns, foreign keys, units). Read this before querying or describing tables.",
  mimeType: "text/markdown",
}, async uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: schemaMarkdown() }] }));

await server.connect(new StdioServerTransport());
