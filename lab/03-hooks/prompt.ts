// Lesson 3 · TODO 5: the escalation policy (task 5.2).
// The hooks enforce what MUST happen. This prompt guides the judgment calls that a hook can't make:
// when to hand off, when to resolve, when to ask. Rewrite SYSTEM_PROMPT so it has:
//   • explicit escalation triggers: the customer asks for a human (escalate at once, no investigation first);
//     policy is ambiguous or silent on the request (e.g. matching a competitor's price); you can't make progress
//   • what is NOT a trigger: frustration alone (acknowledge it, offer to resolve, escalate only if they ask again)
//   • multiple account matches → ask for another identifier, never pick one
//   • at least 2 few-shot examples in <example> tags showing escalate vs resolve, each with a one-line reason
// `npm run l3:check` runs structure checks on it; `npm run l3:ask -- human` etc. show the behaviour.
export const SYSTEM_PROMPT = `You are the customer support agent for an online furniture store.
Help customers with orders, shipping and refunds using your tools.
Escalate difficult cases to a human when appropriate.`;
