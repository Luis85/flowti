# LLM Session Management — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Worker manager, LLM providers, conversation persistence, process lifecycle

## Problem

Every message to an agent spawns a fresh `claude -p` process. The process exits after one response, so the next message pays full startup cost again. There is no session continuity — the LLM has no memory of prior turns unless we manually inject conversation history into each prompt. The conversation store (`agent-conversation-store.ts`) exists with full CRUD and tests but is never wired up.

Additionally, when the user deselects an agent, the process dies immediately. Switching back requires a full cold start. This creates a sluggish experience that punishes context-switching between agents.

## Goals

1. Flowti owns and persists all conversation sessions — provider-agnostic
2. LLM processes are long-running — started once on agent spawn, reused across messages
3. Agents are primed automatically on spawn — the LLM is warm and in-character before the user types
4. Deselected agents decay gracefully — processes stay alive for a configurable window
5. All three provider types work behind one interface: interactive CLI, HTTP, and one-shot fallback

## Non-Goals

- Changing the Plugin-side CLI subprocess model (`agent:start` JSONL loop)
- Redesigning the chat UI or sitemap navigation
- Adding new LLM providers

## Architecture

### Session Ownership

Flowti owns the session. The LLM provider is a transport detail.

```
┌──────────────────────────────────────────────────────────┐
│  Flowti Session Layer                                    │
│                                                          │
│  WorkerImpl ──→ ConversationStore (disk persistence)     │
│       │         .flowti/var/conversations/<agent>.json    │
│       │                                                  │
│       └──→ LLMSession (long-running transport)           │
│             │                                            │
│    ┌────────┼────────────┬─────────────┐                 │
│    │        │            │             │                 │
│  Claude   Cursor       Ollama      Fallback             │
│  stdin/   stdin/       HTTP        one-shot              │
│  stdout   stdout       /api/chat   + history             │
└──────────────────────────────────────────────────────────┘
```

### Lifecycle

```
Agent selected (spawnWorker)
    │
    ├─ loadConversation() from disk
    ├─ createThread() if no active thread
    ├─ acquireSession() → LLM process starts
    ├─ session.send(startupPrompt) → agent priming response
    ├─ appendTurn(agent, primingResponse) → persist
    └─ worker.state = "idle" (warm, ready)

User sends message
    │
    ├─ session.send(rawMessage) → LLM responds (no startup cost)
    ├─ appendTurn(user, message) → persist
    ├─ appendTurn(agent, response) → persist
    └─ saveConversation() → flush to disk

Agent deselected
    │
    ├─ worker.state stays "idle"
    ├─ decayTimer starts (config.decayTimeoutMs, default 5 min)
    └─ monitor shows agent as alive + idle

    ├─ [message before timeout] → clearTimeout, session.send()
    └─ [timeout expires] → session.kill(), worker.state = "stopped"

Agent re-selected after decay
    │
    ├─ loadConversation() from disk (history preserved)
    ├─ acquireSession() → new LLM process
    ├─ session.send(startupPrompt + history) → re-primed
    └─ worker.state = "idle" (warm again)
```

### Priming

The startup prompt is sent automatically when a session is created. It contains:

