// Shared logic for the tally-index MCP server. You don't edit this file: the TODOs are in tally-index.ts.
// It provides the database schema, and an alias-aware reference finder that follows re-exports
// (`export { toCents as parseAmount }`) and thin wrappers (`const amountToCents = s => toCents(s.trim())`).
// Grep for "toCents" finds neither the aliased call sites nor the wrapper's callers.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const SCHEMA: Record<string, { purpose: string; columns: [string, string, string][] }> = {
  invoices: { purpose: "One row per invoice", columns: [
    ["id", "text", "primary key, e.g. inv_0042"], ["customer_id", "text", "→ customers.id"],
    ["total_cents", "integer", "gross total in integer cents"], ["currency", "char(3)", "ISO 4217, default USD"],
    ["status", "text", "draft | sent | paid"], ["issued_at", "timestamptz", "null while draft"]] },
  line_items: { purpose: "Lines on an invoice", columns: [
    ["id", "text", "primary key"], ["invoice_id", "text", "→ invoices.id"], ["description", "text", ""],
    ["qty", "integer", ""], ["unit_cents", "integer", "net unit price in cents"],
    ["vat_rate_bp", "integer", "VAT rate actually applied, in basis points (2000 = 20%)"]] },
  customers: { purpose: "Billing customers", columns: [
    ["id", "text", "primary key"], ["name", "text", ""], ["country", "char(2)", "ISO 3166-1"],
    ["vat_id", "text", "null for consumers"]] },
  tax_rates: { purpose: "Default VAT rate per country, versioned", columns: [
    ["country", "char(2)", "→ customers.country"], ["rate_bp", "integer", "basis points"],
    ["valid_from", "date", "rate applies from this date"]] },
};

export function schemaMarkdown(): string {
  return ["# tally database schema (Postgres)", "",
    ...Object.entries(SCHEMA).flatMap(([t, s]) => [`## ${t}: ${s.purpose}`,
      ...s.columns.map(([c, ty, note]) => `- ${c} ${ty}${note ? `: ${note}` : ""}`), ""])].join("\n");
}

const root = () => process.env.TALLY_ROOT ?? process.cwd();
function sources(d = root()): string[] {
  if (!existsSync(d)) return [];
  return readdirSync(d).flatMap(n => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(d, n);
    return statSync(p).isDirectory() ? sources(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

export type Ref = { file: string; line: number; via: string; text: string };
export function findReferences(symbol: string): { names: Record<string, string>; refs: Ref[] } {
  const files = sources().map(p => ({ file: relative(root(), p).split("\\").join("/"), lines: readFileSync(p, "utf8").split(/\r?\n/) }));
  const names: Record<string, string> = { [symbol]: "the symbol itself" };
  // Grow the name set until it stops changing: re-export aliases, then wrappers that call any known name.
  for (let changed = true; changed;) {
    changed = false;
    for (const { file, lines } of files) for (const l of lines) {
      for (const m of l.matchAll(/(\w+)\s+as\s+(\w+)/g))
        if (names[m[1]] && !names[m[2]] && /export|import/.test(l)) { names[m[2]] = `alias of ${m[1]} (${file})`; changed = true; }
      const w = l.match(/export\s+(?:const|function)\s+(\w+)/);
      if (w && !names[w[1]] && Object.keys(names).some(n => new RegExp(`\\b${n}\\(`).test(l))) { names[w[1]] = `wrapper around ${Object.keys(names).find(n => new RegExp(`\\b${n}\\(`).test(l))} (${file})`; changed = true; }
    }
  }
  const refs: Ref[] = [];
  for (const { file, lines } of files) lines.forEach((l, i) => {
    for (const n of Object.keys(names)) if (new RegExp(`\\b${n}\\(`).test(l) && !/export\s+function\s+/.test(l)) {
      refs.push({ file, line: i + 1, via: n, text: l.trim() });
      break;
    }
  });
  return { names, refs };
}

// Auth: the token arrives through the env block in .mcp.json. If the developer never set the variable, Claude Code
// passes the reference through unexpanded, so the server receives the literal text "${TALLY_INDEX_TOKEN}".
export function authError(): string | null {
  const t = process.env.TALLY_INDEX_TOKEN;
  if (!t) return "TALLY_INDEX_TOKEN is not set. Check the env block of the tally-index entry in .mcp.json.";
  if (t.startsWith("${")) return `TALLY_INDEX_TOKEN arrived as the literal text "${t}": the variable was not set in the developer's environment when Claude Code started. Set it in the shell, then restart the session.`;
  return /^tk_\w+$/.test(t) ? null : "TALLY_INDEX_TOKEN is malformed (expected tk_…).";
}
