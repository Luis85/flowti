# Agent Interaction V2 — Stream-JSON Pipeline Design

**Date**: 2026-03-15
**Status**: Approved
**Scope**: Structured output, thinking visibility, live display, session logs, and conversation persistence for Flowti CLI agents

## Problem

The current agent interaction system has five key gaps:

1. **No structured output** — Autonomous runs use `claude --print`, treating Claude's output as opaque text. `parseAgentOutput` tries prefix-based detection (`error:`, `progress:`, `result:`) but Claude never produces these prefixes. All output falls through to `kind: "raw"`.
2. **No thinking visibility** — No mechanism to see Claude's reasoning during autonomous runs. No `--verbose` flag, no `--output-format`, no thinking token capture.
3. **No conversation persistence** — Talk flow history is in-memory only. Exiting the menu loses the entire conversation. No way to resume.
4. **Batch response in talk** — Talk uses `shell.runAsync` which waits for the full response before displaying. No streaming, no progress indication while Claude thinks.
5. **Dead code** — `parseAgentOutput` in `agent-runner.ts` is effectively unused. Session logs store raw text lines with no structure.

## Decision

Replace `--print` with `--output-format stream-json` across both autonomous runs and talk flow. Parse the NDJSON event stream into typed domain events. Use these events to power live display, structured session logs, and conversation persistence.

### Design Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Output format | `stream-json` everywhere | Unified pipeline; one parser, one event model, one set of renderers |
| Stream parser | Pure domain function | Testable, no I/O; stateless per-line with thin caller-side accumulator |
| Conversation persistence | JSON files in `.flowti/var/conversations/` | Crash-safe (write after each turn), git-friendly, simple to load/resume |
| Session logs | Dual format (JSON + markdown) | Machine-readable events + human-readable summary |
| Thinking display | Configurable (`full` / `indicator` / `hidden`) | Different users want different verbosity |

## Stream Event Model

### `AgentStreamEvent` union type

New file: `src/domain/agents/agent-stream.ts`

```typescript
export type AgentStreamEvent =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool-start"; id: string; name: string }
  | { kind: "tool-input"; id: string; json: string }
  | { kind: "tool-end"; id: string }
  | { kind: "error"; message: string }
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  | { kind: "done" };
```

### `parseStreamLine(line: string, state: StreamState): AgentStreamEvent | null`

Pure function. Takes one NDJSON line + readonly stream state, returns a typed event. The function is pure (no side effects) but requires state to resolve content block indices to tool IDs.

| NDJSON `type` | `content_block` / `delta` type | `AgentStreamEvent` |
|---------------|-------------------------------|---------------------|
| `content_block_start` | `thinking` | `{ kind: "thinking", text: "" }` |
| `content_block_start` | `text` | `null` (skip — text arrives via deltas) |
| `content_block_start` | `tool_use` | `{ kind: "tool-start", id, name }` |
| `content_block_delta` | `thinking_delta` | `{ kind: "thinking", text }` |
| `content_block_delta` | `text_delta` | `{ kind: "text", text }` |
| `content_block_delta` | `input_json_delta` | `{ kind: "tool-input", index, json }` |
| `content_block_stop` | (tool was active in state) | `{ kind: "tool-end", id }` |
| `content_block_stop` | (thinking/text was active) | `null` (skip) |
| `message_delta` | — | `{ kind: "usage", inputTokens, outputTokens }` |
| `message_stop` | — | `{ kind: "done" }` |
| `error` | — | `{ kind: "error", message }` |
| `ping` / unknown | — | `null` (skip) |

Note: `tool-input` uses `index: number` (not `id`) because `input_json_delta` only carries the block index. The caller resolves index → id via `StreamState`.

Updated `AgentStreamEvent` for tool-input:
```typescript
export type AgentStreamEvent =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool-start"; id: string; name: string }
  | { kind: "tool-input"; index: number; json: string }  // index, not id
  | { kind: "tool-end"; id: string }
  | { kind: "error"; message: string }
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  | { kind: "done" };
```

### Stream state (caller-side accumulator)

```typescript
export interface StreamState {
  activeBlocks: Map<number, { type: "thinking" | "text" | "tool"; id?: string }>;
}

export function createStreamState(): StreamState {
  return { activeBlocks: new Map() };
}

export function updateStreamState(state: StreamState, line: string): StreamState {
  // Parses the NDJSON line and updates activeBlocks map
  // content_block_start → add entry
  // content_block_stop → remove entry
  // Returns new state (immutable)
}
```

