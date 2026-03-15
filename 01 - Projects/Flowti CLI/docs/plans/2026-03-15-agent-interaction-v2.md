# Agent Interaction V2 — Stream-JSON Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace opaque `--print` output with `--output-format stream-json` across agent runs and talk, enabling live thinking display, structured session logs, and persistent conversations.

**Architecture:** New `agent-stream.ts` domain module parses NDJSON into typed `AgentStreamEvent`. Infrastructure layer (`agent-process.ts`, `shell.ts`) feeds raw lines through the parser. UI layer renders typed events with configurable thinking display. Conversation persistence via per-agent JSON files. Domain purity preserved — all parsers are pure functions.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/superpowers/specs/2026-03-15-agent-interaction-v2-design.md`

---

## File Structure

### New files (5)
| File | Responsibility |
|------|---------------|
| `src/domain/agents/agent-stream.ts` | `AgentStreamEvent` type, `StreamState`, `parseStreamLine()`, `updateStreamState()` |
| `src/domain/agents/agent-conversation-store.ts` | Conversation persistence: load, save, create thread, append turn, get history |
| `tests/domain/agents/agent-stream.test.ts` | Stream parser tests |
| `tests/domain/agents/agent-conversation-store.test.ts` | Conversation store tests |
| `tests/domain/agents/agent-conversation-store-integration.test.ts` | (optional, if needed) |

### Modified files (11)
| File | What changes |
|------|-------------|
| `src/domain/agents/agent-types.ts:57-68` | Add `outputFormat`, `allowedTools` to `AgentAIConfig` |
| `src/domain/agents/agent-runner.ts:17-65` | Unified `buildClaudeArgs` with stream-json, remove `parseAgentOutput` + `AgentOutputEvent` |
| `src/domain/agents/agent-conversation.ts:163` | Remove `buildTalkCommand` |
| `src/domain/agents/agent-session.ts:109` | Add `appendStructuredOutput()`, `renderSessionSummary()` |
| `src/infrastructure/types.ts:30-41` | Add `waitForExit` to `BackgroundProcess` |
| `src/infrastructure/shell.ts:110-191` | Implement `waitForExit` on `BackgroundProcess` |
| `src/infrastructure/agent-process.ts:13-60` | Feed lines through stream parser, emit typed events, update `AgentProcessHandle` |
| `src/infrastructure/types-config.ts:222` | Add `thinkingDisplay` to `AgentsConfig` |
| `src/ui/displays/agent-run-display.ts:34-44` | Replace `renderAgentOutput` with `renderStreamEvent` |
| `src/ui/menus/agents-run-menu.ts:78-108` | Rewrite `spawnAndStream` for typed events + `waitForExit` |
| `src/ui/menus/agents-interact-menu.ts:42-99` | Stream-based talk, conversation persistence |

---

## Chunk 1: Stream Parser + Types (Foundation)

### Task 1: Add `outputFormat` and `allowedTools` to `AgentAIConfig`

**Files:**
- Modify: `src/domain/agents/agent-types.ts:57-68`
- Test: type-check only

- [ ] **Step 1: Add fields to AgentAIConfig**

In `src/domain/agents/agent-types.ts`, find the `AgentAIConfig` interface at line 57. Add two new optional fields:

```typescript
export interface AgentAIConfig {
	model?: string;
	provider?: string;
	systemPrompt?: string;
	contextWindow?: number;
	maxTokens?: number;
	outputFormat?: "text" | "stream-json";
	allowedTools?: string[];
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-types.ts"
git commit -m "feat: add outputFormat and allowedTools to AgentAIConfig"
```

### Task 2: Add `thinkingDisplay` to `AgentsConfig`

**Files:**
- Modify: `src/infrastructure/types-config.ts:222`

- [ ] **Step 1: Add thinkingDisplay field**

In `src/infrastructure/types-config.ts` line 222, update `AgentsConfig`:

```typescript
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; skillMap?: Record<string, string[]>; thinkingDisplay?: "full" | "indicator" | "hidden"; }
```

- [ ] **Step 2: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat: add thinkingDisplay to AgentsConfig"
```

### Task 3: Create `agent-stream.ts` — Stream event types and parser

