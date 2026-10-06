// Generates a NEW quiz item on the same concept as one the learner missed, through `claude -p` on the
// Claude Code login. Grounded in the exam guide's own task-statement text; validated and shuffled in code.
import { spawn } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export type SourceItem = {
  quiz: string;            // e.g. "0006-decomposition-sessions-and-long-exploration"
  ts: string;              // data-ts, e.g. "1.7" or "5.3 · review"
  stem: string; options: string[]; correct: number[]; picked: number[]; explain: string;
  avoid?: string[];        // stems of variants already generated for this item
};
export type Variant = { ts: string; stem: string; options: string[]; correct: number[]; explain: string; concept: string };

const SECTIONS = join(import.meta.dirname, "..", "..", "md", "CCAR-F", "sections");

/** The exam guide's text for one task statement (Knowledge of / Skills in). */
export function taskStatement(ts: string): string {
  const num = ts.match(/\d+\.\d+/)?.[0];
  if (!num) return "";
  for (const f of readdirSync(SECTIONS).filter(f => /^(0[7-9]|1[01])-/.test(f))) {
    const text = readFileSync(join(SECTIONS, f), "utf8");
    const m = text.match(new RegExp(`### Task Statement ${num.replace(".", "\\.")}:[\\s\\S]*?(?=\\n### |$)`));
    if (m) return m[0].trim();
  }
  return "";
}

const Out = z.object({
  concept: z.string().min(3),
  stem: z.string().min(40),
  options: z.array(z.object({ text: z.string().min(5).max(110), correct: z.boolean() })),
  explain: z.string().min(60),
});
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["concept", "stem", "options", "explain"],
  properties: {
    concept: { type: "string", description: "The one idea this item tests, in under 12 words" },
    stem: { type: "string", description: "A new scenario ending in a question. Use `backticks` for code, no HTML" },
    options: { type: "array", items: { type: "object", additionalProperties: false, required: ["text", "correct"],
      properties: { text: { type: "string" }, correct: { type: "boolean" } } } },
    explain: { type: "string", description: "Why the correct option is right and why EACH distractor is wrong, citing the task statement" },
  },
};

const words = (s: string) => s.trim().split(/\s+/).length;

export function check(v: z.infer<typeof Out>, src: SourceItem): string[] {
  const issues: string[] = [];
  const n = src.options.length, k = src.correct.length;
  if (v.options.length !== n) issues.push(`Give exactly ${n} options (you gave ${v.options.length}).`);
  const nc = v.options.filter(o => o.correct).length;
  if (nc !== k) issues.push(`Mark exactly ${k} option(s) correct (you marked ${nc}).`);
  const w = v.options.map(o => words(o.text));
  if (Math.max(...w) - Math.min(...w) > 3) issues.push(`Options must be within 3 words of each other in length (yours: ${w.join(", ")} words). Rewrite them to match.`);
  const c = v.options.map(o => o.text.length);
  if (Math.max(...c) > Math.min(...c) * 1.45) issues.push(`Options must be similar in characters too (yours: ${c.join(", ")}). The correct one must not stand out by length.`);
  if (v.options.some(o => /all of the above|none of the above|both a and/i.test(o.text))) issues.push(`No "all/none of the above" options.`);
  if (new Set(v.options.map(o => o.text.toLowerCase())).size !== v.options.length) issues.push("Options must be distinct.");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "");
  if ([src.stem, ...(src.avoid ?? [])].some(s => norm(s).slice(0, 80) === norm(v.stem).slice(0, 80))) issues.push("The stem repeats an earlier question. Write a different scenario.");
  return issues;
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

const SYSTEM = `You write practice items for the Claude Certified Architect – Foundations exam (CCAR-F, exam guide v1.0, July 2026).
The exam guide is authoritative: when current product docs differ from it, the correct answer is the exam guide's answer.
Write scenario-based, single-best-answer items like the guide's sample questions: a realistic production situation, then a question about root cause, the best fix, or the proportionate first step.`;

