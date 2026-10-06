// Lesson 7: your team config, live through the Agent SDK on your Claude Code login.
// Each run copies fixture/tally + YOUR team/ overlay into a fresh temp repo, starts a project-scope
// session there (settingSources: ["project"], i.e. what a teammate gets from git, with no ~/.claude),
// and prints what loaded and why, from the InstructionsLoaded hook and getContextUsage().
// Run:  npm run l7:ask -- <command>
//   map              one session reads every source file in turn: which rules and CLAUDE.md files load, and when
//   load <file>      read one file (e.g. src/web/InvoiceList.test.tsx)
//   edit <file>      append a comment to one file (does an edit load anything a read didn't?)
//   ask "<q>"        no tools: what does the model know from startup memory alone?
//   skill [arg]      run /impact-scan <arg> (default toCents): tool calls in the main thread vs the subagent
//   guard            /impact-scan inline (fork stripped), then "save it to IMPACT.md", with Write allowed by the session:
//                    does allowed-tools stop the write? does disallowed-tools?
// Env:  SOLUTION=1 (solution/team) · NOFORK=1 (strip context: fork + agent: from the skill) · MODEL=haiku|sonnet
import { query, type HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const TEAM = join(HERE, process.env.SOLUTION ? "solution/team" : "team");
const MODEL = process.env.MODEL ?? "haiku";
const [cmd = "map", ...rest] = process.argv.slice(2);
const arg = rest.join(" ");
const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5) + "s";

// ── A fresh repo per run: fixture + your overlay (minus personal/, which is ~/.claude, not git) ──
const REPO = mkdtempSync(join(tmpdir(), "tally-"));
cpSync(join(HERE, "fixture/tally"), REPO, { recursive: true });
cpSync(TEAM, REPO, { recursive: true, filter: src => !relative(TEAM, src).startsWith("personal") });
execSync("git init -q", { cwd: REPO });
const SKILL = join(REPO, ".claude/skills/impact-scan/SKILL.md");
// guard always runs the skill inline: a forked skill would swallow the "save it" request as $ARGUMENTS.
const inline = !!process.env.NOFORK || cmd === "guard";
if (inline && existsSync(SKILL))
  writeFileSync(SKILL, readFileSync(SKILL, "utf8").replace(/\r\n/g, "\n").replace(/^(context|agent):.*\n/gm, ""));
const rel = (p?: string) => (p ? relative(REPO, p).split("\\").join("/") : "");

// ── Hook: print every instruction file that enters context after startup ──
const loads: string[] = [];
const onLoad: HookCallback = async input => {
  const i = input as { load_reason: string; file_path: string; trigger_file_path?: string; parent_file_path?: string; globs?: string[] };
  const why = i.load_reason === "path_glob_match" ? `paths ${JSON.stringify(i.globs ?? [])} matched ${rel(i.trigger_file_path)}`
    : i.load_reason === "nested_traversal" ? `Claude touched ${rel(i.trigger_file_path)}`
    : i.load_reason === "include" ? `@import in ${rel(i.parent_file_path)}` : i.load_reason;
  loads.push(rel(i.file_path));
  console.log(`${secs()}   ⤷ LOADED ${rel(i.file_path).padEnd(30)} ${i.load_reason.padEnd(17)} ${why}`);
  return {};
};