The caller (`agent-process.ts`) calls `updateStreamState` then `parseStreamLine` for each line. `StreamState` is a domain type exported from `agent-stream.ts` for infrastructure consumption. The caller also resolves `tool-input` index → id using `state.activeBlocks.get(event.index)?.id`.

## Claude CLI Invocation Changes

### `AgentAIConfig` extension

```typescript
export interface AgentAIConfig {
  model?: string;
  provider?: string;
  maxTokens?: number;
  contextWindow?: number;
  outputFormat?: "text" | "stream-json";  // NEW — defaults to "stream-json"
  allowedTools?: string[];                 // NEW — optional tool restrictions
}
```

### Unified `buildClaudeArgs`

Currently two separate builders: `buildClaudeArgs` (autonomous) and `buildTalkCommand` (talk). Unified into one:

**When `outputFormat` is `"stream-json"` (default):**
```
claude -p --output-format stream-json --verbose [--prompt-file <brief>] [--model <m>] [--max-tokens <n>] [--allowedTools <tools>]
```

**When `outputFormat` is `"text"` (fallback):**
```
claude --print [--prompt-file <brief>] [--model <m>] [--max-tokens <n>]
```

For talk flow: write prompt to a temp file and use `--prompt-file` (avoids modifying `spawnBackground` stdin handling).
For autonomous runs: use `--prompt-file <brief>`.

Both paths use `--prompt-file`. This avoids changing `spawnBackground`'s stdio configuration (currently `stdin: "ignore"`). The temp file is written by the talk menu before spawning, and cleaned up after the process exits.

`buildTalkCommand` is removed. Both paths use `buildClaudeArgs`.

The `--verbose` flag is required for thinking events to appear in the stream-json output. Without it, thinking content blocks are not emitted.

### `RESPONSE_FORMAT` and `parseAgentResponse` migration

The current `buildConversationPrompt` embeds a `RESPONSE_FORMAT` instruction asking Claude to respond with `{"message": "...", "status": "..."}`. With stream-json, the response arrives as chunked `text_delta` events instead of a single JSON blob.

Migration approach:
- Keep the `RESPONSE_FORMAT` instruction in the prompt — Claude still produces the JSON, just delivered via stream events
- Accumulate all `text` events into a complete response string
- Pass the accumulated string through `parseAgentResponse` to extract status (message/question/ready/error)
- `parseAgentResponse` itself is unchanged — it already handles both JSON and plain text fallback

## Process Integration

### `agent-process.ts` updates

`launchAgent` currently emits raw `AgentOutputEvent`. Updated to:

1. Receive each stdout line
2. Call `updateStreamState(state, line)` to track active blocks
3. Call `parseStreamLine(line, state)` to get typed event
4. If tool-input: resolve `index` → `id` via `state.activeBlocks`
5. Emit typed `AgentStreamEvent` via `handle.subscribe` callback

The `subscribe` callback signature changes:
```typescript
// Before
handle.subscribe((event: AgentOutputEvent) => ...)

// After
handle.subscribe((event: AgentStreamEvent) => ...)
```

This is a **breaking change** to the `AgentProcessHandle` interface. All subscribers in `agents-run-menu.ts` (line 98-101) must be fully rewritten to handle the new event types.

### Process completion detection

The current `waitForOutput(/.*/, 300000)` resolves on the first output line, which is wrong for streaming. Replace with a new `waitForExit(timeout?: number): Promise<number>` method on `BackgroundProcess` that resolves when the child process exits, returning the exit code.

This requires adding `waitForExit` to the `BackgroundProcess` interface in `src/infrastructure/types.ts` and implementing it in `shell.ts` via `child.on("exit", ...)`.

### Infrastructure changes needed

`src/infrastructure/shell.ts`:
- Add `waitForExit(timeout?: number): Promise<number>` to the `BackgroundProcess` return from `spawnBackground`
- No stdin changes needed (talk flow uses temp file + `--prompt-file`)

`src/infrastructure/types.ts`:
- Add `waitForExit` to `BackgroundProcess` interface

### Talk flow unification

