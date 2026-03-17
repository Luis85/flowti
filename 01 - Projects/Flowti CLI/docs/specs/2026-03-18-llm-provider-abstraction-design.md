# LLM Provider Abstraction — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Iteration:** 5 — Agent World

## Problem

The Flowti CLI currently has a tight coupling to Claude CLI for all agent interactions. The `agent-process-runner.ts` has a `resolveProvider()` function that maps provider names to CLI binaries and flags, but the prompt building, stream parsing, and response handling are all Claude-specific. We need to support Claude CLI, Cursor CLI, and Ollama as first-class LLM providers with a unified data model and data flow.

## Goals

1. **Unified provider interface** — all LLM providers implement the same contract (`ILLMProvider`)
2. **Capability-aware routing** — the system knows what each provider+model can do and routes accordingly
3. **Smart task routing** — utility tasks (summarize, classify) auto-route to local models (Ollama) when available; autonomous/conversation tasks use Claude or Cursor
4. **Adaptive prompt building** — prompts adapt to provider capabilities (no JSON format instructions for models that can't produce structured output)
5. **Non-breaking migration** — existing callers (`processRunner.spawn()`) keep working; new abstraction layers alongside, gradual adoption

## Non-Goals

- Direct Anthropic/OpenAI HTTP API integration (we go through CLIs for Claude/Cursor)
- Multi-provider orchestration within a single task (fan-out across providers)
- Model fine-tuning or training configuration
- Authentication/billing management for providers

## Architecture: Adapter + Capabilities Hybrid

Each provider gets an adapter implementing `ILLMProvider`. Capabilities are declared per-model, not just per-provider. A `ProviderRegistry` manages available providers and handles selection based on task type and required capabilities.

```
ProviderRegistry
  ├─ ClaudeProvider    (CLI: claude -p --output-format stream-json --verbose)
  ├─ CursorProvider    (CLI: cursor --print --json)
  └─ OllamaProvider    (HTTP: localhost:11434/api/generate)
```

### Interaction Models

| Provider | Transport | Prompt Delivery | Output Format |
|----------|-----------|-----------------|---------------|
| Claude   | CLI spawn | stdin via temp file | NDJSON stream-json |
| Cursor   | CLI spawn | stdin via temp file | JSON (--print --json) |
| Ollama   | HTTP POST | request body | NDJSON streaming |

### Provider Tiers

| Tier | Providers | Use Cases |
|------|-----------|-----------|
| **Full** | Claude, Cursor | Autonomous dispatch, conversation, clarification, tool use |
| **Utility** | Ollama | Summarization, classification, simple Q&A — cheap, fast, local |

## Core Types

All domain types live in `src/domain/agents/llm-types.ts`.

### ProviderCapabilities

What a provider+model combination can do:

```typescript
interface ProviderCapabilities {
  streaming: boolean;        // can emit events incrementally
  thinking: boolean;         // exposes chain-of-thought (Claude extended thinking)
  toolUse: boolean;          // can call tools autonomously
  structuredOutput: boolean; // reliably produces JSON when asked
  maxContextTokens?: number; // model context window size
}
```

### PromptEnvelope

Universal prompt structure, decoupled from how any provider formats it:

```typescript
/** Task context for clarification flows. Domain-layer type — not imported from UI. */
interface LLMTaskContext {
  taskName: string;
  taskDescription: string;
  context?: string;
}

interface PromptEnvelope {
  system?: string;                          // system instructions
  identity?: AgentIdentity;                 // name, persona, mood, personality, attributes
  history?: readonly ConversationTurn[];     // prior conversation turns
  message: string;                          // current user message
  responseFormat?: ResponseFormatHint;      // "json" | "text" | "auto"
  taskContext?: LLMTaskContext;             // for clarification flows
}

interface AgentIdentity {
  name: string;
  description?: string;
  persona?: string;
  mood?: string;
  personality?: readonly string[];
  attributes?: AgentAttributes;
  experience?: number;
}

type ResponseFormatHint = "json" | "text" | "auto";
```

### LLMRequest

What goes to a provider:

```typescript
interface LLMRequest {
  prompt: PromptEnvelope;
  tools?: readonly string[];   // allowed tool names
  timeout?: number;
  cwd?: string;                // working directory for CLI providers
}
```

### LLMEvent

Universal stream event type. Identical to the existing `AgentStreamEvent` — already provider-agnostic:

```typescript
type LLMEvent =
  | { kind: "thinking"; text: string }
  | { kind: "text"; text: string }
  | { kind: "tool-start"; id: string; name: string }
  | { kind: "tool-input"; index: number; json: string }
  | { kind: "tool-end"; id: string }
  | { kind: "error"; message: string }
  | { kind: "usage"; inputTokens: number; outputTokens: number }
  | { kind: "done" };
```

### LLMResult

Accumulated output:

```typescript
interface LLMResult {
  text: string;
  thinking: string;
  exitCode: number;
}
```

### LLMProcess

Handle to a running LLM invocation:

```typescript
interface LLMProcess {
  onEvent(callback: (event: LLMEvent) => void): () => void;
  readonly result: Promise<LLMResult>;
  kill(): void;
}
```

## Provider Interface

### ILLMProvider

```typescript
interface ILLMProvider {
  readonly name: string;
  capabilities(model?: string): ProviderCapabilities;
  execute(request: LLMRequest): LLMProcess;
}
```

### IProviderRegistry

```typescript
type TaskType = "autonomous" | "conversation" | "utility";

type SelectionReason = "configured" | "routed" | "fallback";

interface ProviderSelection {
  provider: ILLMProvider;
  reason: SelectionReason;
}

interface SelectOptions {
  preferred?: string;                        // agent's configured provider
  taskType: TaskType;                        // what kind of work
  required?: Partial<ProviderCapabilities>;  // minimum capabilities needed
}

interface IProviderRegistry {
  register(provider: ILLMProvider): void;
  get(name: string): ILLMProvider | undefined;
  list(): readonly ILLMProvider[];
  select(options: SelectOptions): ProviderSelection;
}
```

### Selection Logic

1. If `preferred` is set and that provider meets `required` capabilities, use it (reason: `"configured"`)
2. If `taskType === "utility"` and an Ollama provider is registered and meets requirements, use Ollama (reason: `"routed"`)
3. Otherwise, first registered provider that meets requirements (reason: `"fallback"`)
4. If nothing meets requirements, throw with a clear message about what's missing

## Adapter Implementations

All adapters live in `src/infrastructure/llm/`.

### Claude Provider (`claude-provider.ts`)

- **Transport:** CLI spawn via `shell.spawnBackground()`
- **Capabilities:** `{ streaming: true, thinking: true, toolUse: true, structuredOutput: true }`
- **Prompt delivery:** Write formatted prompt to temp file, pipe via stdin: `claude -p --output-format stream-json --verbose < tempfile`
- **Tool allowlisting:** `--allowedTools tool1,tool2` flag
- **Output parsing:** Existing `parseStreamLine()` from `agent-stream.ts` (supports both Claude CLI format and raw API SSE format)
- **Cleanup:** Delete temp file on completion or kill

### Cursor Provider (`cursor-provider.ts`)

- **Transport:** CLI spawn via `shell.spawnBackground()`
- **Capabilities:** `{ streaming: true, thinking: false, toolUse: true, structuredOutput: true }`
- **Prompt delivery:** Write formatted prompt to temp file, pipe via stdin: `cursor --print --json < tempfile`
- **Output parsing:** Cursor-specific JSON parser (adapter owns this — consumers only see `LLMEvent`)
- **Cleanup:** Delete temp file on completion or kill

### Ollama Provider (`ollama-provider.ts`)

- **Transport:** HTTP POST to `localhost:11434/api/generate` (or `/api/chat`)
- **Capabilities:** `{ streaming: true, thinking: false, toolUse: false, structuredOutput: false }`
- **Capabilities are model-aware:** `capabilities(model)` can return different caps for different models (e.g., future tool-use support in newer Ollama models)
- **Prompt delivery:** HTTP request body: `{ model, prompt, stream: true }`
- **Output parsing:** Ollama NDJSON streaming response → `text` + `done` + `usage` events only
- **Kill:** Abort HTTP request
- **Prompt adaptation:** No JSON response format instruction (model can't reliably produce it). Plain text responses, status detected by heuristic (`detectStatus()`)

### Shared Utilities

- **`prompt-file.ts`** — Temp file write + cleanup, shared by CLI-based adapters (Claude, Cursor)
- **Each adapter owns its own output parser** — no shared parsing across providers

## Prompt Formatting

Pure domain function in `src/domain/agents/llm-prompt.ts`.

### `formatPrompt(envelope, capabilities)`

Builds the prompt string, adapting based on capabilities:

1. **System instructions** — always included if present
2. **Identity block** — always included (reuses existing `buildIdentityBlock()` logic from `agent-conversation.ts`)
3. **Response format** — JSON format instructions included only when `shouldRequestJson(hint, caps)` returns true
4. **Task context** — for clarification flows (`LLMTaskContext`), included if present
5. **Conversation history** — formatted as labeled turns
6. **Current message** — user's input with appropriate closing instruction

### `shouldRequestJson(hint, caps)`

- `hint === "json"` → include JSON format if `caps.structuredOutput` is true
- `hint === "text"` → never include JSON format
- `hint === "auto"` or `undefined` → include JSON format if `caps.structuredOutput` is true

### Response Parsing Adaptation

- `structuredOutput === true` → `parseAgentResponse()` expects JSON (current behavior)
- `structuredOutput === false` → responses are plain text, status detected by `detectStatus()` heuristic (already exists in `agent-conversation.ts`)

## Routing

Pure domain function in `src/domain/agents/llm-router.ts`.

### Task Type Routing

| Task Type | Description | Preferred Provider |
|-----------|-------------|-------------------|
| `autonomous` | Workspace-based dispatch, tool use required | Claude or Cursor (agent config) |
| `conversation` | Interactive talk/clarify, structured responses preferred | Claude or Cursor (agent config) |
| `utility` | Summarization, classification, simple Q&A | Ollama (if available), else fallback |

### `selectForUtility(registry)`

Convenience function that calls `registry.select({ taskType: "utility", required: { streaming: true } })`.

## Integration & Migration

### Wiring in `deps.ts`

```typescript
interface CliDeps {
  // ... existing deps ...
  providerRegistry: IProviderRegistry;   // new
  processRunner: IAgentProcessRunner;    // kept for backward compat
}
```

### Provider Discovery at Startup

CLI providers are detected synchronously via `shell.check()` (existing pattern). Ollama uses lazy registration — the provider is always registered but checks availability on first `execute()` call. This keeps `createDefaultDeps()` synchronous.

```typescript
const registry = createProviderRegistry();
registry.register(createClaudeProvider(deps));   // always registered (primary)
if (shell.check("cursor --version")) registry.register(createCursorProvider(deps));
registry.register(createOllamaProvider());       // lazy — checks localhost:11434 on first use
```

The Ollama adapter's `execute()` performs a fast HTTP HEAD to `localhost:11434` before the first request. If unreachable, it throws with a clear error (`"Ollama is not running at localhost:11434"`). Subsequent calls reuse the cached availability check with a TTL of 60 seconds.

Providers are auto-detected — no config needed to "enable" them.

### `IAgentProcessRunner` Bridge

The existing `createProcessRunner()` is rewired to delegate to the registry internally.

**Important:** The bridge receives a pre-built prompt string from existing callers (who call `buildConversationPrompt()` / `buildClarificationPrompt()` before `spawn()`). The bridge passes this as `prompt.message` — a raw string that already contains system instructions, identity, history, and response format. The adapters treat a `PromptEnvelope` with only `message` set as a pre-formatted prompt and pass it through without calling `formatPrompt()`. This preserves existing behavior exactly.

Migrating callers to use `PromptEnvelope` fields (system, identity, history) instead of pre-building the full prompt string requires updating each call site individually — the bridge alone cannot do this. Step 5 of the migration plan covers this gradual transition.

```typescript
function createProcessRunner(registry: IProviderRegistry, config: AgentsConfig): IAgentProcessRunner {
  return {
    spawn(agent, prompt, tools, opts): AgentProcess {
      const selection = registry.select({
        preferred: agent.ai?.provider,
        taskType: "conversation",
        required: { streaming: true },
      });
      // Bridge mode: prompt is a pre-built string from existing callers.
      // Adapters detect "message-only" envelopes and use the raw string as-is.
      const request: LLMRequest = {
        prompt: { message: prompt },
        tools,
        cwd: opts?.cwd,
      };
      return selection.provider.execute(request);
    },
  };
}
```

All existing callers (`agents-interact-menu.ts`, `agents-run-menu.ts`, `chat-shell.ts`, `roster-task-menu.ts`, `agent-shell.ts`, `agent-task-handlers.ts`) keep working unchanged.

**Adapters detect pre-formatted prompts** via a helper:

```typescript
function isPreFormatted(envelope: PromptEnvelope): boolean {
  return !envelope.system && !envelope.identity && !envelope.history;
}
```

When `isPreFormatted()` returns true, adapters use `envelope.message` directly as the prompt string. When false, they call `formatPrompt(envelope, capabilities)` to build it.

### Provider Name Mapping

`AgentAIConfig.provider` uses values like `"anthropic"`, `"cursor"`, `"ollama"`. The registry maps these to `ILLMProvider.name` via a canonical name table:

| `AgentAIConfig.provider` | `ILLMProvider.name` | Notes |
|--------------------------|---------------------|-------|
| `"anthropic"` | `"anthropic"` | Default provider |
| `"cursor"` | `"cursor"` | |
| `"ollama"` | `"ollama"` | Utility tier |

Each adapter sets `name` to match the `AgentAIConfig.provider` value. The registry's `get()` and `select()` use this name for lookup. This ensures existing agent configs (`ai.provider: "anthropic"`) route correctly without a translation layer.

### Migration Steps

1. Add new types + adapters + registry alongside existing code
2. Rewire `createProcessRunner()` to delegate to registry
3. Update `process-pool.ts` to use the type aliases (`AgentStreamEvent` → re-export of `LLMEvent`, `AgentProcess` → re-export of `LLMProcess`) so it compiles against the new type chain
4. Existing callers never change — `processRunner.spawn()` still works
5. New utility features call registry directly
6. Gradually migrate callers to use `PromptEnvelope` fields (system, identity, history) instead of pre-building the full prompt string — each call site updated individually

## File Layout

```
src/domain/agents/
  llm-types.ts              # LLMEvent, LLMRequest, PromptEnvelope, ProviderCapabilities,
                             # ILLMProvider, IProviderRegistry, LLMProcess, LLMResult
  llm-prompt.ts             # formatPrompt(), shouldRequestJson(), isPreFormatted() — pure functions
  llm-router.ts             # selectForUtility(), routing helpers — pure functions
  agent-stream.ts           # existing — re-exports LLMEvent as AgentStreamEvent for compat

src/infrastructure/llm/
  provider-registry.ts      # createProviderRegistry() — implements IProviderRegistry
  claude-provider.ts        # createClaudeProvider() — implements ILLMProvider
  cursor-provider.ts        # createCursorProvider() — implements ILLMProvider
  ollama-provider.ts        # createOllamaProvider() — implements ILLMProvider
  prompt-file.ts            # shared temp file write/cleanup for CLI-based providers
```

## Testing Strategy

- **Adapters:** Unit test each by mocking `shell.spawnBackground()` (CLI providers) or HTTP fetch (Ollama). Verify correct CLI flags, prompt formatting, event parsing.
- **Registry:** Unit test selection logic with mock providers reporting different capabilities. Verify routing rules: preferred > utility-route > fallback.
- **`formatPrompt()`:** Pure function — assertion tests with various `PromptEnvelope` + `ProviderCapabilities` combinations. Verify JSON format instructions included/excluded based on `structuredOutput`.
- **Response parsing:** Test `parseAgentResponse()` with both JSON and plain text inputs. Verify graceful fallback when `structuredOutput === false`.
- **Integration:** Test `createProcessRunner()` bridge delegates to registry correctly.

## Error Handling

- **Provider not found:** `registry.select()` throws with clear message listing available providers and what capabilities were required
- **Provider unavailable at runtime:** CLI spawn fails → `LLMResult` with `exitCode: 1`, empty text. Ollama HTTP fails → `LLMEvent` error event + graceful result
- **Timeout:** Each adapter respects `LLMRequest.timeout` — CLI providers use `waitForExit(timeout)` (existing behavior), Ollama uses `AbortController` with timeout signal
- **Temp file cleanup:** CLI adapters always clean up temp files in both success and error paths (existing pattern preserved)

## DI Boundaries

`ILLMProvider` and `IProviderRegistry` are dependency injection interfaces, analogous to `IFileSystem` and `IShell` in the existing codebase. They are defined in the domain layer (`llm-types.ts`) but implemented in infrastructure (`provider-registry.ts`, `*-provider.ts`). Domain code may hold and call these interfaces but never instantiates implementations directly — wiring happens in `deps.ts`.

## Backward Compatibility

- `AgentStreamEvent` re-exported from `agent-stream.ts` as a type alias for `LLMEvent`
- `AgentProcess` type alias for `LLMProcess` (re-exported from `worker-types.ts`)
- `AgentProcessResult` type alias for `LLMResult` (re-exported from `agent-shell.ts`, where it is currently defined)
- `IAgentProcessRunner.spawn()` signature unchanged — all 9 existing callers work without modification
- `process-pool.ts` updated to use the re-exported type aliases so it compiles against the new type chain
- `DispatchRequest.provider` field still accepted — mapped to `SelectOptions.preferred`. Type remains `"anthropic" | "cursor"` (not widened to include `"ollama"`) because Ollama is utility-tier only and not suitable for workspace-based autonomous dispatch which requires tool use
- `resolveProvider()` removed — replaced by adapter-specific logic inside each provider