type Run = { text: string; main: number; sub: number; intoMain: number; denied: string[]; turns: number };
async function run(prompt: string, tools: string[], allowed: string[]): Promise<Run> {
  const r: Run = { text: "", main: 0, sub: 0, intoMain: 0, denied: [], turns: 0 };
  const q = query({
    prompt,
    options: {
      cwd: REPO, settingSources: ["project"], strictMcpConfig: true, model: MODEL, maxTurns: 20,
      tools, allowedTools: allowed,
      env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: "1" },
      hooks: { InstructionsLoaded: [{ hooks: [onLoad] }] },
    },
  });
  let started = false;
  for await (const m of q) {
    const parent = (m as { parent_tool_use_id?: string | null }).parent_tool_use_id;
    if (!started && m.type === "system" && m.subtype === "init") {
      started = true;
      const u = await q.getContextUsage();
      console.log(`${secs()}   startup memory (what /context lists): ${u.memoryFiles.map(f => `${rel(f.path)} (${f.type}, ${f.tokens} tok)`).join(", ") || "none"}`);
    }
    if (m.type === "system" && (m as { subtype: string }).subtype === "permission_denied")
      r.denied.push((m as unknown as { tool_name: string }).tool_name);
    if (m.type === "assistant") for (const b of m.message.content) {
      if (b.type !== "tool_use") continue;
      parent ? r.sub++ : r.main++;
      const i = b.input as { file_path?: string; skill?: string; args?: string };
      const what = i.file_path ? rel(i.file_path) : i.skill ? `${i.skill} ${i.args ?? ""}` : JSON.stringify(b.input).slice(0, 70);
      console.log(`${secs()}   ${parent ? "  subagent" : "main"} → ${b.name}(${what})`);
    }
    if (m.type === "user" && !parent) for (const b of (m.message.content ?? []) as { type?: string; content?: unknown; is_error?: boolean }[]) {
      if (b?.type !== "tool_result") continue;
      const c = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
      r.intoMain += c.length;
      if (b.is_error) console.log(`${secs()}   main ← ERROR ${c.slice(0, 90)}`);
    }
    if (m.type === "result") { r.text = m.subtype === "success" ? m.result : `(${m.subtype})`; r.turns = m.num_turns; }
  }
  return r;
}

const show = (r: Run) => console.log(`\n${secs()}   ${r.turns} turns · ${r.main} main-thread tool calls · ${r.sub} subagent calls · ${r.intoMain} chars of tool results in the main context${r.denied.length ? ` · DENIED: ${r.denied.join(", ")}` : ""}\n\n${r.text}\n`);
console.log(`L7 · ${cmd} · config: ${relative(HERE, TEAM)}${inline ? " (skill inline: context/agent stripped)" : ""} · model ${MODEL} · repo ${REPO}\n`);

const SOURCES = ["src/lib/money.ts", "src/api/invoices.ts", "src/web/InvoiceList.tsx", "src/api/invoices.test.ts",
  "src/web/InvoiceList.test.tsx", "packages/billing/src/tax.ts", "packages/billing/tests/tax.test.ts", "terraform/main.tf"];

switch (cmd) {
  case "map": {
    const r = await run(`Read these files one at a time, in this order, one Read call per turn: ${SOURCES.join(", ")}. Then reply with just the number of files you read.`, ["Read"], ["Read"]);
    show(r);
    console.log(`Loaded after startup: ${loads.length ? loads.join(", ") : "nothing"}`);
    break;
  }
  case "load":
  case "edit": {
    const file = arg || "src/web/InvoiceList.test.tsx";
    const r = cmd === "load"
      ? await run(`Read ${file} and reply with its first line only.`, ["Read"], ["Read"])
      : await run(`Append the comment line "// reviewed" to the end of ${file}. Reply DONE.`, ["Read", "Edit"], ["Read", "Edit"]);
    show(r);
    break;
  }
  case "ask":
    show(await run(arg || "Without using tools: list every rule you were given for (a) Terraform, (b) tests, (c) my personal answer style. Say 'none' where you have none.", [], []));
    break;
  case "skill":
    show(await run(`/impact-scan ${arg || "toCents"}`, ["Skill", "Agent", "Read", "Grep", "Glob"], ["Skill", "Read", "Grep", "Glob"]));
    break;
  case "guard": {
    const r = await run("/impact-scan toCents. After the scan, also save your summary to a new file IMPACT.md in the repo root.",
      ["Skill", "Agent", "Read", "Grep", "Glob", "Write", "Bash"], ["Skill", "Read", "Grep", "Glob", "Write"]);
    show(r);
    console.log(existsSync(join(REPO, "IMPACT.md")) ? "IMPACT.md WAS WRITTEN: nothing in the skill stopped it." : "IMPACT.md was not written.");
    break;
  }
  default:
    console.log("commands: map | load <file> | edit <file> | ask \"<q>\" | skill [arg] | guard");
}