**Files:**
- Create: `src/domain/agents/agent-stream.ts`
- Create: `tests/domain/agents/agent-stream.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/agents/agent-stream.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	parseStreamLine, createStreamState, updateStreamState,
	type AgentStreamEvent, type StreamState,
} from "../../../src/domain/agents/agent-stream.js";

function state(blocks?: Record<number, { type: "thinking" | "text" | "tool"; id?: string }>): StreamState {
	const s = createStreamState();
	if (blocks) for (const [k, v] of Object.entries(blocks)) s.activeBlocks.set(Number(k), v);
	return s;
}

describe("parseStreamLine", () => {
	it("returns null for invalid JSON", () => {
		expect(parseStreamLine("not json", state())).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseStreamLine("", state())).toBeNull();
	});

	it("returns null for ping events", () => {
		expect(parseStreamLine(JSON.stringify({ type: "ping" }), state())).toBeNull();
	});

	it("returns null for unknown event types", () => {
		expect(parseStreamLine(JSON.stringify({ type: "unknown_thing" }), state())).toBeNull();
	});

	it("parses content_block_start with thinking type", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "thinking", text: "" });
	});

	it("returns null for content_block_start with text type", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "text", text: "" } });
		expect(parseStreamLine(line, state())).toBeNull();
	});

	it("parses content_block_start with tool_use type", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_abc", name: "Read", input: {} } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "tool-start", id: "toolu_abc", name: "Read" });
	});

	it("parses thinking_delta", () => {
		const line = JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Let me think..." } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "thinking", text: "Let me think..." });
	});

	it("parses text_delta", () => {
		const line = JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Hello world" } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "text", text: "Hello world" });
	});

	it("parses input_json_delta with index", () => {
		const line = JSON.stringify({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"path":' } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "tool-input", index: 1, json: '{"path":' });
	});

	it("parses content_block_stop for tool block as tool-end", () => {
		const line = JSON.stringify({ type: "content_block_stop", index: 1 });
		const s = state({ 1: { type: "tool", id: "toolu_abc" } });
		const result = parseStreamLine(line, s);
		expect(result).toEqual({ kind: "tool-end", id: "toolu_abc" });
	});

	it("returns null for content_block_stop on thinking block", () => {
		const line = JSON.stringify({ type: "content_block_stop", index: 0 });
		const s = state({ 0: { type: "thinking" } });
		expect(parseStreamLine(line, s)).toBeNull();
	});

	it("returns null for content_block_stop on text block", () => {
		const line = JSON.stringify({ type: "content_block_stop", index: 0 });
		const s = state({ 0: { type: "text" } });
		expect(parseStreamLine(line, s)).toBeNull();
	});

	it("parses message_delta as usage event", () => {
		const line = JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { input_tokens: 100, output_tokens: 50 } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "usage", inputTokens: 100, outputTokens: 50 });
	});

	it("parses message_stop as done", () => {
		const line = JSON.stringify({ type: "message_stop" });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "done" });
	});

	it("parses error event", () => {
		const line = JSON.stringify({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } });
		const result = parseStreamLine(line, state());
		expect(result).toEqual({ kind: "error", message: "Overloaded" });
	});
});

describe("updateStreamState", () => {
	it("tracks thinking block start", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } });
		const s = updateStreamState(createStreamState(), line);
		expect(s.activeBlocks.get(0)).toEqual({ type: "thinking" });
	});

	it("tracks tool block start with id", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_xyz", name: "Edit", input: {} } });
		const s = updateStreamState(createStreamState(), line);
		expect(s.activeBlocks.get(1)).toEqual({ type: "tool", id: "toolu_xyz" });
	});

	it("tracks text block start", () => {
		const line = JSON.stringify({ type: "content_block_start", index: 2, content_block: { type: "text", text: "" } });
		const s = updateStreamState(createStreamState(), line);
		expect(s.activeBlocks.get(2)).toEqual({ type: "text" });
	});

	it("removes block on stop", () => {
		const s = createStreamState();
		s.activeBlocks.set(0, { type: "thinking" });
		const updated = updateStreamState(s, JSON.stringify({ type: "content_block_stop", index: 0 }));
		expect(updated.activeBlocks.has(0)).toBe(false);
	});

	it("handles multiple concurrent blocks", () => {
		let s = createStreamState();
		s = updateStreamState(s, JSON.stringify({ type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "" } }));
		s = updateStreamState(s, JSON.stringify({ type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t1", name: "Read", input: {} } }));
		expect(s.activeBlocks.size).toBe(2);
		s = updateStreamState(s, JSON.stringify({ type: "content_block_stop", index: 0 }));
		expect(s.activeBlocks.size).toBe(1);
		expect(s.activeBlocks.has(1)).toBe(true);
	});

	it("ignores non-block events", () => {
		const s = createStreamState();
		const updated = updateStreamState(s, JSON.stringify({ type: "ping" }));
		expect(updated.activeBlocks.size).toBe(0);
	});

	it("ignores invalid JSON", () => {
		const s = createStreamState();
		const updated = updateStreamState(s, "not json");
		expect(updated.activeBlocks.size).toBe(0);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-stream.test.ts --config configs/vitest.config.ts`
Expected: FAIL (module does not exist)

- [ ] **Step 3: Implement agent-stream.ts**

Create `src/domain/agents/agent-stream.ts`:

