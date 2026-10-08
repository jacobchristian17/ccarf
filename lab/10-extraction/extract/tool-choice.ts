// TODO 2 (4.3): tool_choice. There are two extraction schemas, and the document type is unknown until the model
// reads the document. Which setting guarantees a tool call while still letting the model pick the schema?
//   { type: "auto" }                              the model may answer in prose instead
//   { type: "any" }                               must call a tool, chooses which
//   { type: "tool", name: "extract_invoice" }     must call THIS tool
// Run `npm run l10:ask -- choice` before and after you change it.
import type Anthropic from "@anthropic-ai/sdk";

export const toolChoice: Anthropic.ToolChoice = { type: "auto" };
