// Offline stand-in for BACKEND=mock. NOT a model: it replays fixture/truth.json with scripted first-attempt
// faults, so the validate-retry loop has something to catch without any usage:
//   d03  invoice_date left as "07.09.2026"          (format error: retry fixes it)
//   d04  conflict_detected false on a 2,040 vs 1,940 (semantic error: retry fixes it)
//   d10  calculated_total_cents leaves out the tax   (semantic error: retry fixes it)
//   d05  po_number null, which is correct. If a retry asks for po_number anyway, the mock invents one,
//        the way a pressured model can.
//   d07  with tool_choice auto, replies in prose ("this is a quotation") instead of calling a tool.
import type Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const TRUTH = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixture/truth.json"), "utf8"));
let n = 0;
const text = (m: Anthropic.MessageParam) =>
  typeof m.content === "string" ? m.content
    : m.content.map(b => (b.type === "text" ? b.text : b.type === "tool_result" ? String(b.content) : "")).join("\n");

export function createMockClient(): Anthropic {
  const create = async (p: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message> => {
    const id = text(p.messages[0]).match(/<document id="(d\d+)"/)?.[1] ?? "d01";
    const t = TRUTH[id];
    const retry = p.messages.length > 1;
    const feedback = retry ? text(p.messages.at(-1)!) : "";
    const out = structuredClone(t.expect);
    let content: Anthropic.ContentBlock[];
    if (!retry && id === "d07" && (p.tool_choice?.type ?? "auto") === "auto") {
      content = [{ type: "text", text: "This is a quotation, not an invoice, so there is nothing to record yet.", citations: null } as Anthropic.TextBlock];
    } else {
      if (!retry && id === "d03") out.invoice_date = "07.09.2026";
      if (!retry && id === "d04") { out.conflict_detected = false; out.conflict_detail = null; }
      if (!retry && id === "d10") out.calculated_total_cents = 58600;
      if (retry && id === "d05" && /po_number/.test(feedback)) out.po_number = "PO-7781";
      content = [{ type: "tool_use", id: `toolu_mock_${++n}`, name: t.tool, input: out } as Anthropic.ToolUseBlock];
    }
    return { id: `msg_mock_${n}`, type: "message", role: "assistant", model: "mock", content,
      stop_reason: content[0].type === "tool_use" ? "tool_use" : "end_turn", stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 } } as unknown as Anthropic.Message;
  };
  return { messages: { create } } as unknown as Anthropic;
}
