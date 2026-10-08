// Reference solution, TODO 4: retry with error feedback (4.4).
// The follow-up request carries three things: the ORIGINAL document, the FAILED extraction, and the SPECIFIC
// errors. In the Messages API that is the original user turn, the assistant's tool_use, and a tool_result
// with is_error: true listing each issue.
import type Anthropic from "@anthropic-ai/sdk";
import type { Issue } from "./validate.js";

export function shouldRetry(issues: Issue[], attempt: number, maxAttempts = 2): boolean {
  // Retry only when every open issue is fixable from the document. One non-retryable issue means the record
  // goes to a human anyway, and a retry would only pressure the model to invent the missing value.
  return attempt < maxAttempts && issues.length > 0 && issues.every(i => i.retryable);
}

export function buildRetryMessages(
  firstTurn: Anthropic.MessageParam,   // the original user turn, which contains the document
  failed: Anthropic.ToolUseBlock,      // the tool_use block whose input failed validation
  issues: Issue[],
): Anthropic.MessageParam[] {
  const list = issues.map(i => `- ${i.field}: ${i.message}`).join("\n");
  return [
    firstTurn,
    { role: "assistant", content: [failed] },
    { role: "user", content: [{
      type: "tool_result", tool_use_id: failed.id, is_error: true,
      content:
        `The extraction failed validation:\n${list}\n\n` +
        `Re-read the document above and call ${failed.name} again with the corrected record. ` +
        `Fix only these fields; keep every other value. If the document really does not contain a value, use null. Never invent one.`,
    }] },
  ];
}
