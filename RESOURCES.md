# CCAR-F Resources

Verified 2026-10-01: every URL below returned HTTP 200 (after redirects) and its content was checked against the topic named. Task-statement numbers refer to the exam guide (`md/CCAR-F/sections/07`–`11`). Docs now live on **platform.claude.com/docs** (API) and **code.claude.com/docs** (Claude Code + Agent SDK). Old docs.anthropic.com / docs.claude.com links redirect there.

## Knowledge

### Claude API: tool use and the agentic loop
- [Tool use overview — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview)
  Client vs server tools, the request → tool_use → tool_result cycle. Use for: 1.1, 2.1, 2.3, 4.3.
- [How tool use works — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works)
  Explains the loop and who runs which tool. Use for: 1.1.
- [Define tools — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
  input_schema, writing descriptions, and `tool_choice` (auto/any/tool/none), including the forced-tool-use support table. Use for: 2.1, 2.3, 4.3.
- [Handle tool calls — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls)
  Format of tool_result blocks, the rule that tool_result blocks come first in the message, and `is_error`. Use for: 1.1, 2.2.
- [Parallel tool use — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/parallel-tool-use)
  Parallel calls, `disable_parallel_tool_use`, and returning all results in ONE user message. Use for: 1.1, 1.3, 2.3.
- [Handling stop reasons — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)
  Every `stop_reason` value (end_turn, max_tokens, stop_sequence, tool_use, pause_turn, refusal, model_context_window_exceeded), how to handle each, and loop patterns. Use for: 1.1.
- [Tutorial: Build a tool-using agent — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/build-a-tool-using-agent)
  Five "rings" (stages) from a single call to a full loop to parallel calls to error handling to Tool Runner. Has runnable Python/TS. Use for: 1.1, 2.2, 2.3.
- [Tool Runner — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-runner)
  The SDK runs the loop for you (`client.beta.messages.tool_runner`). Use for: 1.1 (to compare with the manual loop).
- [Troubleshooting tool use — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/troubleshooting-tool-use)
  Common errors such as "tool_use ids were found without tool_result blocks" and ignored parallel settings. Use for: 1.1, 2.2.
- [Models overview — Anthropic Docs](https://platform.claude.com/docs/en/models/overview)
  Current model IDs (claude-opus-5-5, claude-sonnet-5-5, claude-fable-5-1, claude-haiku-4-5). Use for: lab setup.

### Structured outputs / strict tool use / JSON Schema
- [Structured outputs — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
  JSON outputs through `output_config.format` (type `json_schema`) plus strict tools. Covers supported schema features. Use for: 4.3, 4.4.
- [Strict tool use — Anthropic Docs](https://platform.claude.com/docs/en/agents-and-tools/tool-use/strict-tool-use)
  `strict: true` uses grammar-constrained sampling so tool inputs match the schema. Use for: 4.3, 2.3.
- [Agent SDK structured outputs — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/structured-outputs)
  Validated JSON at the end of an agent run. The `--json-schema` CLI flag uses the same mechanism. Use for: 3.6, 4.3.
- [Cookbook: extracting_structured_json / tool_use_with_pydantic / tool_choice — anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks/tree/main/tool_use)
  Notebooks on extracting data through tools, Pydantic validation, and tool_choice. Use for: 4.3, 4.4.

### Message Batches API
- [Batch processing — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing)
  50% cost cut, results ready when the batch finishes or after 24 h (most finish within 1 h), results kept 29 days, up to 100k requests or 256 MB, `custom_id`, result types. Use for: 4.5.
- [Message Batches API reference — Anthropic Docs](https://platform.claude.com/docs/en/api/messages/batches)
  create / retrieve / results / cancel endpoints. Use for: 4.5.

### Prompt engineering
- [Prompting best practices — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
  One page with sections: be clear and direct, use examples (few-shot), XML tags, long-context prompting (long data at the top, query at the end, up to 30% better), chaining complex prompts, subagent orchestration, reducing hallucinations in agentic coding. Use for: 4.1, 4.2, 1.6, 5.1.
  The old sub-page URLs (`.../be-clear-and-direct`, `multishot-prompting`, `use-xml-tags`, `chain-prompts`, `long-context-tips`) now redirect to anchors on this page.
- [Prompt engineering overview — Anthropic Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview)
  Index page and when to use prompt engineering. Use for: 4.x orientation.
- [Reduce hallucinations — Anthropic Docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)
  Let Claude say "I don't know", ground answers in direct quotes, verify with citations. Use for: 4.3 (nullable fields), 5.6.

### Claude Agent SDK
- [Agent SDK overview — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/overview)
  What the SDK is and its capabilities. Use for: Domain 1 orientation.
- [How the agent loop works — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/agent-loop)
  The SDK's loop, turns, and message types. Use for: 1.1.
- [Subagents in the SDK — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/subagents)
  `agents` parameter and `AgentDefinition` fields (description, prompt, tools, model …). Subagents are invoked through the **Agent** tool (formerly Task). Use for: 1.2, 1.3, 2.3.
- [Hooks — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/hooks)
  PreToolUse/PostToolUse callbacks, `HookMatcher`, `permissionDecision: "deny"`. Use for: 1.4, 1.5.
- [Hooks reference — Claude Code Docs](https://code.claude.com/docs/en/hooks)
  Full JSON input/output schema for every hook event, matcher patterns, and shell-command hooks in settings files. The SDK callbacks use the same output format. Use for: 1.5, and 3.x if hooks appear in team config.
- [Permissions — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/permissions)
  `allowed_tools`/`disallowed_tools` (TS: `allowedTools`/`disallowedTools`), permission modes, evaluation order. Use for: 1.3, 1.5, 2.3.
- [Sessions — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/sessions)
  `resume` and `fork_session` (TS: `forkSession`), and reading `session_id` from the result message. Use for: 1.7.
  Re-checked 2026-10-05: says a fork branches "the conversation history, not the filesystem", and under "Resume across hosts" recommends passing captured results into a fresh session's prompt as "often more robust" than resuming transcripts (the exam's "fresh + summary" answer). The standalone `forkSession(id)` and `title` option are in the SDK types (v0.3.289). We verified that `claude -r <title>` resumes an SDK-titled session.
- [Python SDK reference — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/python) · [TypeScript SDK reference](https://code.claude.com/docs/en/agent-sdk/typescript)
  Every option name, including the casing differences between Python and TS. Use for: 1.3, 1.5, 1.7.
- [Migration guide (Claude Code SDK → Claude Agent SDK) — Claude Code Docs](https://code.claude.com/docs/en/agent-sdk/migration-guide)
  Rename history, e.g. `ClaudeCodeOptions` → `ClaudeAgentOptions`. Use for: terminology.
- [Cookbook: claude_agent_sdk notebooks — anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks/tree/main/claude_agent_sdk)
  Research agent, chief-of-staff agent (subagents and hooks), observability agent. Use for: 1.2–1.5.
- [Cookbook: patterns/agents — anthropics/claude-cookbooks](https://github.com/anthropics/claude-cookbooks/tree/main/patterns/agents)
  Prompt chaining/routing/parallelization, orchestrator-workers, evaluator-optimizer. Use for: 1.2, 1.6.

### Claude Code
- [Memory (CLAUDE.md) — Claude Code Docs](https://code.claude.com/docs/en/memory)
  Where CLAUDE.md files live and how they load, `@path` imports, `.claude/rules/` with `paths:` frontmatter, user-level rules, `/memory`. Use for: 3.1, 3.3.
- [Skills — Claude Code Docs](https://code.claude.com/docs/en/skills)
  SKILL.md frontmatter (`context: fork`, `agent`, `allowed-tools`, `disallowed-tools`, `argument-hint`, `paths`). Says that custom commands have been merged into skills. Use for: 3.2.
  Re-checked 2026-10-06: `allowed-tools` "does not restrict which tools are available" (it pre-approves). Precedence is enterprise > personal > project. A skill beats a command with the same name. A forked skill's `agent` defaults to general-purpose.
- [Commands — Claude Code Docs](https://code.claude.com/docs/en/commands)
  Built-in commands such as /memory, /compact, /resume. Use for: 3.1, 3.2, 5.4.
- [Subagents — Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
  Built-in Explore/Plan/general-purpose subagents, `.claude/agents/`, foreground vs background. Notes the Task → Agent rename in v2.1.63. Use for: 1.3, 3.4, 5.4.
- [Permission modes (incl. plan mode) — Claude Code Docs](https://code.claude.com/docs/en/permission-modes)
  `plan` mode for analysis before editing, cycled with Shift+Tab. Use for: 3.4.
- [Common workflows — Claude Code Docs](https://code.claude.com/docs/en/common-workflows)
  Plan-then-execute, resuming sessions, worktrees. Use for: 3.4, 3.5, 1.7.
- [MCP in Claude Code — Claude Code Docs](https://code.claude.com/docs/en/mcp)
  Local/project/user scopes (`~/.claude.json` vs `.mcp.json`), `${VAR}` and `${VAR:-default}` expansion (an unset var stays as the literal `${VAR}` text), tool search on by default (`ENABLE_TOOL_SEARCH=false`), and `claude mcp reset-project-choices`. Verified 2026-10-06. Use for: 2.4.
- [Non-interactive (headless) mode — Claude Code Docs](https://code.claude.com/docs/en/headless)
  `-p`, `--output-format json|stream-json`, structured output. Use for: 3.6.
- [CLI reference — Claude Code Docs](https://code.claude.com/docs/en/cli-reference)
  `--print/-p`, `--output-format`, `--json-schema` (print mode only), `--resume/-r <id or name>`, `--fork-session`, `--continue`. Use for: 1.7, 3.6.
- [GitHub Actions — Claude Code Docs](https://code.claude.com/docs/en/github-actions)
  claude-code-action setup and CI review patterns. Use for: 3.6.
- [Tools reference — Claude Code Docs](https://code.claude.com/docs/en/tools-reference)
  Built-in tools (Read, Write, Edit, Bash, Grep, Glob, Agent …) and what each does. Use for: 2.5.
- [Best practices for Claude Code — Claude Code Docs](https://code.claude.com/docs/en/best-practices)
  Explore → plan → code, test-driven iteration, interviewing the user first, context hygiene. (The old anthropic.com/engineering/claude-code-best-practices link redirects here.) Use for: 3.4, 3.5, 5.4.
- [Glossary — Claude Code Docs](https://code.claude.com/docs/en/glossary)
  Table of deprecated and renamed terms (headless → non-interactive, custom commands → skills, slash commands → commands). Use for: terminology.

### Model Context Protocol (spec)
- [MCP specification (latest = 2026-07-28) — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/latest)
  The protocol spec. `/latest` redirects to the current dated version. Use for: 2.2, 2.4.
- [MCP Tools — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)
  Tool definitions and the `isError: true` result for tool-execution errors (protocol errors are a separate mechanism). Use for: 2.1, 2.2.
- [MCP Resources — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
  Resources and resource templates for exposing content catalogs. Use for: 2.4.
- [MCP Prompts — modelcontextprotocol.io](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
  Prompt templates exposed by a server. Use for: 2.4.
- [MCP architecture overview — modelcontextprotocol.io](https://modelcontextprotocol.io/docs/learn/architecture)
  Host/client/server model and its primitives. Use for: 2.4.

### Anthropic engineering posts
- [Building Effective AI Agents — Anthropic](https://www.anthropic.com/engineering/building-effective-agents)
  Workflows vs agents, prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer. Use for: 1.1, 1.2, 1.6.
- [How we built our multi-agent research system — Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
  Lead agent and parallel subagents, how to delegate, scaling effort to query complexity. Use for: 1.2, 1.3, 5.3, 5.6.
- [Writing effective tools for AI agents—using AI agents — Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
  Tool naming, namespacing, descriptions, token-efficient responses, useful error messages. Use for: 2.1, 2.2, 2.3, 5.1.
- [Lost in the Middle: How Language Models Use Long Contexts — Liu et al. 2023, arXiv:2307.03172](https://arxiv.org/abs/2307.03172)
  The origin of the "lost in the middle" term the guide uses (5.1). Not an Anthropic source. Pair it with the long-context prompting section of Prompting best practices.
- [Effective context engineering for AI agents — Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
  Context budget, compaction, structured note-taking, sub-agent architectures. Use for: 5.1, 5.4.
- [Effective harnesses for long-running agents — Anthropic](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
  Progress files and state handoff across context windows. Use for: 5.4 (manifests/scratchpads), 1.7.
- [Equipping agents for the real world with Agent Skills — Anthropic](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
  How skills are designed and loaded progressively. Use for: 3.2.
- [Building agents with the Claude Agent SDK — Claude blog](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
  The SDK loop: gather context → take action → verify. (The old anthropic.com/engineering URL redirects here.) Use for: 1.1, 1.5.

### Anthropic Academy (Skilljar) and certification
- [Claude Certified Architect – Foundations certification page — Anthropic Partner Academy](https://anthropic-partners.skilljar.com/claude-certified-architect-foundations-certification)
  Official exam page ($125, online). Links the exam guide, terms, and policy PDFs. Use for: logistics.
- [CCA-Foundations prep courses — Anthropic Partner Academy](https://anthropic-partners.skilljar.com/page/claude-certified-architect-foundations-prep-courses)
  The official prep list: AI Fluency, Building with the Claude API, Claude Code in Action, Intro to MCP, Claude 101, Bedrock/Vertex. Use for: all domains.
- [Building with the Claude API — Anthropic Academy](https://anthropic.skilljar.com/claude-with-the-anthropic-api)
  Long API course covering tool use, structured data, prompt evals, RAG, and agents/workflows. Use for: 1.1, 2.3, 4.x.
- [Claude Code in Action — Anthropic Academy](https://anthropic.skilljar.com/claude-code-in-action)
  CLAUDE.md, custom commands, hooks, MCP, GitHub integration. Use for: 3.x.
- [Introduction to Model Context Protocol — Anthropic Academy](https://anthropic.skilljar.com/introduction-to-model-context-protocol) · [MCP: Advanced Topics](https://anthropic.skilljar.com/model-context-protocol-advanced-topics)
  Building MCP servers and clients (tools/resources/prompts). Use for: 2.2, 2.4.
- [Introduction to agent skills — Anthropic Academy](https://anthropic.skilljar.com/introduction-to-agent-skills) · [Introduction to subagents](https://anthropic.skilljar.com/introduction-to-subagents)
  Skills and subagents in Claude Code. Use for: 3.2, 3.4, 1.3.
- [Anthropic Academy catalog — Skilljar](https://anthropic.skilljar.com/)
  Full public course list. (anthropic.com/learn redirects to academy.claude.com.)
- [anthropics/courses — GitHub](https://github.com/anthropics/courses)
  Official notebook courses (API fundamentals, prompt engineering tutorial, tool use). Use for: 4.1, 4.2, 4.3.
- [anthropics/claude-cookbooks — GitHub](https://github.com/anthropics/claude-cookbooks)
  Official recipes (tool_use, claude_agent_sdk, patterns/agents, tool_evaluation, skills). The old anthropic-cookbook name redirects here. Use for: hands-on labs.

## Wisdom (Communities)
- [Claude Discord (official, linked from claude.com/community)](https://discord.com/invite/6PPFFzqPDZ)
  Reputation: **Official / high.** Anthropic-run server, about 130k members (Discord API, 2026-10-01). Good for live help on Claude Code and the SDK. Answers come from peers, so check them against the docs.
- [r/ClaudeAI — Reddit (linked from claude.com/community)](https://www.reddit.com/r/ClaudeAI/)
  Reputation: **Community / medium.** Large, unofficial, moderated by volunteers. Useful for exam-experience reports and field tips. Contains a lot of anecdote and outdated advice. Reddit returns 403 to automated fetches, so this link was confirmed through claude.com/community only.
- [Claude Community hub — Claude](https://claude.com/community)
  Reputation: **Official / high.** Links to Discord, Reddit, the Ambassador program, and local meetups ([luma.com/claudecommunity](https://luma.com/claudecommunity)).
- Third-party practice exams (Udemy, Tutorials Dojo)
  Reputation: **Unofficial / low–medium.** Many exist. None is endorsed by Anthropic. Quality is unverified and many are based on the exam guide's terminology rather than current docs.

## Gaps
- **MCP resources, server `instructions` and plan mode's handling of MCP tools are thinly documented.** The Claude Code MCP page mentions resources only as `resources/list` discovery (checked 2026-10-06). The Lesson 8 lab showed three things: the agent reads resources via `ListMcpResourcesTool` / `ReadMcpResourceTool`; server `instructions` reach the model even when tools are deferred; plan mode refuses MCP tools that lack `readOnlyHint: true`. All three come from observed behaviour only.
- **No official practice test.** The certification page and prep-course page mention none. The only official practice items are the exam guide's own sample questions (`md/CCAR-F/sections/14-sample-questions.md`).
- **No dedicated official cert community.** I found no CCAR-F-specific forum or Discord channel. General Claude Discord only.
- **Prompt-engineering sub-pages were consolidated.** "Multishot", "XML tags", "chain prompts", and "long-context tips" are now anchors on one best-practices page, so exam-guide wording may not match headings.
- **Forced tool use is unsupported on the newest models.** `tool_choice` `any` and `tool` return a 400 on Claude Opus 5.5, Sonnet 5.5, Fable 5.1, and Mythos 5.1, and they also fail with manual extended thinking. Exam scenarios that rely on them (2.3, 4.3) describe earlier models. Labs must use an older model or teach the replacement: `auto` + `strict: true`, or structured outputs.
- **Confidence calibration, stratified sampling, and human-review workflows (5.5)** have no dedicated Anthropic doc. The closest are the eval docs and general statistics material.
- **Escalation/handoff design (1.4, 5.2)** is covered only indirectly: the customer_service_agent cookbook and "Building effective agents".
- **Pydantic validation-retry loops (4.4)** appear only in a cookbook (`tool_use/tool_use_with_pydantic.ipynb`), not in the docs.
- **"Lost in the middle" (5.1)** has no Anthropic page by that name. Use the long-context prompting section and the context-engineering post.
- **Partner Academy access.** The CCA prep-course page is on anthropic-partners.skilljar.com. The listed courses are free on the public anthropic.skilljar.com, but whether the cert page requires a partner account is not stated.