```typescript
/**
 * agent-stream.ts — Stream-JSON event parser for Claude CLI output.
 *
 * Parses NDJSON lines from `claude --output-format stream-json` into typed
 * domain events. Pure functions — no I/O, no side effects.
 */

// ── Event types ──────────────────────────────────────────────────────

export type AgentStreamEvent =
	| { readonly kind: "thinking"; readonly text: string }
	| { readonly kind: "text"; readonly text: string }
	| { readonly kind: "tool-start"; readonly id: string; readonly name: string }
	| { readonly kind: "tool-input"; readonly index: number; readonly json: string }
	| { readonly kind: "tool-end"; readonly id: string }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "usage"; readonly inputTokens: number; readonly outputTokens: number }
	| { readonly kind: "done" };

// ── Stream state ─────────────────────────────────────────────────────

export interface StreamState {
	readonly activeBlocks: Map<number, { type: "thinking" | "text" | "tool"; id?: string }>;
}

export function createStreamState(): StreamState {
	return { activeBlocks: new Map() };
}

// ── State updater ────────────────────────────────────────────────────

export function updateStreamState(state: StreamState, line: string): StreamState {
	let parsed: Record<string, unknown>;
	try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { return state; }
	const type = parsed.type as string | undefined;
	if (type === "content_block_start") {
		const index = parsed.index as number;
		const block = parsed.content_block as Record<string, unknown> | undefined;
		if (!block) return state;
		const blockType = block.type as string;
		const next = new Map(state.activeBlocks);
		if (blockType === "thinking") next.set(index, { type: "thinking" });
		else if (blockType === "text") next.set(index, { type: "text" });
		else if (blockType === "tool_use") next.set(index, { type: "tool", id: block.id as string });
		return { activeBlocks: next };
	}
	if (type === "content_block_stop") {
		const index = parsed.index as number;
		const next = new Map(state.activeBlocks);
		next.delete(index);
		return { activeBlocks: next };
	}
	return state;
}

// ── Line parser ──────────────────────────────────────────────────────

export function parseStreamLine(line: string, state: StreamState): AgentStreamEvent | null {
	if (!line) return null;
	let parsed: Record<string, unknown>;
	try { parsed = JSON.parse(line) as Record<string, unknown>; } catch { return null; }
	const type = parsed.type as string | undefined;
	if (!type) return null;

	if (type === "content_block_start") {
		const block = parsed.content_block as Record<string, unknown> | undefined;
		if (!block) return null;
		const blockType = block.type as string;
		if (blockType === "thinking") return { kind: "thinking", text: "" };
		if (blockType === "tool_use") return { kind: "tool-start", id: block.id as string, name: block.name as string };
		return null;
	}

	if (type === "content_block_delta") {
		const delta = parsed.delta as Record<string, unknown> | undefined;
		if (!delta) return null;
		const deltaType = delta.type as string;
		if (deltaType === "thinking_delta") return { kind: "thinking", text: delta.thinking as string };
		if (deltaType === "text_delta") return { kind: "text", text: delta.text as string };
		if (deltaType === "input_json_delta") return { kind: "tool-input", index: parsed.index as number, json: delta.partial_json as string };
		return null;
	}

	if (type === "content_block_stop") {
		const index = parsed.index as number;
		const block = state.activeBlocks.get(index);
		if (block?.type === "tool" && block.id) return { kind: "tool-end", id: block.id };
		return null;
	}

	if (type === "message_delta") {
		const usage = parsed.usage as Record<string, number> | undefined;
		if (usage) return { kind: "usage", inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
		return null;
	}

	if (type === "message_stop") return { kind: "done" };

	if (type === "error") {
		const error = parsed.error as Record<string, unknown> | undefined;
		return { kind: "error", message: (error?.message as string) ?? "Unknown error" };
	}

	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-stream.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-stream.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-stream.test.ts"
git commit -m "feat: add stream-JSON event parser for Claude CLI output"
```

### Task 4: Update `buildClaudeArgs` for stream-json and remove `parseAgentOutput`

**Files:**
- Modify: `src/domain/agents/agent-runner.ts:17-65`
- Modify: `tests/domain/agents/agent-runner.test.ts`

- [ ] **Step 1: Write failing tests**

Update `tests/domain/agents/agent-runner.test.ts`. Add new tests and mark existing `parseAgentOutput` tests for removal:

```typescript
describe("buildClaudeArgs — stream-json", () => {
	it("produces -p and --output-format stream-json by default", () => {
		const args = buildClaudeArgs(undefined, "/brief.md");
		expect(args).toContain("-p");
		expect(args).toContain("--output-format");
		expect(args).toContain("stream-json");
		expect(args).toContain("--verbose");
		expect(args).toContain("--prompt-file");
		expect(args).toContain("/brief.md");
		expect(args).not.toContain("--print");
	});

	it("produces --print when outputFormat is text", () => {
		const ai: AgentAIConfig = { outputFormat: "text" };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).toContain("--print");
		expect(args).not.toContain("--output-format");
		expect(args).not.toContain("--verbose");
	});

	it("includes --allowedTools when set", () => {
		const ai: AgentAIConfig = { allowedTools: ["Read", "Edit"] };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).toContain("--allowedTools");
		expect(args).toContain("Read,Edit");
	});

	it("includes model and max-tokens with stream-json", () => {
		const ai: AgentAIConfig = { model: "claude-sonnet-4-20250514", maxTokens: 8192 };
		const args = buildClaudeArgs(ai, "/brief.md");
		expect(args).toContain("--model");
		expect(args).toContain("claude-sonnet-4-20250514");
		expect(args).toContain("--max-tokens");
		expect(args).toContain(8192);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-runner.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Update buildClaudeArgs and remove parseAgentOutput**

In `src/domain/agents/agent-runner.ts`:

1. Remove the `AgentOutputEvent` type (lines 17-21) — it's replaced by `AgentStreamEvent` from `agent-stream.ts`
2. Remove the `parseAgentOutput` function (lines 58-65) — replaced by `parseStreamLine`
3. Update `buildClaudeArgs` (line 26) to:

```typescript
export function buildClaudeArgs(ai: AgentAIConfig | undefined, briefPath: string): string[] {
	const useText = ai?.outputFormat === "text";
	const args: (string | number)[] = [];
	if (useText) {
		args.push("--print", "--prompt-file", briefPath);
	} else {
		args.push("-p", "--output-format", "stream-json", "--verbose", "--prompt-file", briefPath);
	}
	if (ai?.model) args.push("--model", ai.model);
	if (ai?.maxTokens) args.push("--max-tokens", ai.maxTokens);
	if (ai?.allowedTools && ai.allowedTools.length > 0) args.push("--allowedTools", ai.allowedTools.join(","));
	return args as string[];
}
```

4. Remove existing tests for `parseAgentOutput` from the test file.

5. Update imports: the `AgentAIConfig` import should already exist. Remove any re-export of `AgentOutputEvent` if present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-runner.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run type-check — expect failures in downstream consumers**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: FAIL — `AgentOutputEvent` is imported by `agent-process.ts` and `agent-run-display.ts`. These will be fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-runner.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-runner.test.ts"
git commit -m "feat: update buildClaudeArgs for stream-json, remove parseAgentOutput"
```

