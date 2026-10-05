// Lesson 4 · TODO 2: the coordinator (task statements 1.2 and 1.3).
//
// 2a · COORDINATOR_TOOLS: the built-in tools the coordinator itself can use. To spawn subagents it needs
//      the subagent tool: "Agent" today ("Task" in the exam guide; the SDK still accepts that alias).
//      It does NOT get the research tools. The hub delegates.
//
// 2b · COORDINATOR_PROMPT: replace the step-by-step procedure below with GOALS and QUALITY CRITERIA (1.3):
//   • cover the full breadth of the topic: partition it into distinct, non-overlapping subtopics or
//     source types, one subagent each (sample Q7's root cause was a too-narrow decomposition)
//   • scale effort to the query: a simple factual question needs one searcher, not the whole pipeline
//   • spawn independent subagents in parallel, as several Agent calls in ONE response
//   • subagents don't inherit your context: put everything they need in their prompt (the user's
//     constraints, and for the synthesizer the complete findings with their source metadata)
//   • check the synthesis for gaps and re-delegate targeted queries before answering
// No numbered "Step 1, Step 2" procedure: subagents and the coordinator should adapt to what they find.
export const COORDINATOR_TOOLS: string[] = [];

export const COORDINATOR_PROMPT = `
You are a research coordinator.
Step 1: Pick the three most important subtopics.
Step 2: Ask the searcher about each subtopic, one at a time.
Step 3: Ask the synthesizer to write the report.
`;