`talkToAgentInteractive` currently uses `shell.runAsync` (batch, waits for full response). Updated to use `spawnBackground` + stream parsing:

1. Write prompt to temp file via `deps.disk.writeFileSync`
2. `spawnBackground("claude", [...buildClaudeArgs(ai, tempFilePath)])` — uses `--prompt-file`
3. Maintain two accumulators: `textBuffer: string[]` and `thinkingBuffer: string[]`
4. For each `AgentStreamEvent`:
   - `thinking` → append to `thinkingBuffer`, render per `thinkingDisplay` config
   - `text` → append to `textBuffer`, print chunk immediately (streaming feel)
   - `tool-start/end` → render tool activity
   - `done` → break loop
5. Join `textBuffer` into response string, join `thinkingBuffer` into thinking string
6. Pass response through `parseAgentResponse` to extract status (message/question/ready/error)
7. Push response + thinking to conversation history
8. Persist to disk immediately (crash-safe)
9. Clean up temp file

## Live Display

### Updated `agent-run-display.ts` renderers

| Event Kind | Visual Treatment |
|-----------|-----------------|
| `thinking` | Dim text, prefixed with `💭` — streams real-time, behavior controlled by `thinkingDisplay` config |
| `text` | Normal output, streamed as chunks arrive |
| `tool-start` | Cyan `⚡ Using tool: <name>` |
| `tool-input` | Dim, accumulated input JSON (truncated to 80 chars) |
| `tool-end` | Dim `✓ tool complete` |
| `error` | Red `✗ Error: <message>` |
| `usage` | Dim footer: `tokens: X in / Y out` |
| `done` | Green `✓ Agent finished` |

### Thinking display modes

New config field on `AgentsConfig`:

```typescript
interface AgentsConfig {
  // ...existing fields...
  thinkingDisplay?: "full" | "indicator" | "hidden";
}
```

- **`full`**: Stream all thinking text in real-time (dimmed)
- **`indicator`** (default): Show spinner with `thinking...` while thinking events arrive, hide when text starts
- **`hidden`**: Suppress thinking in live display (still captured in session logs)

### Renderer signatures

Display renderers are pure functions. `thinkingDisplay` is passed as a parameter — renderers do not read config:

```typescript
function renderStreamEvent(event: AgentStreamEvent, log: LogFn, thinkingDisplay: ThinkingDisplay): void
```

Callers in `agents-run-menu.ts` and `agents-interact-menu.ts` read `thinkingDisplay` from config and pass it to the renderer. Note: emoji characters in renderers (lightning, checkmark, thought bubble) are intentional UI design elements for visual clarity in terminal output.

## Structured Session Logs

### Dual format per session

- `session-{id}.md` — human-readable markdown summary
- `session-{id}.json` — machine-readable structured event log

### Session JSON schema

```json
{
  "id": "session-1710504000000",
  "agent": "Software Developer",
  "iteration": 5,
  "startedAt": "2026-03-15T10:00:00Z",
  "completedAt": "2026-03-15T10:02:34Z",
  "status": "completed",
  "briefRef": "iterations/briefs/iteration-005-software-developer--in-progress.md",
  "usage": { "inputTokens": 12480, "outputTokens": 3200 },
  "events": [
    { "ts": "...", "kind": "thinking", "text": "Let me analyze..." },
    { "ts": "...", "kind": "tool-start", "id": "toolu_abc", "name": "Read" },
    { "ts": "...", "kind": "tool-input", "id": "toolu_abc", "json": "{\"file_path\":\"src/main.ts\"}" },
    { "ts": "...", "kind": "tool-end", "id": "toolu_abc" },
    { "ts": "...", "kind": "text", "text": "I've read the file..." },
    { "ts": "...", "kind": "usage", "inputTokens": 12480, "outputTokens": 3200 },
    { "ts": "...", "kind": "done" }
  ]
}
```

### Markdown session summary (auto-generated)

`agent-session.ts` gains a `renderSessionSummary(events: AgentStreamEvent[]): string` function that produces:

```markdown
## Output

### Thinking (N blocks)
> Summarized thinking content...

### Tool Usage
- ⚡ `Read` — `src/main.ts`
- ⚡ `Edit` — `src/domain/foo.ts`
- ⚡ `Bash` — `npm test`

### Response
Full text output from the agent...

### Usage
- Input: 12,480 tokens | Output: 3,200 tokens
- Duration: 2m 34s
```

