// A personal, experimental MCP server: a scratchpad for notes while you work. It belongs to one developer,
// so it is configured in their ~/.claude.json (user scope), never in the team's .mcp.json. You don't edit this file.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const FILE = join(tmpdir(), "ccarf-l8-scratchpad.txt");
const server = new McpServer({ name: "scratchpad", version: "0.0.1" });
server.registerTool("jot", {
  description: "Save a one-line note to the developer's personal scratchpad.",
  inputSchema: { note: z.string() },
}, async ({ note }) => { appendFileSync(FILE, note + "\n"); return { content: [{ type: "text", text: "saved" }] }; });
server.registerTool("jotted", {
  description: "Return every note in the developer's personal scratchpad.",
  inputSchema: {},
}, async () => ({ content: [{ type: "text", text: existsSync(FILE) ? readFileSync(FILE, "utf8") || "(empty)" : "(empty)" }] }));
await server.connect(new StdioServerTransport());