---

## Chunk 2: Infrastructure — Process & Shell Updates

### Task 5: Add `waitForExit` to `BackgroundProcess`

**Files:**
- Modify: `src/infrastructure/types.ts:30-41`
- Modify: `src/infrastructure/shell.ts:110-191`

- [ ] **Step 1: Add `waitForExit` to the interface**

In `src/infrastructure/types.ts`, add to the `BackgroundProcess` interface (line 30-41):

```typescript
export interface BackgroundProcess {
	waitForOutput(pattern: RegExp, timeoutMs?: number): Promise<string | null>;
	waitForExit(timeoutMs?: number): Promise<number>;
	onOutput(callback: (line: string) => void): () => void;
	kill(): void;
	readonly running: boolean;
	readonly output: string[];
}
```

- [ ] **Step 2: Implement `waitForExit` in shell.ts**

In `src/infrastructure/shell.ts`, inside the `spawnBackground` function, after the existing `waitForOutput` implementation, add `waitForExit`:

```typescript
waitForExit(timeoutMs = 300000): Promise<number> {
	return new Promise((resolve, reject) => {
		if (!child.pid || child.exitCode !== null) {
			resolve(child.exitCode ?? 1);
			return;
		}
		const timer = setTimeout(() => {
			reject(new Error(`Process did not exit within ${timeoutMs}ms`));
		}, timeoutMs);
		child.on("exit", (code) => {
			clearTimeout(timer);
			resolve(code ?? 1);
		});
	});
},
```

- [ ] **Step 3: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: FAIL (still has `AgentOutputEvent` references from Task 4, but `waitForExit` itself compiles)

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/shell.ts"
git commit -m "feat: add waitForExit to BackgroundProcess interface"
```

### Task 6: Update `agent-process.ts` to emit typed stream events

**Files:**
- Modify: `src/infrastructure/agent-process.ts:13-60`
- Modify: `tests/infrastructure/agent-process.test.ts`

- [ ] **Step 1: Update AgentProcessHandle and launchAgent**

In `src/infrastructure/agent-process.ts`:

1. Replace the `AgentOutputEvent` import with `AgentStreamEvent` from the stream module:
```typescript
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import { parseStreamLine, createStreamState, updateStreamState } from "../domain/agents/agent-stream.js";
```

2. Update `AgentProcessHandle` interface (line 13-21):
```typescript
export interface AgentProcessHandle {
	readonly sessionId: string;
	readonly process: BackgroundProcess;
	readonly startedAt: string;
	subscribe(callback: (event: AgentStreamEvent) => void): () => void;
	stop(): void;
}
```

3. Update `launchAgent` (line 43) — replace raw line forwarding with stream parsing:

Inside the function, after spawning the process, set up stream parsing:
```typescript
let streamState = createStreamState();
const subscribers = new Set<(event: AgentStreamEvent) => void>();

const unsubRaw = proc.onOutput((line: string) => {
	streamState = updateStreamState(streamState, line);
	const event = parseStreamLine(line, streamState);
	if (event) {
		for (const cb of subscribers) cb(event);
	}
});
```

Update the `subscribe` method to use `subscribers` set and return unsubscribe function. Update `stop` to call `unsubRaw()` and `proc.kill()`.

- [ ] **Step 2: Update agent-process tests**

Update `tests/infrastructure/agent-process.test.ts` to expect `AgentStreamEvent` types from subscribe callbacks instead of `AgentOutputEvent`. Adapt the mock process output to emit NDJSON lines.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-process.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-process.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-process.test.ts"
git commit -m "feat: agent-process emits typed AgentStreamEvent via stream parser"
```

---

## Chunk 3: UI — Display + Run Menu + Session Logs

### Task 7: Update `agent-run-display.ts` with stream event renderers

**Files:**
- Modify: `src/ui/displays/agent-run-display.ts:34-44`
- Modify: `tests/ui/displays/agent-run-display.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the existing test file:

```typescript
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";