## Conversation Persistence

### Storage

Per-agent JSON files in `.flowti/var/conversations/`:

```
.flowti/var/conversations/
  software-developer.json
  product-team.json
  bob.json
```

### Conversation file schema

Uses "threads" (not "sessions") to avoid naming collision with agent run sessions in `iterations/sessions/`.

```json
{
  "agent": "Software Developer",
  "threads": [
    {
      "id": "thread-1710504000000",
      "startedAt": "2026-03-15T10:00:00Z",
      "lastActivity": "2026-03-15T10:05:30Z",
      "turns": [
        { "role": "user", "content": "How should we structure the auth module?", "ts": "..." },
        { "role": "agent", "content": "I'd recommend separating...", "ts": "...", "thinking": "The user is asking about..." }
      ]
    }
  ],
  "activeThread": "thread-1710504000000"
}
```

The `thinking` field on agent turns is the concatenated thinking text accumulated from all `thinking_delta` stream events during that turn. Always captured regardless of `thinkingDisplay` config.

### New domain module: `agent-conversation-store.ts`

Pure functions with injected deps:

- `loadConversation(deps, dir, agentName): ConversationFile` — returns empty default when file doesn't exist (consistent with `readAgentState` returning `emptyState()`)
- `saveConversation(deps, dir, agentName, data): void`
- `createThread(data, clock): ConversationFile` — starts new thread, sets `activeThread`
- `appendTurn(data, turn): ConversationFile` — adds turn to active thread, updates `lastActivity`
- `getActiveHistory(data, maxTurns?: number): ConversationTurn[]` — returns last N turns from active thread (default 20, returns all available if fewer exist)

Types (`ConversationFile`, `ConversationThread`, `ConversationTurn`) are defined in this module (not `agent-types.ts`) since they are self-contained.

### Talk flow changes

1. Load conversation file on entry (returns empty default if none exists)
2. If `activeThread` exists: `"Resuming conversation (N turns). Send empty to start fresh."`
3. Empty input → `createThread`, clears active
4. Message input → append to active thread, include prior turns in prompt
5. Persist after each turn (crash-safe)
6. Cap prompt history at 20 turns (older turns saved but not sent to Claude)

## Files

### Created (5)
| File | Purpose |
|------|---------|
| `src/domain/agents/agent-stream.ts` | `AgentStreamEvent` types, `parseStreamLine()` |
| `src/domain/agents/agent-conversation-store.ts` | Conversation load/save/append/resume |
| `tests/domain/agents/agent-stream.test.ts` | Stream parser tests |
| `tests/domain/agents/agent-conversation-store.test.ts` | Conversation persistence tests |
| `docs/superpowers/specs/2026-03-15-agent-interaction-v2-design.md` | This spec |

### Modified (11)
| File | Change |
|------|--------|
| `src/domain/agents/agent-types.ts` | Add `outputFormat`, `allowedTools` to `AgentAIConfig` |
| `src/domain/agents/agent-runner.ts` | Unified `buildClaudeArgs` with stream-json default, remove `parseAgentOutput` |
| `src/domain/agents/agent-conversation.ts` | Remove `buildTalkCommand`, update prompt builders for stream-based flow |
| `src/domain/agents/agent-session.ts` | `appendStructuredOutput()` for JSON events, `renderSessionSummary()` for markdown. Note: pre-existing architecture violation (imports from infrastructure) — flagged as tech debt, not fixed in this scope |
| `src/infrastructure/agent-process.ts` | `launchAgent` feeds lines through `parseStreamLine` + `updateStreamState`, emits typed events |
| `src/infrastructure/shell.ts` | Add `waitForExit(timeout?)` to `BackgroundProcess` return |
| `src/infrastructure/types.ts` | Add `waitForExit` to `BackgroundProcess` interface |
| `src/infrastructure/types-config.ts` | Add `thinkingDisplay` to `AgentsConfig` |
| `src/ui/menus/agents-interact-menu.ts` | `spawnBackground` + stream parser for talk, load/save conversation history via temp file + `--prompt-file` |
| `src/ui/menus/agents-run-menu.ts` | Full rewrite of `subscribe` callback for typed `AgentStreamEvent`, replace `waitForOutput` with `waitForExit` |
| `src/ui/displays/agent-run-display.ts` | New `renderStreamEvent(event, log, thinkingDisplay)` renderer for all event kinds |

