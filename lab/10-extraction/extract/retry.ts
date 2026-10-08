// TODO 4 (4.4): retry with error feedback.
// shouldRetry: retry only while attempt < maxAttempts and there ARE issues, and only if every issue is retryable.
//   (If one issue isn't retryable, the record goes to a human anyway. What would a retry do to po_number?)
// buildRetryMessages: the follow-up must carry (1) the original document, (2) the failed extraction and
// (3) the specific validation errors. In the Messages API that's three turns:
//   firstTurn  →  { role: "assistant", content: [failed] }  →  a user turn whose FIRST block is a
//   tool_result for failed.id, with is_error: true, listing each issue's field and message, and asking for a
//   corrected call to the same tool (null if the value really isn't in the document).
// The starter below is the naive version: no document, no failed extraction, no specifics.
import type Anthropic from "@anthropic-ai/sdk";
import type { Issue } from "./validate.js";

export function shouldRetry(_issues: Issue[], _attempt: number, _maxAttempts = 2): boolean {
  return false;
}

export function buildRetryMessages(
  _firstTurn: Anthropic.MessageParam,
  _failed: Anthropic.ToolUseBlock,
  _issues: Issue[],
): Anthropic.MessageParam[] {
  return [{ role: "user", content: "That extraction was wrong. Please try again." }];
}