export function buildPrompt(src: SourceItem): string {
  const L = "ABCDEFGH";
  const pickedText = src.picked.map(i => `${L[i]}. ${src.options[i]}`).join(" / ");
  return [
    `<task_statement>\n${taskStatement(src.ts) || `(task statement ${src.ts})`}\n</task_statement>`,
    `<missed_item ts="${src.ts}">\n${src.stem}\n${src.options.map((o, i) => `${L[i]}. ${o}${src.correct.includes(i) ? "   [correct]" : ""}`).join("\n")}\nExplanation: ${src.explain}\n</missed_item>`,
    `<learner_picked>${pickedText}</learner_picked>`,
    src.avoid?.length ? `<already_generated>\n${src.avoid.map(s => `- ${s}`).join("\n")}\n</already_generated>` : "",
    `Write ONE new item that tests the SAME concept as the missed item, so the learner gets another try at it.
Rules:
- A different scenario: change the domain, system and names (not a paraphrase of the missed item or of anything in <already_generated>).
- A different angle on the same concept: if the missed item asks for the best action, ask for the root cause, the failure you'd observe, or which situation calls for this move; or test the boundary case (when the move does NOT apply). Don't reuse the missed item's option wording or structure.
- Aim at the misconception behind what the learner picked: one distractor should be a fresh version of that wrong idea.
- Exactly ${src.options.length} options, exactly ${src.correct.length} correct${src.correct.length > 1 ? ` (the stem must end with "(Select ${src.correct.length})")` : ""}.
- Every distractor is plausible and matches a real anti-pattern from the task statement or the guide's heuristics (prompt-only fixes where code is needed, over-engineering, bigger context windows, generic statuses, and so on).
- All options within 3 words of each other in length and similar in characters. No absolute words that give the answer away. No "all of the above".
- The answer must follow from the task statement text above. Don't test product trivia it doesn't cover.
- The explanation says why the correct option is right and why each distractor is wrong, in 2-4 sentences.
- Plain text only. Use \`backticks\` for code or identifiers.`,
  ].filter(Boolean).join("\n\n");
}

function runClaude(prompt: string, model: string): Promise<unknown> {
  const args = ["-p", "--model", model, "--tools", "", "--strict-mcp-config", "--no-session-persistence",
    "--system-prompt", SYSTEM, "--output-format", "json", "--json-schema", JSON.stringify(SCHEMA)];
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { cwd: tmpdir(), stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", d => (out += d));
    child.stderr.on("data", d => (err += d));
    child.on("error", e => reject(new Error(`Could not start \`claude\`: ${e.message}`)));
    child.on("close", code => {
      try {
        const res = JSON.parse(out);
        if (res.is_error || !res.structured_output) reject(new Error(`claude -p failed: ${res.result ?? res.subtype}`));
        else resolve(res.structured_output);
      } catch { reject(new Error(`claude -p exited with code ${code}: ${(err || out).slice(0, 300)}`)); }
    });
    child.stdin.end(prompt);
  });
}

/** Generate, validate, and retry once with the issues as feedback. Shuffles option order in code. */
export async function generateVariant(src: SourceItem, model = process.env.QUIZ_MODEL ?? "sonnet"): Promise<Variant> {
  let prompt = buildPrompt(src);
  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    const parsed = Out.safeParse(await runClaude(prompt, model));
    const issues = parsed.success ? check(parsed.data, src) : parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`);
    if (parsed.success && !issues.length) {
      const clean = (s: string) => s.replace(/\\"/g, '"').trim();
      const opts = shuffle(parsed.data.options);
      return { ts: src.ts, stem: clean(parsed.data.stem), options: opts.map(o => clean(o.text)), correct: opts.flatMap((o, i) => (o.correct ? [i] : [])),
        explain: clean(parsed.data.explain), concept: parsed.data.concept };
    }
    lastIssues = issues;
    prompt = `${buildPrompt(src)}\n\nYour previous attempt was rejected:\n${issues.map(i => `- ${i}`).join("\n")}\nFix these and write the item again.`;
  }
  throw new Error(`Variant rejected twice: ${lastIssues.join(" ")}`);
}
