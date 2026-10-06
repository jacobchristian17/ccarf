// Lesson 8 lab: the tally-index MCP server (stdio). Two TODOs: a description that beats Grep, and a resource.
// Grade it:  npm run l8:check        Use it live:  npm run l8:ask -- refs | schema   (see the lesson)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { SCHEMA, authError, findReferences, schemaMarkdown } from "./core.js";

const server = new McpServer({ name: "tally-index", version: "1.0.0" });
const text = (t: string): CallToolResult => ({ content: [{ type: "text", text: t }] });

// Auth (core.ts): every tool refuses with a permission error until TALLY_INDEX_TOKEN is a real token.
const denied = (): CallToolResult | null => { const e = authError(); return e ? { isError: true, content: [{ type: "text", text: JSON.stringify({ errorCategory: "permission", isRetryable: false, message: e }) }] } : null; };

// TODO 3 — This description is what the model reads when it chooses between this tool and its built-in Grep.
//          Say what it does that Grep can't (aliases, wrappers), what it returns, when to use it, and when not to.
//          Then the reality lever: today MCP tools are deferred behind tool search, so the model sees only the tool's
//          NAME until it searches. Server instructions are always in the system prompt. Pass them as the second
//          argument: new McpServer({ name, version }, { instructions: "…when to use find_references…" }).
//          And plan mode refuses MCP tools that aren't marked read-only: add annotations: { readOnlyHint: true }
//          to all three tools (none of them changes anything).
server.registerTool("find_references", {
  description: "Find references.",
  inputSchema: { symbol: z.string().describe("Exported function name, e.g. toCents") },
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
}, async () => denied() ?? text(Object.keys(SCHEMA).join("\n")));

server.registerTool("describe_table", {
  description: "Columns of one tally database table: name, type and a note. Call list_tables first if you don't know the name.",
  inputSchema: { table: z.string() },
}, async ({ table }) => {
  const no = denied(); if (no) return no;
  const t = SCHEMA[table];
  if (!t) return { isError: true, content: [{ type: "text", text: `No table "${table}". Known: ${Object.keys(SCHEMA).join(", ")}` }] };
  return text(t.columns.map(([c, ty, note]) => `${c} ${ty}${note ? ` (${note})` : ""}`).join("\n"));
});

// TODO 4 — Expose the whole schema as one MCP resource, so the agent can see every table and column without
//          calling list_tables and then describe_table once per table. Use server.registerResource with the URI
//          tally://schema, a title, a description of what's in it, mimeType "text/markdown", and schemaMarkdown()
//          (from core.ts) as the text. The grader reads it back over MCP.
void schemaMarkdown;

await server.connect(new StdioServerTransport());
