// Reference solution, TODO 2: tool_choice (4.3).
// Two extraction tools, and the document type is unknown until the model reads it. "any" guarantees a tool
// call (no prose reply to parse) while leaving the model to pick WHICH schema fits.
// {type:"tool", name:"extract_invoice"} would force invoices onto credit notes too.
// Current reality: "any" and "tool" return a 400 on Opus 5.5 / Sonnet 5.5 / Fable 5.1. There you use "auto"
// + strict tools (or structured outputs). The claude-cli backend emulates tool_choice in the prompt.
import type Anthropic from "@anthropic-ai/sdk";

export const toolChoice: Anthropic.ToolChoice = { type: "any" };
