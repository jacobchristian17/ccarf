// Serves the course over http://localhost so quizzes can ask for a fresh question on a topic you missed.
// Run (in lab/):  npm run quiz        then open the URL it prints.
// Env:  QUIZ_MODEL=sonnet|opus|haiku (default sonnet) · QUIZ_PORT (default 4317)
// Every generated item is appended to assets/variants/<quiz>.json, so you can review what was generated.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, normalize, sep } from "node:path";
import { generateVariant, type SourceItem } from "./variant.js";

const ROOT = normalize(join(import.meta.dirname, "..", ".."));
const VARIANTS = join(ROOT, "assets", "variants");
const PORT = Number(process.env.QUIZ_PORT ?? 4317);
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".png": "image/png", ".md": "text/plain; charset=utf-8", ".pdf": "application/pdf" };

const send = (res: import("node:http").ServerResponse, code: number, body: string, type = "application/json") => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body);
};

function record(quiz: string, entry: unknown) {
  if (!/^[\w-]+$/.test(quiz)) return;
  mkdirSync(VARIANTS, { recursive: true });
  const file = join(VARIANTS, `${quiz}.json`);
  const all = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  all.push(entry);
  writeFileSync(file, JSON.stringify(all, null, 2));
}

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/api/health") return send(res, 200, JSON.stringify({ ok: true }));
  if (url.pathname === "/api/variant" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) body += chunk;
    const t0 = Date.now();
    try {
      const src = JSON.parse(body) as SourceItem;
      console.log(`→ variant for ${src.quiz} · ${src.ts} (picked ${src.picked.map(i => "ABCDEFGH"[i]).join(",")})`);
      const v = await generateVariant(src);
      record(src.quiz, { at: new Date().toISOString(), from: src.stem.slice(0, 120), ...v });
      console.log(`  ✓ ${((Date.now() - t0) / 1000).toFixed(1)} s · ${v.concept}`);
      return send(res, 200, JSON.stringify(v));
    } catch (e) {
      console.log(`  ✗ ${(e as Error).message}`);
      return send(res, 500, JSON.stringify({ error: (e as Error).message }));
    }
  }
  // Static files from the course root, no traversal outside it.
  const path = normalize(join(ROOT, decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname)));
  if (!path.startsWith(ROOT + sep) && path !== ROOT) return send(res, 403, "forbidden", "text/plain");
  if (!existsSync(path) || !statSync(path).isFile()) return send(res, 404, "not found", "text/plain");
  send(res, 200, readFileSync(path) as unknown as string, TYPES[extname(path)] ?? "application/octet-stream");
}).listen(PORT, "127.0.0.1", () => {
  console.log(`CCAR-F course with live quiz variants: http://localhost:${PORT}/`);
  console.log(`Model: ${process.env.QUIZ_MODEL ?? "sonnet"} via claude -p (your Claude Code login). Ctrl+C to stop.`);
});