- System instructions (from agent's system prompt file)
- Character identity (persona, mood, personality, attributes, XP)
- Response format instructions (JSON structured response)
- Persisted conversation history (last N turns from disk, if resuming)

The LLM responds to the priming — this is the agent "waking up." The priming response is persisted as the first turn of the thread (or appended if resuming).

For new sessions (no history): the prompt is system + character + format.
For resumed sessions (history on disk): the prompt includes a "Conversation So Far" section with persisted turns, so the LLM has full context even though the process is new.

## Design Decisions

### Process pool bypass

Persistent sessions are managed outside the process pool. The pool tracks one-shot `AgentProcess` objects and their concurrency slots. A persistent `LLMSession` lives for the full worker lifetime, so pool accounting does not apply. When a worker has an active session, `processRunner.spawn()` and `pool.acquire()` are never called. The pool is only used in the one-shot fallback path. On `stop()` with decay, `pool.cancel()` is skipped — the decay timer owns the session lifecycle.

### Response boundary detection (validation required)

The spec assumes Claude CLI emits `type: "result"` NDJSON events in interactive mode (no `-p`). This is how print mode works, but interactive mode behavior is unverified. **Implementation must validate this assumption first** by spawning `claude --output-format stream-json` interactively and confirming `result` events appear after each response. If they do not, the fallback is to detect response boundaries via a quiet-period heuristic (no output for N ms after text) or a `message_stop` event. The same validation applies to Cursor's `agent` binary.

### Startup prompt construction

The priming prompt is built using a new `buildPrimingPrompt()` function in `action-handlers.ts`. This reuses `buildConversationPrompt()` internally with a synthetic user message (e.g., a wake-up directive) rather than duplicating prompt assembly logic. The function signature:

```typescript
function buildPrimingPrompt(
    agentName: string,
    systemPrompt: string | null,
    character: AgentCharacter | undefined,
    history: readonly ConversationTurn[],  // agent-conversation.ts type: { role, content }
): string;
```

The `history` parameter uses the **prompt** `ConversationTurn` type from `agent-conversation.ts` (`{ role, content }`), NOT the store type. The worker manager maps store turns to prompt turns (stripping `ts` and `thinking`) before calling `buildPrimingPrompt`.

### ConversationTurn type mapping

Two `ConversationTurn` types exist: the store type (`agent-conversation-store.ts`, has `ts` + `thinking`) and the prompt type (`agent-conversation.ts`, has `role` + `content` only). The worker manager maps between them:
- Store → prompt: extract `{ role, content }`, drop `ts` and `thinking`
- Prompt ← store: add `ts` from `deps.clock.iso()` and optional `thinking` from LLM result

### Pre-existing store dep import

`agent-conversation-store.ts` imports `CliDeps` from infrastructure via `Pick<CliDeps, "disk" | "paths">`. This is a pre-existing pattern in the codebase (ISP subset typing). It does not introduce new architectural debt — the store's functions are pure with injected deps. `WorkerManagerDeps` already includes `disk`, `paths`, and `clock`, so all required deps are available at the wiring site.

## Detailed Changes

### 1. Infrastructure: stdin access for BackgroundProcess

**File:** `src/infrastructure/types.ts`

```typescript
export interface BackgroundProcess {
    // ... existing methods ...
    /** Write data to the process stdin. Only available when spawned with stdin: true. */
    writeStdin(data: string): void;
}
```

**File:** `src/infrastructure/shell.ts`

`spawnBackground` gains an optional `stdin` flag:

```typescript
spawnBackground(cmd: string, opts?: {
    cwd?: string;
    env?: Record<string, string>;
    stdin?: boolean;  // NEW — when true, pipe stdin instead of ignore
}): BackgroundProcess;
```

When `stdin: true`, stdio changes from `["ignore", "pipe", "pipe"]` to `["pipe", "pipe", "pipe"]`. The returned `BackgroundProcess.writeStdin()` writes to the child's stdin. When `stdin` is false/omitted (default), `writeStdin()` is a no-op for backward compatibility.

### 2. Domain: LLMSession abstraction

**File:** `src/domain/agents/llm-types.ts`

```typescript
/** A persistent LLM session that can handle multiple messages. */
export interface LLMSession {
    /** Send a message and get a process handle for this specific response. */
    send(message: string): LLMProcess;
    /** Terminate the underlying process or connection. */
    kill(): void;
    /** Whether the session is still accepting messages. */
    readonly alive: boolean;
}

/** Request to create a persistent session. */
export interface LLMSessionRequest {
    readonly tools?: readonly string[];
    readonly timeout?: number;
    readonly cwd?: string;
}
```

Add to `ProviderCapabilities`:

```typescript
export interface ProviderCapabilities {
    // ... existing fields ...
    /** Whether the provider supports long-running interactive sessions. */
    readonly persistentSession: boolean;
}
```

Add to `ILLMProvider`:

```typescript
export interface ILLMProvider {
    // ... existing methods ...
    /** Create a persistent session. Only when capabilities().persistentSession is true. */
    createSession?(request: LLMSessionRequest): LLMSession;
}
```

### 3. Claude provider: interactive session

**File:** `src/infrastructure/llm/claude-provider.ts`

New `createSession()` method:

- Spawns `claude --output-format stream-json --verbose --dangerously-skip-permissions` (no `-p` flag)
- The `--dangerously-skip-permissions` flag is required for headless sessions — matches `withFullAgentCliPermissions()` in the legacy runner. Cursor uses `--force` equivalently.
- Uses `spawnBackground` with `stdin: true`
- Maintains shared stdout parser with per-message response isolation

`send(message)` implementation:

1. Clear text/thinking buffers for new response
2. Create new subscriber set for this response
3. Write `message + "\n"` to stdin via `writeStdin()`
4. Return `LLMProcess` whose `result` promise resolves when a `result` NDJSON event arrives
5. Buffers and subscribers are scoped to this single response

Response boundary detection:

The existing `parseStreamEvents()` parses `type: "result"` NDJSON lines into `{ kind: "done" }` or `{ kind: "usage" }` stream events. When the stream emits a `done` event (produced by parsing the `type: "result"` NDJSON line), that signals the current response is complete. The session resolves the active `LLMProcess.result` promise and waits for the next `send()`. Note: there is no `kind: "result"` in `LLMEvent` — listen for `kind: "done"`.

`alive` getter: checks if the child process is still running.

`kill()`: kills the child process.

Update `CAPABILITIES`:

```typescript
const CAPABILITIES: ProviderCapabilities = {
    streaming: true,
    thinking: true,
    toolUse: true,
    structuredOutput: true,
    persistentSession: true,  // NEW
};
```

### 4. Cursor provider: interactive session

**File:** `src/infrastructure/llm/cursor-provider.ts`

Same pattern as Claude:

- Spawns `agent --output-format stream-json --stream-partial-output --force --trust` (no `-p`)
- `createSession()` with `stdin: true`
- Response boundary detection via stream events
- `persistentSession: true`

### 5. Ollama provider: HTTP session

**File:** `src/infrastructure/llm/ollama-provider.ts`

Ollama's `/api/chat` endpoint accepts a `messages` array. The session accumulates messages internally.

`createSession()`:

- Returns a logical session (no OS process — HTTP calls)
- Maintains internal `messages: Array<{ role: string; content: string }>` array

`send(message)`:

1. Push `{ role: "user", content: message }` to internal array
2. POST to `/api/chat` with `{ model, messages, stream: true }`
3. Parse streaming NDJSON response
4. Push `{ role: "assistant", content: response }` to internal array
5. Return `LLMProcess` that resolves when the response stream completes

Note: the existing `execute()` method continues to call `/api/generate` (one-shot, single prompt string). `createSession()` introduces a separate code path to `/api/chat` (chat completion, message array). These are distinct Ollama endpoints with incompatible request/response shapes and must not be conflated.

`alive`: true until `kill()` is called. An internal `aborted` flag tracks this — `kill()` sets `aborted = true`, and `alive` returns `!aborted`.

`kill()`: set `aborted = true`, abort any in-flight HTTP request.

Update `CAPABILITIES`:

```typescript
const CAPABILITIES: ProviderCapabilities = {
    streaming: true,
    thinking: false,
    toolUse: false,
    structuredOutput: false,
    persistentSession: true,  // NEW — HTTP session via message accumulation
};
```

### 6. Process runner: session acquisition

**File:** `src/infrastructure/agent-process-runner.ts`

Add to `IAgentProcessRunner`:

```typescript
export interface IAgentProcessRunner {
    spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess;
    /** Acquire a persistent session for the agent. Returns null if provider doesn't support sessions. Optional — legacy runners may not implement. */
    acquireSession?(agent: AgentSummary, resolvedTools?: readonly string[], opts?: SpawnOptions): LLMSession | null;
}
```

Implementation: checks if the selected provider supports `persistentSession`, calls `createSession()` if so, returns null otherwise.

Legacy path (no registry): returns null (no session support for legacy spawning).

### 7. Worker manager: session lifecycle + persistence

**File:** `src/infrastructure/worker-manager.ts`

#### WorkerImpl changes

```typescript
interface WorkerImpl {
    readonly name: string;
    readonly agent: AgentSummary;
    state: WorkerState;
    messageQueue: string[];
    failureCount: number;
    session: LLMSession | null;          // persistent LLM session
    conversation: ConversationFile;       // loaded from disk
    decayTimer: ReturnType<typeof setTimeout> | null;
}
```

Remove `conversationHistory: ConversationTurn[]` (replaced by conversation store).

**File:** `src/domain/agents/worker-types.ts`

Add `"decaying"` to `WorkerState`:

```typescript
export type WorkerState = "spawning" | "idle" | "queued" | "reacting" | "thinking" | "working" | "waiting" | "decaying" | "stopped";
```

#### Spawn-time priming

`spawnWorker()` becomes the session initialization point. After creating the worker:

1. Load conversation: `loadConversation(deps, varDir, agent.name)`
2. Create thread if needed: `createThread(data, threadId, clock.iso())`
3. Acquire session: `processRunner.acquireSession(agent, resolvedTools)`
4. Build startup prompt: system instructions + character + response format + history from store
5. Prime: `session.send(startupPrompt)` — fire and forget or await
6. Persist priming response as first turn
7. Worker transitions to `"idle"`

If session acquisition fails (provider doesn't support it), the worker falls back to one-shot mode with history-in-prompt on each message.

#### Message handling

`processLlmMessage()` revised flow:

```
if (worker.session?.alive)
    → clearDecayTimer()
    → session.send(rawMessage)              // just user text
    → appendTurn(user) + appendTurn(agent)
    → saveConversation()
else if (processRunner.acquireSession)
    → acquire new session
    → prime with startup prompt + history from store
    → session.send(rawMessage)
    → persist turns
else
    → one-shot with history from getActiveHistory()  // existing fallback
```

#### Decay on stop/deselect

A new worker state `"decaying"` is introduced. When `stop(agentName)` is called (agent deselected):

- Do NOT kill the session immediately
- Skip `pool.cancel()` — the session is managed outside the pool
- Worker transitions to `"decaying"` state (visible in monitor as alive but winding down)
- Start decay timer: `setTimeout(() => { session.kill(); worker.state = "stopped"; }, config.decayTimeoutMs)`
- World state entity shows `status.state = "decaying"`

When a message arrives for a decaying worker:

`handleSend()` is updated to treat `"decaying"` as a special case **before** the generic non-idle queue guard:

```
if (worker.state === "decaying") {
    clearTimeout(worker.decayTimer);  // synchronous — first operation
    worker.decayTimer = null;
    setWorkerState(worker, "idle", worldState);
    // fall through to processMessage
}
```

This ensures `clearTimeout` runs before any async work, the timer cannot fire between awaits, and the worker transitions back to `"idle"` before message processing begins. Without this guard, the existing `if (worker.state !== "idle")` would silently queue the message while the decay timer keeps ticking.

When decay expires:

- Kill session
- Worker transitions to `"stopped"`
- Conversation is already persisted (flushed per-turn)

Note: `stopAll()` and forced stops (e.g., plugin shutdown) bypass decay and kill sessions immediately.

#### Configuration

**File:** `src/infrastructure/types-config.ts`

```typescript
export interface AgentsConfig {
    // ... existing fields ...
    /** How long idle agent LLM processes stay alive after deselect, in ms. Default: 300000 (5 min). */
    readonly decayTimeoutMs?: number;
}
```

### 8. Conversation store wiring

**File:** `src/domain/agents/agent-conversation-store.ts` — no changes needed, already complete.

Wired into `worker-manager.ts`:

- Import: `loadConversation`, `saveConversation`, `createThread`, `appendTurn`, `getActiveHistory`
- On spawn: `loadConversation()` → stored in `worker.conversation`
- After each exchange: `appendTurn(user)` → `appendTurn(agent)` → `saveConversation()`
- On session restart: `getActiveHistory(worker.conversation)` → include in re-priming prompt

The `ConversationTurn` type in the store includes `ts` and optional `thinking` fields, which the `agent-conversation.ts` `ConversationTurn` does not. The worker manager uses the store type and maps to the prompt type as needed.

### 9. Cleanup: remove in-memory history

The `conversationHistory: ConversationTurn[]` field added to `WorkerImpl` in the earlier fix becomes redundant — the conversation store on disk is the single source of truth. Remove it and update `buildPrompt()` to read from `worker.conversation` via `getActiveHistory()`.

## Provider Capability Matrix

| Provider | persistentSession | Transport | Session Model |
|----------|-------------------|-----------|---------------|
| Claude   | true              | stdin/stdout | Interactive process, stream-json |
| Cursor   | true              | stdin/stdout | Interactive process, stream-json |
| Ollama   | true              | HTTP | Message array accumulation |
| Legacy   | false             | one-shot spawn | History-in-prompt fallback |

## Error Handling

- **LLM process dies mid-session**: `session.alive` returns false on next `send()`. Worker manager detects this, acquires a new session, re-primes from disk history, retries the message. Transparent to user.
- **Priming fails**: Worker enters `"stopped"` state. Error surfaced via `onResponse` callback. User can retry by re-selecting the agent.
- **Disk write fails**: Log warning, continue with in-memory state. Session still works, just loses persistence.
- **Decay timer fires during active message**: `clearTimeout(decayTimer)` is the **first synchronous operation** in the message-send path, before any `await`. Since Node.js is single-threaded, this guarantees the timer callback cannot execute between the clear and the subsequent async work. The `"decaying"` state also provides an explicit guard — `handleSend` accepts messages from workers in `"decaying"` state (transitioning them back to `"idle"`).

## Test Strategy

### Unit tests

- `worker-manager.test.ts`: spawn-time priming, session reuse across messages, decay timer, fallback to one-shot, session restart after process death
- `claude-provider.test.ts`: createSession, send/receive via stdin/stdout mock, response boundary detection, kill
- `cursor-provider.test.ts`: same pattern as Claude
- `ollama-provider.test.ts`: createSession, message array accumulation, HTTP mock
- `agent-conversation-store.test.ts`: already complete (19 passing tests)

### Integration points

- Shell `spawnBackground` with `stdin: true`: test writeStdin writes to child stdin
- Conversation store round-trip: spawn → prime → send → stop → re-spawn → verify history loaded

## Migration

- The `conversationHistory` array on `WorkerImpl` (from the earlier in-memory fix) is removed
- The `buildPrompt` function reads from `getActiveHistory(worker.conversation)` for fallback mode
- Existing `agent-conversation-store.ts` and its tests are unchanged
- No breaking changes to Plugin-side code — the CLI subprocess JSONL protocol is unchanged