### Not changed
- `brief-store.ts` — brief generation independent of output handling
- `agent-state.ts` — agent state tracking unchanged
- `sitemap.json` — no new pages or actions
- `extensibility-handlers.ts` — handler wiring unchanged

### Not in scope
- Agent-to-agent delegation (orchestration) — separate feature
- `--allowedTools` configuration UI — type added but no interactive editor
- Conversation search/browsing UI — persistence + resume only
- `--json-schema` structured output constraint — not needed for this feature

## Testing

### `agent-stream.test.ts`
- Each NDJSON event type maps to correct `AgentStreamEvent` kind
- Invalid JSON returns `null`
- Malformed/truncated JSON returns `null` (no throw)
- Empty string returns `null`
- `ping` events return `null`
- `content_block_start` with `thinking` type produces thinking event
- `content_block_start` with `text` type returns `null` (skip)
- `content_block_start` with `tool_use` type produces tool-start with id and name
- `content_block_stop` for tool block produces tool-end with correct id (from state)
- `content_block_stop` for thinking/text block returns `null`
- `text_delta` produces text event
- `thinking_delta` produces thinking event
- `input_json_delta` produces tool-input event with index (not id)
- `message_delta` produces usage event with token counts
- `message_stop` produces done event
- `error` produces error event with message
- Unknown event types return `null`
- `updateStreamState` correctly tracks block starts and removes on stop
- `updateStreamState` handles multiple concurrent blocks (thinking + tool)

### `agent-conversation-store.test.ts`
- `loadConversation` returns empty default when file doesn't exist
- `loadConversation` returns parsed data when file exists
- `loadConversation` returns empty default on corrupt JSON (graceful recovery)
- `saveConversation` writes JSON to correct path
- `createThread` sets activeThread and creates empty turns array
- `appendTurn` adds turn to active thread
- `appendTurn` updates lastActivity timestamp
- `getActiveHistory` returns last N turns
- `getActiveHistory` returns all turns when fewer than maxTurns exist
- `getActiveHistory` returns empty array when no active thread
- `getActiveHistory` returns empty array when activeThread points to non-existent thread ID
- `getActiveHistory` caps at maxTurns (default 20)

### `agent-runner.test.ts` (updated)
- `buildClaudeArgs` produces `-p --output-format stream-json --verbose` by default
- `buildClaudeArgs` produces `--print` when `outputFormat: "text"`
- `buildClaudeArgs` includes `--allowedTools` when set
- `buildClaudeArgs` with both `outputFormat` and `allowedTools` set simultaneously
- `parseAgentOutput` tests removed (function removed)

### `agent-process.test.ts` (updated)
- `launchAgent` emits typed `AgentStreamEvent` via subscribe
- Stream state correctly tracks active tool blocks across multiple concurrent blocks
- `content_block_stop` maps to correct tool ID via state
- Process exit triggers completion (not first output line)

### `agents-interact-menu.test.ts` (updated)
- Talk loads existing conversation on entry
- Talk creates new thread on empty input
- Talk persists turns to disk after each exchange
- Talk resumes active thread with prior history
- Talk accumulates text chunks into complete response
- Talk accumulates thinking chunks into thinking string
- Talk passes accumulated response through `parseAgentResponse`
- Error mid-stream (some text, then error, then done) handled gracefully

### `agent-run-display.test.ts` (updated)
- Each event kind renders with correct ANSI formatting
- `renderStreamEvent` with `thinkingDisplay: "full"` shows thinking text
- `renderStreamEvent` with `thinkingDisplay: "indicator"` shows spinner
- `renderStreamEvent` with `thinkingDisplay: "hidden"` suppresses thinking
- Tool-input truncates at 80 chars

### `agent-session.test.ts` (updated)
- `appendStructuredOutput` writes JSON file alongside markdown
- `renderSessionSummary` produces correct markdown from events
- `renderSessionSummary` with empty events array produces minimal output
- `renderSessionSummary` with only thinking events (no text) produces thinking-only summary
- Session JSON contains timestamped events

### `shell.test.ts` (updated)
- `waitForExit` resolves with exit code on process completion
- `waitForExit` rejects on timeout
