// Runs one prompt through Claude Code (`claude -p`, your Claude Code login, no API credits)
// with ONLY your MCP server's tools, and prints each tool call, result and reply.
// Run:  npm run l2:ask -- "I'm omar@example.com, where is order 99999?"
// Env:  SERVER=solution     use solution/server.ts instead of your server.ts
//       SYSTEM="..."        append a system prompt (for the keyword-sensitivity experiment)
//       MODEL=sonnet        any `claude --model` value (default: sonnet)
import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const prompt = process.argv.slice(2).join(" ") || "Hi, I'm jane@example.com. Where is order #12345?";
const server = process.env.SERVER === "solution" ? "02-mcp-tools/solution/server.ts" : "02-mcp-tools/server.ts";
const config = path.join(mkdtempSync(path.join(tmpdir(), "l2-")), "mcp.json");
writeFileSync(config, JSON.stringify({ mcpServers: { support: { command: "npx", args: ["tsx", server] } } }));

const args = [
  "-p", prompt,
  "--mcp-config", config, "--strict-mcp-config", // only this server
  "--tools", "",                                // no built-in tools (Bash, Read, …)
  "--allowedTools", "mcp__support__*",
  "--output-format", "stream-json", "--verbose",
  "--model", process.env.MODEL ?? "sonnet",
];
if (process.env.SYSTEM) args.push("--append-system-prompt", process.env.SYSTEM);

console.log(`[ask] ${server} · "${prompt}"\n`);
// No shell: a shell would split the prompt on spaces. stdin closed so `claude -p` doesn't wait for it.
const child = spawn("claude", args, { stdio: ["ignore", "pipe", "pipe"] });
let buf = "";
child.stdout.on("data", d => {
  buf += d;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) { show(buf.slice(0, i)); buf = buf.slice(i + 1); }
});
child.stderr.pipe(process.stderr);

function show(line: string) {
  let m: any;
  try { m = JSON.parse(line); } catch { return; }
  for (const b of m.message?.content ?? []) {
    if (b.type === "tool_use") console.log(`→ ${b.name.replace("mcp__support__", "")}(${JSON.stringify(b.input)})`);
    if (b.type === "tool_result") {
      const text = Array.isArray(b.content) ? b.content.map((c: any) => c.text ?? "").join("") : String(b.content);
      console.log(`  ${b.is_error ? "✗ isError" : "✓"} ${text.slice(0, 220)}`);
    }
    if (b.type === "text" && m.type === "assistant") console.log(`\n${b.text}\n`);
  }
  if (m.type === "result") console.log(`[ask] done · ${m.num_turns} turns · ${m.subtype}`);
}