describe("renderStreamEvent", () => {
	it("renders thinking text in full mode", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "thinking", text: "analyzing..." }, log, "full");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output).toContain("analyzing...");
	});

	it("renders thinking indicator in indicator mode", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "thinking", text: "analyzing..." }, log, "indicator");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output).toContain("thinking");
	});

	it("suppresses thinking in hidden mode", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "thinking", text: "analyzing..." }, log, "hidden");
		expect(log).not.toHaveBeenCalled();
	});

	it("renders text events directly", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "text", text: "Hello" }, log, "indicator");
		expect(log).toHaveBeenCalledWith("Hello");
	});

	it("renders tool-start with tool name", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "tool-start", id: "t1", name: "Read" }, log, "indicator");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output).toContain("Read");
	});

	it("truncates tool-input at 80 chars", () => {
		const log = vi.fn();
		const longJson = '{"file_path": "' + "x".repeat(100) + '"}';
		renderStreamEvent({ kind: "tool-input", index: 1, json: longJson }, log, "indicator");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output.length).toBeLessThan(longJson.length + 20);
	});

	it("renders error in red", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "error", message: "Overloaded" }, log, "indicator");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output).toContain("Overloaded");
	});

	it("renders done event", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "done" }, log, "indicator");
		expect(log).toHaveBeenCalled();
	});

	it("renders usage with token counts", () => {
		const log = vi.fn();
		renderStreamEvent({ kind: "usage", inputTokens: 1000, outputTokens: 200 }, log, "indicator");
		expect(log).toHaveBeenCalled();
		const output = log.mock.calls[0][0] as string;
		expect(output).toContain("1000");
		expect(output).toContain("200");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/displays/agent-run-display.test.ts --config configs/vitest.config.ts`
Expected: FAIL

- [ ] **Step 3: Implement renderStreamEvent**

In `src/ui/displays/agent-run-display.ts`, add a new export alongside the existing render functions. Import `AgentStreamEvent` from the domain layer:

```typescript
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";

export type ThinkingDisplay = "full" | "indicator" | "hidden";

export function renderStreamEvent(event: AgentStreamEvent, log: (msg?: string) => void, thinkingDisplay: ThinkingDisplay): void {
	switch (event.kind) {
		case "thinking":
			if (thinkingDisplay === "hidden") return;
			if (thinkingDisplay === "indicator") { log(`  ${DIM}thinking...${RESET}`); return; }
			log(`  ${DIM}${event.text}${RESET}`);
			return;
		case "text":
			log(event.text);
			return;
		case "tool-start":
			log(`  ${CYAN}> Using tool: ${event.name}${RESET}`);
			return;
		case "tool-input": {
			const display = event.json.length > 80 ? event.json.slice(0, 77) + "..." : event.json;
			log(`  ${DIM}  ${display}${RESET}`);
			return;
		}
		case "tool-end":
			log(`  ${DIM}  done${RESET}`);
			return;
		case "error":
			log(`  ${RED}Error: ${event.message}${RESET}`);
			return;
		case "usage":
			log(`\n  ${DIM}tokens: ${event.inputTokens} in / ${event.outputTokens} out${RESET}`);
			return;
		case "done":
			log(`\n  ${GREEN}Agent finished${RESET}`);
			return;
	}
}
```

Keep the existing `renderAgentOutput` temporarily (it will be removed when `agents-run-menu.ts` is updated).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/displays/agent-run-display.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/displays/agent-run-display.ts" "01 - Projects/Flowti CLI/tests/ui/displays/agent-run-display.test.ts"
git commit -m "feat: add renderStreamEvent for typed agent stream events"
```

### Task 8: Update `agent-session.ts` with structured output

**Files:**
- Modify: `src/domain/agents/agent-session.ts:109`
- Modify: `tests/domain/agents/agent-session.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the existing `agent-session.test.ts`:

```typescript
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";

describe("appendStructuredOutput", () => {
	it("writes JSON file alongside session markdown", () => {
		const deps = makeDeps();
		// Create session first
		createSession(deps, "/iter", "Dev", 5, "/brief.md");
		const events: Array<AgentStreamEvent & { ts: string }> = [
			{ kind: "thinking", text: "analyzing...", ts: "2026-03-15T10:00:01Z" },
			{ kind: "text", text: "Done.", ts: "2026-03-15T10:00:02Z" },
			{ kind: "done", ts: "2026-03-15T10:00:03Z" },
		];
		const result = appendStructuredOutput(deps, "/iter", sessions[0].id, events, { inputTokens: 100, outputTokens: 50 });
		expect(result).toBe(true);
		// Check that JSON file was written
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			expect.stringContaining(".json"),
			expect.any(String),
			"utf-8",
		);
	});
});

describe("renderSessionSummary", () => {
	it("produces markdown with thinking, tools, and response sections", () => {
		const events: AgentStreamEvent[] = [
			{ kind: "thinking", text: "Let me analyze..." },
			{ kind: "tool-start", id: "t1", name: "Read" },
			{ kind: "tool-end", id: "t1" },
			{ kind: "text", text: "Here is my response." },
			{ kind: "usage", inputTokens: 500, outputTokens: 100 },
			{ kind: "done" },
		];
		const md = renderSessionSummary(events);
		expect(md).toContain("## Output");
		expect(md).toContain("Thinking");
		expect(md).toContain("Tool Usage");
		expect(md).toContain("Read");
		expect(md).toContain("Here is my response.");
		expect(md).toContain("500");
	});

	it("handles empty events array", () => {
		const md = renderSessionSummary([]);
		expect(md).toContain("## Output");
		expect(md).toContain("No output");
	});

	it("handles thinking-only output", () => {
		const events: AgentStreamEvent[] = [
			{ kind: "thinking", text: "Just thinking..." },
			{ kind: "done" },
		];
		const md = renderSessionSummary(events);
		expect(md).toContain("Thinking");
		expect(md).not.toContain("Response");
	});
});
```

- [ ] **Step 2: Implement appendStructuredOutput and renderSessionSummary**

Add to `src/domain/agents/agent-session.ts`:

```typescript
import type { AgentStreamEvent } from "./agent-stream.js";

export interface TimestampedEvent extends AgentStreamEvent { readonly ts: string; }

export function appendStructuredOutput(
	deps: SessionStoreDeps, iterDir: string, sessionId: string,
	events: readonly TimestampedEvent[], usage?: { inputTokens: number; outputTokens: number },
): boolean {
	const sessionsDir = deps.paths.join(iterDir, "sessions");
	const jsonPath = deps.paths.join(sessionsDir, `${sessionId}.json`);
	const data = { id: sessionId, events, usage };
	deps.disk.writeFileSync(jsonPath, JSON.stringify(data, null, "\t"), "utf-8");
	// Also update the markdown with a rendered summary
	const mdPath = deps.paths.join(sessionsDir, `${sessionId}.md`);
	if (deps.disk.existsSync(mdPath)) {
		let content = deps.disk.readFileSync(mdPath, "utf-8");
		const summary = renderSessionSummary(events);
		content = content.replace(/## Output[\s\S]*$/, summary);
		deps.disk.writeFileSync(mdPath, content, "utf-8");
	}
	return true;
}

export function renderSessionSummary(events: readonly AgentStreamEvent[]): string {
	const lines: string[] = ["## Output", ""];
	if (events.length === 0) { lines.push("_No output captured._", ""); return lines.join("\n"); }

	const thinking = events.filter((e) => e.kind === "thinking").map((e) => (e as { text: string }).text).join("");
	const tools = events.filter((e) => e.kind === "tool-start") as Array<{ kind: "tool-start"; id: string; name: string }>;
	const text = events.filter((e) => e.kind === "text").map((e) => (e as { text: string }).text).join("");
	const usage = events.find((e) => e.kind === "usage") as { inputTokens: number; outputTokens: number } | undefined;

	if (thinking) {
		lines.push("### Thinking", "", `> ${thinking.slice(0, 200)}${thinking.length > 200 ? "..." : ""}`, "");
	}
	if (tools.length > 0) {
		lines.push("### Tool Usage", "");
		for (const t of tools) lines.push(`- \`${t.name}\``);
		lines.push("");
	}
	if (text) {
		lines.push("### Response", "", text, "");
	}
	if (usage) {
		lines.push("### Usage", "", `- Input: ${usage.inputTokens} tokens | Output: ${usage.outputTokens} tokens`, "");
	}
	return lines.join("\n");
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-session.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-session.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-session.test.ts"
git commit -m "feat: add structured session output and markdown summary rendering"
```

### Task 9: Rewrite `spawnAndStream` in `agents-run-menu.ts`

**Files:**
- Modify: `src/ui/menus/agents-run-menu.ts:78-108`
- Modify: `tests/ui/menus/agents-run-menu.test.ts`

- [ ] **Step 1: Rewrite spawnAndStream**

In `src/ui/menus/agents-run-menu.ts`, update `spawnAndStream` (line 78-108):

1. Update imports: replace `AgentOutputEvent` with `AgentStreamEvent`, add `renderStreamEvent` and `ThinkingDisplay`, add `appendStructuredOutput` and `TimestampedEvent`
2. Replace the subscribe callback to use typed events
3. Replace `waitForOutput` with `waitForExit`
4. Collect timestamped events for structured output

```typescript
async function spawnAndStream(
	agentName: string, briefPath: string, agent: AgentSummary, iterDir: string,
	iteration: IterationSummary, deps: RunMenuDeps, stateFilePath?: string,
): Promise<void> {
	const { buildRunSpec } = await import("../../domain/agents/agent-runner.js");
	const { checkClaudeInstalled, launchAgent } = await import("../../infrastructure/agent-process.js");
	const { createSession, updateSessionStatus, appendStructuredOutput } = await import("../../domain/agents/agent-session.js");
	const { renderAgentSpawned, renderStreamEvent } = await import("../displays/agent-run-display.js");
	if (!checkClaudeInstalled(deps)) {
		deps.log("\n  Claude CLI is not installed or not in PATH.\n");
		return;
	}
	if (stateFilePath) await updateAgentStateDuringRun(deps, stateFilePath, agentName, "busy");
	const spec = buildRunSpec(agent.ai, briefPath, deps.paths.dirname(iterDir));
	const session = createSession(deps, iterDir, agentName, iteration.number, briefPath);
	const handle = launchAgent(deps, spec, session.id);
	renderAgentSpawned(agentName, session.id, deps.log);
	updateSessionStatus(deps, iterDir, session.id, "running");

	const thinkingDisplay = (deps as { thinkingDisplay?: string }).thinkingDisplay as "full" | "indicator" | "hidden" ?? "indicator";
	const events: Array<import("../../domain/agents/agent-session.js").TimestampedEvent> = [];
	let lastUsage: { inputTokens: number; outputTokens: number } | undefined;

	handle.subscribe((event) => {
		renderStreamEvent(event, deps.log, thinkingDisplay);
		events.push({ ...event, ts: deps.clock.iso() });
		if (event.kind === "usage") lastUsage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens };
	});

	await handle.process.waitForExit(300000);
	appendStructuredOutput(deps, iterDir, session.id, events, lastUsage);
	updateSessionStatus(deps, iterDir, session.id, "completed");
	if (stateFilePath) await updateAgentStateDuringRun(deps, stateFilePath, agentName, "idle");
	deps.log("\n  Agent process finished.\n");
}
```

- [ ] **Step 2: Update tests**

Update `tests/ui/menus/agents-run-menu.test.ts` to mock `AgentStreamEvent` types and verify the new subscribe behavior, `waitForExit` call, and `appendStructuredOutput` call.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/menus/agents-run-menu.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS (all `AgentOutputEvent` references should now be resolved)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts" "01 - Projects/Flowti CLI/tests/ui/menus/agents-run-menu.test.ts"
git commit -m "feat: rewrite spawnAndStream for typed stream events and waitForExit"
```

---

## Chunk 4: Conversation Persistence + Talk Flow

### Task 10: Create `agent-conversation-store.ts`

**Files:**
- Create: `src/domain/agents/agent-conversation-store.ts`
- Create: `tests/domain/agents/agent-conversation-store.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/agents/agent-conversation-store.test.ts` with tests for all store functions:

- `loadConversation` returns empty default when file doesn't exist
- `loadConversation` returns parsed data when file exists
- `loadConversation` returns empty default on corrupt JSON
- `saveConversation` writes JSON to correct path
- `createThread` sets activeThread and creates empty turns
- `appendTurn` adds turn to active thread and updates lastActivity
- `getActiveHistory` returns last N turns
- `getActiveHistory` returns all turns when fewer than maxTurns
- `getActiveHistory` returns empty when no active thread
- `getActiveHistory` returns empty when activeThread points to non-existent ID
- `getActiveHistory` caps at maxTurns (default 20)

Follow the test patterns from other agent domain tests (mock `deps` with `disk`, `paths`).

- [ ] **Step 2: Implement agent-conversation-store.ts**

Create `src/domain/agents/agent-conversation-store.ts`:

```typescript
/**
 * agent-conversation-store.ts — Conversation persistence for the Talk flow.
 *
 * Stores per-agent conversation threads in .flowti/var/conversations/.
 * Pure functions with injected deps.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

export type ConversationStoreDeps = Pick<CliDeps, "disk" | "paths">;

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly ts: string;
	readonly thinking?: string;
}

export interface ConversationThread {
	readonly id: string;
	readonly startedAt: string;
	readonly lastActivity: string;
	readonly turns: ConversationTurn[];
}

export interface ConversationFile {
	readonly agent: string;
	readonly threads: ConversationThread[];
	readonly activeThread: string | null;
}

function emptyConversation(agentName: string): ConversationFile {
	return { agent: agentName, threads: [], activeThread: null };
}

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function loadConversation(deps: ConversationStoreDeps, dir: string, agentName: string): ConversationFile {
	const filePath = deps.paths.join(dir, "conversations", `${slugify(agentName)}.json`);
	if (!deps.disk.existsSync(filePath)) return emptyConversation(agentName);
	try {
		const raw = deps.disk.readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as ConversationFile;
	} catch { return emptyConversation(agentName); }
}

export function saveConversation(deps: ConversationStoreDeps, dir: string, agentName: string, data: ConversationFile): void {
	const convDir = deps.paths.join(dir, "conversations");
	if (!deps.disk.existsSync(convDir)) deps.disk.mkdirSync(convDir, { recursive: true });
	const filePath = deps.paths.join(convDir, `${slugify(agentName)}.json`);
	deps.disk.writeFileSync(filePath, JSON.stringify(data, null, "\t"), "utf-8");
}

export function createThread(data: ConversationFile, id: string, startedAt: string): ConversationFile {
	const thread: ConversationThread = { id, startedAt, lastActivity: startedAt, turns: [] };
	return { ...data, threads: [...data.threads, thread], activeThread: id };
}

export function appendTurn(data: ConversationFile, turn: ConversationTurn): ConversationFile {
	if (!data.activeThread) return data;
	const threads = data.threads.map((t) =>
		t.id === data.activeThread ? { ...t, turns: [...t.turns, turn], lastActivity: turn.ts } : t,
	);
	return { ...data, threads };
}

export function getActiveHistory(data: ConversationFile, maxTurns = 20): ConversationTurn[] {
	if (!data.activeThread) return [];
	const thread = data.threads.find((t) => t.id === data.activeThread);
	if (!thread) return [];
	return thread.turns.slice(-maxTurns);
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-conversation-store.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-conversation-store.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-conversation-store.test.ts"
git commit -m "feat: add conversation persistence store for agent talk flow"
```

### Task 11: Remove `buildTalkCommand` from `agent-conversation.ts`

**Files:**
- Modify: `src/domain/agents/agent-conversation.ts:163`
- Modify: `tests/domain/agents/agent-conversation.test.ts`

- [ ] **Step 1: Remove buildTalkCommand**

In `src/domain/agents/agent-conversation.ts`, remove the `buildTalkCommand` function (line 163). It is replaced by `buildClaudeArgs` from `agent-runner.ts`.

- [ ] **Step 2: Remove buildTalkCommand tests**

Remove any tests for `buildTalkCommand` from `tests/domain/agents/agent-conversation.test.ts`.

- [ ] **Step 3: Fix any import references**

Search for `buildTalkCommand` imports across the codebase and remove them. The main consumer was `agents-interact-menu.ts` which will be updated in Task 12.

- [ ] **Step 4: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: May FAIL if `agents-interact-menu.ts` still imports it. That's OK — fixed in Task 12.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-conversation.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-conversation.test.ts"
git commit -m "refactor: remove buildTalkCommand, replaced by unified buildClaudeArgs"
```

### Task 12: Update `agents-interact-menu.ts` — stream-based talk with conversation persistence

**Files:**
- Modify: `src/ui/menus/agents-interact-menu.ts:42-99`
- Modify: `tests/ui/menus/agents-interact-menu.test.ts` (if exists, otherwise check `tests/ui/menus/agents-menu.test.ts`)

This is the most complex task. The talk flow changes from batch `runAsync` to streaming `spawnBackground` + stream parsing, and adds conversation persistence.

- [ ] **Step 1: Update sendTurn to use streaming**

Replace `sendTurn` (line 42) with a stream-based version:

1. Import `buildClaudeArgs` from `agent-runner.ts` instead of `buildTalkCommand`
2. Import `parseStreamLine`, `createStreamState`, `updateStreamState` from `agent-stream.ts`
3. Import `renderStreamEvent` from `agent-run-display.ts`
4. Write prompt to temp file, use `spawnBackground` with `--prompt-file`
5. Accumulate `text` events into response, `thinking` events into thinking buffer
6. Wait for process exit via `waitForExit`
7. Parse accumulated response through `parseAgentResponse`
8. Return response with thinking

```typescript
async function sendTurn(
	agentName: string, systemPrompt: string | null, history: readonly ConversationTurn[],
	userMessage: string, ai: AgentAIConfig | undefined, deps: ShellMenuDeps,
	thinkingDisplay: "full" | "indicator" | "hidden",
): Promise<{ response: AgentResponse; thinking: string } | null> {
	const { buildConversationPrompt, parseAgentResponse } = await import("../../domain/agents/agent-conversation.js");
	const { buildClaudeArgs } = await import("../../domain/agents/agent-runner.js");
	const { parseStreamLine, createStreamState, updateStreamState } = await import("../../domain/agents/agent-stream.js");
	const { renderStreamEvent } = await import("../displays/agent-run-display.js");

	const content = buildConversationPrompt(agentName, systemPrompt, history, userMessage);
	const tempPath = deps.paths.join(deps.paths.resolve("."), `.flowti-talk-${Date.now()}.tmp`);
	deps.disk.writeFileSync(tempPath, content, "utf-8");

	try {
		const args = buildClaudeArgs(ai, tempPath);
		const proc = deps.shell.spawnBackground("claude " + args.join(" "));

		let streamState = createStreamState();
		const textBuffer: string[] = [];
		const thinkingBuffer: string[] = [];

		proc.onOutput((line: string) => {
			streamState = updateStreamState(streamState, line);
			const event = parseStreamLine(line, streamState);
			if (!event) return;
			renderStreamEvent(event, deps.log, thinkingDisplay);
			if (event.kind === "text") textBuffer.push(event.text);
			if (event.kind === "thinking") thinkingBuffer.push(event.text);
		});

		await proc.waitForExit(120000);
		const accumulated = textBuffer.join("");
		const response = parseAgentResponse(accumulated);
		return { response, thinking: thinkingBuffer.join("") };
	} finally {
		try { deps.disk.unlinkSync(tempPath); } catch { /* cleanup best-effort */ }
	}
}
```

- [ ] **Step 2: Update talkToAgentInteractive with conversation persistence**

Update the talk loop (line 75-99) to load/save conversations:

```typescript
export async function talkToAgentInteractive(
	projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: ShellMenuDeps,
): Promise<void> {
	// ... existing Claude CLI check ...
	const { loadConversation, saveConversation, createThread, appendTurn, getActiveHistory } = await import("../../domain/agents/agent-conversation-store.js");
	const varDir = deps.paths.join(deps.paths.resolve("."), ".flowti", "var");
	let conversation = loadConversation(deps, varDir, agent.name);
	const thinkingDisplay = config?.thinkingDisplay ?? "indicator";

	if (conversation.activeThread) {
		const history = getActiveHistory(conversation);
		deps.log(`\n  Resuming conversation (${history.length} turns). Send empty to start fresh.\n`);
	}

	const systemPrompt = readSystemPrompt(deps, projectPath, agent.name, config);

	while (true) {
		const userInput = await deps.input.ask(`  You`);
		if (userInput === undefined || userInput === "exit" || userInput === "quit") break;

		if (userInput === "" && conversation.activeThread) {
			conversation = createThread(conversation, `thread-${deps.clock.ms()}`, deps.clock.iso());
			saveConversation(deps, varDir, agent.name, conversation);
			deps.log(`\n  New conversation started.\n`);
			continue;
		}
		if (userInput === "") continue;

		if (!conversation.activeThread) {
			conversation = createThread(conversation, `thread-${deps.clock.ms()}`, deps.clock.iso());
		}

		const history = getActiveHistory(conversation);
		const result = await sendTurn(agent.name, systemPrompt, history, userInput, agent.ai, deps, thinkingDisplay);
		if (!result) continue;

		conversation = appendTurn(conversation, { role: "user", content: userInput, ts: deps.clock.iso() });
		conversation = appendTurn(conversation, { role: "agent", content: result.response.message, ts: deps.clock.iso(), thinking: result.thinking || undefined });
		saveConversation(deps, varDir, agent.name, conversation);

		if (result.response.status === "ready") break;
	}
}
```

- [ ] **Step 3: Update tests**

Update `tests/ui/menus/agents-interact-menu.test.ts` (or the relevant test file) to verify:
- Talk loads conversation on entry
- Talk creates new thread on empty input
- Talk persists turns after each exchange
- Talk resumes with prior history
- Error mid-stream handled gracefully

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/menus/ --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Run full type-check and test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Then: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-interact-menu.ts" "01 - Projects/Flowti CLI/tests/ui/menus/agents-interact-menu.test.ts"
git commit -m "feat: stream-based talk flow with conversation persistence"
```

---

## Chunk 5: Verification

### Task 13: Full verification

- [ ] **Step 1: Run lint + type-check + tests**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: PASS

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 3: Clean up dead code**

Remove the old `renderAgentOutput` function from `agent-run-display.ts` if no longer referenced. Search for any remaining `AgentOutputEvent` references and remove them.

- [ ] **Step 4: Run final test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: PASS

- [ ] **Step 5: Commit cleanup**

```bash
git add "01 - Projects/Flowti CLI/src/ui/displays/agent-run-display.ts"
git commit -m "chore: remove dead AgentOutputEvent code"
```
