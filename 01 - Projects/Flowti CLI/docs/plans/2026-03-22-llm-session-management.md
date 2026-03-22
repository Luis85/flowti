# LLM Session Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make LLM processes long-running and reusable across messages, with Flowti-owned persistent sessions, spawn-time priming, and graceful decay on deselect.

**Architecture:** Flowti owns conversation sessions via disk-persisted conversation store. LLM providers implement an `LLMSession` interface (interactive stdin/stdout for CLI providers, HTTP message accumulation for Ollama). The worker manager acquires a session on agent spawn, primes it with the startup prompt, and reuses it for all subsequent messages. Deselected agents enter a decay window before process cleanup.

**Tech Stack:** TypeScript, Node.js built-ins (child_process, http), Vitest

**Spec:** `docs/specs/2026-03-22-llm-session-management-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/infrastructure/types.ts:31-44` | Add `writeStdin` to `BackgroundProcess`, add `stdin` option to `spawnBackground` |
| Modify | `src/infrastructure/shell.ts:111-208` | Implement stdin piping in `spawnBackground` |
| Modify | `src/domain/agents/llm-types.ts` | Add `LLMSession`, `LLMSessionRequest`, `persistentSession` capability |
| Modify | `src/domain/agents/worker-types.ts:12` | Add `"decaying"` to `WorkerState` |
| Modify | `src/domain/agents/worker-types.ts:55-57` | Add `acquireSession` to `IAgentProcessRunner` |
| Modify | `src/domain/agents/action-handlers.ts` | Add `buildPrimingPrompt` |
| Modify | `src/infrastructure/llm/claude-provider.ts` | Add `createSession()`, update capabilities |
| Modify | `src/infrastructure/llm/cursor-provider.ts` | Add `createSession()`, update capabilities |
| Modify | `src/infrastructure/llm/ollama-provider.ts` | Add `createSession()` via `/api/chat`, update capabilities |
| Modify | `src/infrastructure/agent-process-runner.ts` | Implement `acquireSession()` |
| Modify | `src/infrastructure/worker-manager.ts` | Session lifecycle, conversation store wiring, decay timer, priming |
| Modify | `src/infrastructure/types-config.ts:238-250` | Add `decayTimeoutMs` to `AgentsConfig` |
| Test | `tests/infrastructure/shell.test.ts` | stdin piping tests |
| Modify | `tests/infrastructure/llm/claude-provider.test.ts` | Session tests |
| Modify | `tests/infrastructure/llm/cursor-provider.test.ts` | Session tests |
| Modify | `tests/infrastructure/llm/ollama-provider.test.ts` | Session tests |
| Modify | `tests/infrastructure/worker-manager.test.ts` | Session lifecycle, decay, priming tests |
| Test | `tests/domain/agents/action-handlers.test.ts` | Priming prompt tests |

---

## Chunk 1: Infrastructure Foundation (types + shell stdin)

### Task 1: Add `writeStdin` to BackgroundProcess and stdin option to IShell

**Files:**
- Modify: `src/infrastructure/types.ts:31-44,62`

- [ ] **Step 1: Add `writeStdin` to `BackgroundProcess` interface**

In `src/infrastructure/types.ts`, add after line 43 (`readonly output: string[];`):

```typescript
/** Write data to the process stdin. Only available when spawned with stdin: true. */
writeStdin(data: string): void;
```

- [ ] **Step 2: Update `spawnBackground` signature in `IShell`**

In `src/infrastructure/types.ts`, change line 62 from:

```typescript
spawnBackground(cmd: string, opts?: { cwd?: string; env?: Record<string, string> }): BackgroundProcess;
```

to:

```typescript
spawnBackground(cmd: string, opts?: { cwd?: string; env?: Record<string, string>; stdin?: boolean }): BackgroundProcess;
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep -i "shell\|types\|BackgroundProcess\|writeStdin" || echo "No type errors in changed files"`

Expected: Type errors in `shell.ts` because `spawnBackground` doesn't return `writeStdin` yet. That's expected — Task 2 fixes it.

- [ ] **Step 4: Commit type changes**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts"
git commit -m "feat(infra): add writeStdin to BackgroundProcess and stdin option to spawnBackground"
```

---

### Task 2: Implement stdin piping in shell.ts

**Files:**
- Modify: `src/infrastructure/shell.ts:111-208`

- [ ] **Step 1: Write the failing test**

Create or modify `tests/infrastructure/shell.test.ts`. If the file doesn't exist, create it:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/config.js", () => ({ CLI_PROJECT: "/mock" }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/clock.js", () => ({ clock: { ms: () => 0 } }));
vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", GREEN: "", RED: "", CYAN: "", DIM: "" }));

import { shell } from "../../src/infrastructure/shell.js";

describe("spawnBackground with stdin", () => {
	it("writeStdin sends data to child process stdin", async () => {
		// Spawn a simple echo process that reads stdin and writes to stdout
		const proc = shell.spawnBackground("node -e \"process.stdin.on('data', d => { process.stdout.write(d); process.exit(0); })\"", { stdin: true });
		proc.writeStdin("hello from stdin\n");
		const code = await proc.waitForExit(5000);
		expect(code).toBe(0);
		expect(proc.output.some(line => line.includes("hello from stdin"))).toBe(true);
	});

	it("writeStdin is no-op when stdin option not set", () => {
		const proc = shell.spawnBackground("node -e \"setTimeout(() => process.exit(0), 100)\"");
		// Should not throw
		proc.writeStdin("data");
		proc.kill();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/shell.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `writeStdin` is not a function on the returned object.

- [ ] **Step 3: Implement stdin piping in `spawnBackground`**

In `src/infrastructure/shell.ts`, modify the `spawnBackground` method:

Change the signature (line 111):
```typescript
spawnBackground(cmd: string, opts: { cwd?: string; env?: Record<string, string>; stdin?: boolean } = {}): BackgroundProcess {
```

Change the stdio line (line 116) from:
```typescript
stdio: ["ignore", "pipe", "pipe"],
```
to:
```typescript
stdio: [opts.stdin ? "pipe" : "ignore", "pipe", "pipe"],
```

Add `writeStdin` to the returned object (after the `kill()` method, before `waitForExit`):

```typescript
writeStdin(data: string): void {
	if (child.stdin && !child.stdin.destroyed) {
		child.stdin.write(data);
	}
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/shell.test.ts --config configs/vitest.config.ts`

Expected: PASS

- [ ] **Step 5: Run full test suite to check no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5`

Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/shell.test.ts"
git commit -m "feat(infra): implement stdin piping in spawnBackground"
```

---

## Chunk 2: Domain Types (LLMSession, WorkerState, priming prompt)

### Task 3: Add LLMSession types and persistentSession capability

**Files:**
- Modify: `src/domain/agents/llm-types.ts`

- [ ] **Step 1: Add `persistentSession` to `ProviderCapabilities`**

In `src/domain/agents/llm-types.ts`, add after line 18 (`readonly maxContextTokens?: number;`):

```typescript
/** Whether the provider supports long-running interactive sessions. */
readonly persistentSession: boolean;
```

This is a **required** boolean — every provider must declare it. Existing providers that don't support sessions set it to `false`. Providers updated with `createSession()` set it to `true`.

- [ ] **Step 2: Add `LLMSession` and `LLMSessionRequest` interfaces**

After the `LLMProcess` interface (after line 92), add:

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

- [ ] **Step 3: Add `createSession` to `ILLMProvider`**

In `src/domain/agents/llm-types.ts`, add after line 100 (`execute(request: LLMRequest): LLMProcess;`):

```typescript
/** Create a persistent session. Only when capabilities().persistentSession is true. */
createSession?(request: LLMSessionRequest): LLMSession;
```

- [ ] **Step 4: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep "llm-types" || echo "No type errors in llm-types"`

Expected: No type errors (all additions are optional/additive)

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/llm-types.ts"
git commit -m "feat(domain): add LLMSession, LLMSessionRequest, and persistentSession capability"
```

---

### Task 4: Add "decaying" to WorkerState and acquireSession to IAgentProcessRunner

**Files:**
- Modify: `src/domain/agents/worker-types.ts:12,55-57`

- [ ] **Step 1: Add `"decaying"` to WorkerState**

In `src/domain/agents/worker-types.ts`, change line 12 from:

```typescript
export type WorkerState = "spawning" | "idle" | "queued" | "reacting" | "thinking" | "working" | "waiting" | "stopped";
```

to:

```typescript
export type WorkerState = "spawning" | "idle" | "queued" | "reacting" | "thinking" | "working" | "waiting" | "decaying" | "stopped";
```

- [ ] **Step 2: Add `acquireSession` to `IAgentProcessRunner`**

In `src/domain/agents/worker-types.ts`, add an import for `LLMSession` at the top (after line 10):

```typescript
import type { LLMSession } from "./llm-types.js";
```

Then change the `IAgentProcessRunner` interface (lines 55-57) from:

```typescript
export interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess;
}
```

to:

```typescript
export interface IAgentProcessRunner {
	spawn(agent: AgentSummary, prompt: string, resolvedTools?: readonly string[], opts?: SpawnOptions): AgentProcess;
	/** Acquire a persistent session. Returns null if provider doesn't support sessions. Optional — legacy runners may not implement. */
	acquireSession?(agent: AgentSummary, resolvedTools?: readonly string[], opts?: SpawnOptions): LLMSession | null;
}
```

- [ ] **Step 3: Run type check — expect errors in implementors**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep "acquireSession" || echo "No errors"`

Expected: Errors in `agent-process-runner.ts` and test mocks because they don't implement `acquireSession` yet. That's expected.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts"
git commit -m "feat(domain): add decaying state and acquireSession to IAgentProcessRunner"
```

---

### Task 5: Add `decayTimeoutMs` to AgentsConfig

**Files:**
- Modify: `src/infrastructure/types-config.ts:238-250`

- [ ] **Step 1: Add field to AgentsConfig**

In `src/infrastructure/types-config.ts`, add after `maxConcurrent?: number;` (line 249):

```typescript
/** How long idle agent LLM processes stay alive after deselect, in ms. Default: 300000 (5 min). */
decayTimeoutMs?: number;
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat(config): add decayTimeoutMs to AgentsConfig"
```

---

### Task 6: Add `buildPrimingPrompt` to action-handlers

**Files:**
- Modify: `src/domain/agents/action-handlers.ts`
- Test: `tests/domain/agents/action-handlers.test.ts`

- [ ] **Step 1: Write the failing test**

The file `tests/domain/agents/action-handlers.test.ts` already exists. **Merge** the new imports into the existing import line (don't add a duplicate import from the same module — triggers `no-duplicate-imports` lint rule). Add `buildPrimingPrompt, buildCharacter` to the existing import, then add a new `describe` block:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { buildPrimingPrompt, buildCharacter } from "../../../src/domain/agents/action-handlers.js";

describe("buildPrimingPrompt", () => {
	it("builds a prompt with system instructions and character", () => {
		const result = buildPrimingPrompt("Bob", "You are a helpful assistant.", undefined, []);
		expect(result).toContain("Bob");
		expect(result).toContain("You are a helpful assistant.");
	});

	it("includes conversation history when provided", () => {
		const history = [
			{ role: "user" as const, content: "Hello" },
			{ role: "agent" as const, content: "Hi there!" },
		];
		const result = buildPrimingPrompt("Bob", null, undefined, history);
		expect(result).toContain("Hello");
		expect(result).toContain("Hi there!");
	});

	it("omits history content when history is empty", () => {
		const result = buildPrimingPrompt("Bob", null, undefined, []);
		expect(result).not.toContain("**User:** Hello");
	});

	it("includes character traits when provided", () => {
		const character = buildCharacter({
			name: "Bob", agentType: "ai", description: "A builder",
			persona: "Builder Bob", mood: "cheerful",
			skills: [], tools: [], roles: [], file: "bob.md",
		});
		const result = buildPrimingPrompt("Bob", null, character, []);
		expect(result).toContain("Builder Bob");
		expect(result).toContain("cheerful");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/action-handlers.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `buildPrimingPrompt` is not exported

- [ ] **Step 3: Implement `buildPrimingPrompt`**

In `src/domain/agents/action-handlers.ts`, add after the `buildResponsePrompt` function (after line 43):

```typescript
/** Build a priming prompt for session startup — system + character + history, no user message needed. */
export function buildPrimingPrompt(
	agentName: string,
	systemPrompt: string | null,
	character: AgentCharacter | undefined,
	history: readonly ConversationTurn[],
): string {
	return buildConversationPrompt(agentName, systemPrompt, history, "You are now active. Confirm you are ready.", character);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/action-handlers.test.ts --config configs/vitest.config.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/action-handlers.ts" "01 - Projects/Flowti CLI/tests/domain/agents/action-handlers.test.ts"
git commit -m "feat(domain): add buildPrimingPrompt for session startup"
```

---

## Chunk 3: Provider Sessions (Claude, Cursor, Ollama)

### Task 7: Claude provider — createSession with interactive mode

**Files:**
- Modify: `src/infrastructure/llm/claude-provider.ts`
- Modify: `tests/infrastructure/llm/claude-provider.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `tests/infrastructure/llm/claude-provider.test.ts`:

```typescript
describe("createSession", () => {
	it("reports persistentSession capability", () => {
		const provider = createClaudeProvider(makeDeps());
		expect(provider.capabilities().persistentSession).toBe(true);
	});

	it("createSession spawns claude without -p flag and with stdin", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const session = provider.createSession!({ tools: ["Read", "Write"] });
		expect(session).toBeDefined();
		expect(session.alive).toBe(true);
		const spawnCall = (deps.shell.spawnBackground as ReturnType<typeof vi.fn>).mock.calls[0];
		const cmd = spawnCall[0] as string;
		expect(cmd).not.toContain("-p");
		expect(cmd).toContain("--output-format");
		expect(cmd).toContain("stream-json");
		expect(cmd).toContain("--dangerously-skip-permissions");
		expect(cmd).toContain("--allowedTools");
		const opts = spawnCall[1] as { stdin?: boolean };
		expect(opts.stdin).toBe(true);
	});

	it("session.send writes message to stdin and returns LLMProcess", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const session = provider.createSession!({});
		const proc = session.send("Hello agent");
		expect(deps._mockProc.writeStdin).toBeDefined();
		expect(proc).toBeDefined();
		expect(proc.result).toBeInstanceOf(Promise);
	});

	it("session.send resolves on done event", async () => {
		const deps = makeDeps();
		// Add writeStdin to mockProc
		(deps._mockProc as Record<string, unknown>).writeStdin = vi.fn();
		const provider = createClaudeProvider(deps);
		const session = provider.createSession!({});
		const proc = session.send("Hello");
		// Simulate Claude response
		for (const cb of deps._outputCallbacks) {
			cb(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "Hi there" }] } }));
			cb(JSON.stringify({ type: "result", subtype: "success" }));
		}
		const result = await proc.result;
		expect(result.text).toBe("Hi there");
		expect(result.exitCode).toBe(0);
	});

	it("session.kill sets alive to false", () => {
		const deps = makeDeps();
		const provider = createClaudeProvider(deps);
		const session = provider.createSession!({});
		expect(session.alive).toBe(true);
		session.kill();
		expect(session.alive).toBe(false);
	});
});
```

- [ ] **Step 2: Update makeDeps to include writeStdin**

In the `makeDeps` function in the test file, add `writeStdin: vi.fn()` to `mockProc`:

```typescript
const mockProc = {
	waitForExit: vi.fn(() => Promise.resolve(0)),
	onOutput: vi.fn((cb: (line: string) => void) => { outputCallbacks.push(cb); return () => {}; }),
	kill: vi.fn(),
	running: true,
	output: [],
	waitForOutput: vi.fn(),
	writeStdin: vi.fn(),
};
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/claude-provider.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `createSession` is undefined, `persistentSession` is undefined

- [ ] **Step 4: Implement `createSession` in claude-provider.ts**

In `src/infrastructure/llm/claude-provider.ts`:

Update `CAPABILITIES` (add `persistentSession`):
```typescript
const CAPABILITIES: ProviderCapabilities = {
	streaming: true,
	thinking: true,
	toolUse: true,
	structuredOutput: true,
	persistentSession: true,
};
```

Add import for `LLMSession` and `LLMSessionRequest`:
```typescript
import type { ILLMProvider, LLMRequest, LLMProcess, LLMEvent, LLMResult, LLMSession, LLMSessionRequest, ProviderCapabilities } from "../../domain/agents/llm-types.js";
```

Add `createSession` method to the returned object (after the `execute` method):

```typescript
createSession(request: LLMSessionRequest): LLMSession {
	const args = ["--output-format", "stream-json", "--verbose", "--dangerously-skip-permissions"];
	if (request.tools && request.tools.length > 0) {
		args.push("--allowedTools", request.tools.join(","));
	}
	const cmd = ["claude", ...args.map((a) => a.includes(" ") ? `"${a}"` : a)].join(" ");
	const proc = deps.shell.spawnBackground(cmd, {
		cwd: request.cwd,
		stdin: true,
	});

	let streamState = createStreamState();
	const subscribers = new Set<(event: LLMEvent) => void>();
	let textBuffer: string[] = [];
	let thinkingBuffer: string[] = [];
	let resolveResponse: ((result: LLMResult) => void) | null = null;
	let killed = false;

	proc.onOutput((line: string) => {
		streamState = updateStreamState(streamState, line);
		for (const event of parseStreamEvents(line, streamState)) {
			if (event.kind === "thinking") thinkingBuffer.push(event.text);
			if (event.kind === "text") textBuffer.push(event.text);
			for (const cb of subscribers) {
				try { cb(event); } catch { /* subscriber error */ }
			}
			if (event.kind === "done" && resolveResponse) {
				resolveResponse({ text: textBuffer.join(""), thinking: thinkingBuffer.join(""), exitCode: 0 });
				resolveResponse = null;
			}
		}
	});

	return {
		send(message: string): LLMProcess {
			textBuffer = [];
			thinkingBuffer = [];
			const responseSubscribers = new Set<(event: LLMEvent) => void>();
			proc.writeStdin(message + "\n");
			const resultPromise = new Promise<LLMResult>((resolve) => {
				resolveResponse = resolve;
			});
			return {
				onEvent(callback) {
					responseSubscribers.add(callback);
					subscribers.add(callback);
					return () => { responseSubscribers.delete(callback); subscribers.delete(callback); };
				},
				result: resultPromise,
				kill() { proc.kill(); killed = true; },
			};
		},
		kill() { proc.kill(); killed = true; },
		get alive() { return !killed && proc.running; },
	};
},
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/claude-provider.test.ts --config configs/vitest.config.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/claude-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/claude-provider.test.ts"
git commit -m "feat(claude): add createSession for persistent interactive LLM sessions"
```

---

### Task 8: Cursor provider — createSession with interactive mode

**Files:**
- Modify: `src/infrastructure/llm/cursor-provider.ts`
- Modify: `tests/infrastructure/llm/cursor-provider.test.ts`

Same pattern as Task 7 but for the Cursor provider:

- [ ] **Step 1: Write tests for Cursor session** — mirror Claude tests, check for `agent` binary (not `claude`), no `-p`, includes `--force --trust`, `stdin: true`

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/llm/cursor-provider.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Implement `createSession` in cursor-provider.ts**

Same structure as Claude's `createSession` but:
- Binary: `agent` (not `claude`)
- Args: `--output-format stream-json --stream-partial-output --force --trust` (no `-p`)
- Uses `appendAssistantTextSkipFullDuplicate` for text dedup (matching existing `execute()`)
- `persistentSession: true` in CAPABILITIES

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/cursor-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/cursor-provider.test.ts"
git commit -m "feat(cursor): add createSession for persistent interactive LLM sessions"
```

---

### Task 9: Ollama provider — createSession with HTTP /api/chat

**Files:**
- Modify: `src/infrastructure/llm/ollama-provider.ts`
- Modify: `tests/infrastructure/llm/ollama-provider.test.ts`

- [ ] **Step 1: Write tests for Ollama session**

```typescript
describe("createSession", () => {
	it("reports persistentSession capability", () => {
		const provider = createOllamaProvider();
		expect(provider.capabilities().persistentSession).toBe(true);
	});

	it("session.send accumulates messages and resolves", async () => {
		const provider = createOllamaProvider();
		const session = provider.createSession!({});
		expect(session.alive).toBe(true);
		// Test requires mocking http.request — use vi.mock or manual mock
	});

	it("session.kill sets alive to false", () => {
		const provider = createOllamaProvider();
		const session = provider.createSession!({});
		session.kill();
		expect(session.alive).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement `createSession` in ollama-provider.ts**

Add import for `LLMSession` and `LLMSessionRequest`. Update CAPABILITIES to include `persistentSession: true`.

`createSession()` implementation:
- Maintains internal `messages: Array<{ role: string; content: string }>` array
- `send(message)`: pushes user message, POSTs to `/api/chat` with `{ model, messages, stream: true }`, pushes assistant response, returns `LLMProcess`
- Tracks `aborted` flag: `kill()` sets it true, `alive` returns `!aborted`
- Note: existing `execute()` still uses `/api/generate` — separate code path

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/llm/ollama-provider.ts" "01 - Projects/Flowti CLI/tests/infrastructure/llm/ollama-provider.test.ts"
git commit -m "feat(ollama): add createSession with /api/chat message accumulation"
```

---

## Chunk 4: Process Runner + Worker Manager

### Task 10: Implement `acquireSession` in agent-process-runner

**Files:**
- Modify: `src/infrastructure/agent-process-runner.ts`

- [ ] **Step 1: Write test**

Add to an existing or new `tests/infrastructure/agent-process-runner.test.ts`:

```typescript
describe("acquireSession", () => {
	it("returns null when no registry", () => {
		const runner = createProcessRunner(makeDeps(), undefined);
		const result = runner.acquireSession(makeAgent());
		expect(result).toBeNull();
	});

	it("returns session when provider supports persistentSession", () => {
		const mockSession = { send: vi.fn(), kill: vi.fn(), alive: true };
		const mockProvider = {
			name: "test",
			capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false, persistentSession: true }),
			execute: vi.fn(),
			createSession: vi.fn(() => mockSession),
		};
		const registry = createProviderRegistry();
		registry.register(mockProvider);
		const runner = createProcessRunner(makeDeps(), undefined, registry);
		const result = runner.acquireSession(makeAgent());
		expect(result).toBe(mockSession);
	});

	it("returns null when provider lacks persistentSession", () => {
		const mockProvider = {
			name: "test",
			capabilities: () => ({ streaming: true, thinking: false, toolUse: false, structuredOutput: false }),
			execute: vi.fn(),
		};
		const registry = createProviderRegistry();
		registry.register(mockProvider);
		const runner = createProcessRunner(makeDeps(), undefined, registry);
		const result = runner.acquireSession(makeAgent());
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement `acquireSession`**

In `src/infrastructure/agent-process-runner.ts`, add `acquireSession` to the returned object:

```typescript
acquireSession(agent: AgentSummary, resolvedTools?: readonly string[], opts?: SpawnOptions): LLMSession | null {
	if (!registry) return null;
	const selection = registry.select({
		preferred: agent.ai?.provider,
		taskType: "conversation",
		required: { streaming: true },
	});
	const caps = selection.provider.capabilities();
	if (!caps.persistentSession || !selection.provider.createSession) return null;
	return selection.provider.createSession({
		tools: resolvedTools,
		timeout: processTimeout,
		cwd: opts?.cwd,
	});
},
```

Add `LLMSession` to imports from `llm-types.js`.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Update existing test mocks that implement IAgentProcessRunner**

Since `acquireSession` is optional (`acquireSession?`), existing mocks that don't include it will still type-check. However, for test clarity, add `acquireSession: vi.fn(() => null)` to key mock factories:

- `tests/infrastructure/worker-manager.test.ts` — `makeProcessRunner()` function
- `tests/infrastructure/agent-shell.test.ts` — `createMockProcessRunner()` factory (line ~65) and all inline `IAgentProcessRunner` object literals (~10 sites)
- `tests/mocks/mock-deps.ts` — `createMockProcessRunner()` at line ~76 (if exists)

Since the interface method is optional, missing implementations won't cause type errors, but explicit null-returning mocks are cleaner.

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-process-runner.ts" "01 - Projects/Flowti CLI/tests/"
git commit -m "feat(infra): implement acquireSession in process runner"
```

---

### Task 11: Wire conversation store + session lifecycle into worker-manager

This is the largest task. It wires everything together.

**Files:**
- Modify: `src/infrastructure/worker-manager.ts`
- Modify: `tests/infrastructure/worker-manager.test.ts`

- [ ] **Step 1: Add conversation store imports and remove in-memory history**

In `src/infrastructure/worker-manager.ts`, replace the `ConversationTurn` import and `MAX_HISTORY_TURNS` constant:

Remove:
```typescript
import type { ConversationTurn } from "../domain/agents/agent-conversation.js";
const MAX_HISTORY_TURNS = 20;
```

Add:
```typescript
import { loadConversation, saveConversation, createThread, appendTurn as appendStoreTurn, getActiveHistory } from "../domain/agents/agent-conversation-store.js";
import type { ConversationFile, ConversationTurn as StoreTurn } from "../domain/agents/agent-conversation-store.js";
import type { ConversationTurn } from "../domain/agents/agent-conversation.js";
import type { LLMSession } from "../domain/agents/llm-types.js";
import { buildPrimingPrompt } from "../domain/agents/action-handlers.js";
```

- [ ] **Step 2: Update WorkerImpl interface**

Replace the `WorkerImpl` interface:

```typescript
interface WorkerImpl {
	readonly name: string;
	readonly agent: AgentSummary;
	state: WorkerState;
	messageQueue: string[];
	failureCount: number;
	session: LLMSession | null;
	conversation: ConversationFile;
	decayTimer: ReturnType<typeof setTimeout> | null;
}
```

- [ ] **Step 3: Add store-to-prompt turn mapper**

Add helper function after the existing helpers:

```typescript
function storeToPromptTurns(turns: readonly StoreTurn[]): ConversationTurn[] {
	return turns.map((t) => ({ role: t.role, content: t.content }));
}
```

- [ ] **Step 4: Update `spawnWorker` to load conversation and initialize session fields**

Update `spawnWorker` to initialize the new fields:

```typescript
function spawnWorker(agent: AgentSummary): WorkerImpl {
	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
	let conversation = loadConversation(deps, varDir, agent.name);
	if (!conversation.activeThread) {
		conversation = createThread(conversation, `t-${deps.clock.ms()}`, deps.clock.iso());
	}

	const worker: WorkerImpl = {
		name: agent.name,
		agent,
		state: "idle",
		messageQueue: [],
		failureCount: 0,
		session: null,
		conversation,
		decayTimer: null,
	};
	workers.set(agent.name, worker);

	worldState.updateEntity(agent.name, "agent", {
		identity: { name: agent.name, persona: agent.persona, type: agent.agentType },
		status: { state: "idle" },
	});

	// Prime AI agents asynchronously
	if (agent.agentType === "ai") {
		primeWorker(worker);
	}

	return worker;
}
```

- [ ] **Step 5: Add `primeWorker` function**

```typescript
async function primeWorker(worker: WorkerImpl): Promise<void> {
	const { resolvedTools } = resolveAgentPermissions(deps, vaultRoot, worker);
	const session = processRunner.acquireSession?.(worker.agent, resolvedTools) ?? null;
	worker.session = session;
	if (!session) return;

	setWorkerState(worker, "thinking", worldState);

	try {
		const systemPrompt = readSystemPrompt(deps, vaultRoot, worker.name);
		const character = buildCharacter(worker.agent);
		const history = storeToPromptTurns(getActiveHistory(worker.conversation));
		const prompt = buildPrimingPrompt(worker.name, systemPrompt, character, history);

		const proc = session.send(prompt);
		const result = await proc.result;

		if (result.text) {
			const parsed = parseAgentResponse(result.text);
			const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
			worker.conversation = appendStoreTurn(worker.conversation, { role: "agent", content: parsed.message, ts: deps.clock.iso() });
			saveConversation(deps, varDir, worker.name, worker.conversation);
		}
	} catch {
		worker.failureCount++;
	}

	if (worker.state !== "stopped") {
		setWorkerState(worker, "idle", worldState);
	}
}
```

- [ ] **Step 6: Update `handleSend` to handle "decaying" state**

Replace `handleSend`:

```typescript
function handleSend(worker: WorkerImpl, message: string, opts?: SendOptions): void {
	if (worker.state === "stopped") return;
	if (worker.state === "decaying") {
		if (worker.decayTimer) {
			clearTimeout(worker.decayTimer);
			worker.decayTimer = null;
		}
		setWorkerState(worker, "idle", worldState);
	}
	if (worker.state !== "idle") {
		worker.messageQueue.push(message);
		return;
	}
	processMessage(worker, message, opts);
}
```

- [ ] **Step 7: Update `processLlmMessage` to use session and persist turns**

Replace the `processLlmMessage` function:

```typescript
async function processLlmMessage(worker: WorkerImpl, message: string, opts: SendOptions | undefined): Promise<void> {
	// Clear decay timer synchronously before any async work
	if (worker.decayTimer) {
		clearTimeout(worker.decayTimer);
		worker.decayTimer = null;
	}

	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");

	// Session path — reuse live session
	if (worker.session?.alive) {
		setWorkerState(worker, "thinking", worldState);
		try {
			setWorkerState(worker, "working", worldState);
			const proc = worker.session.send(message);
			if (opts?.onEvent) proc.onEvent(opts.onEvent);
			const result = await proc.result;

			const parsed = parseAgentResponse(result.text);
			worker.conversation = appendStoreTurn(worker.conversation, { role: "user", content: message, ts: deps.clock.iso() });
			worker.conversation = appendStoreTurn(worker.conversation, { role: "agent", content: parsed.message, ts: deps.clock.iso() });
			saveConversation(deps, varDir, worker.name, worker.conversation);

			worker.failureCount = 0;
			opts?.onResponse?.(parsed);
		} catch {
			worker.failureCount++;
		}

		if (worker.state !== "stopped") {
			setWorkerState(worker, "idle", worldState);
		}
		drainQueue(worker);
		return;
	}

	// Try to acquire a new session (session died or first fallback attempt)
	if (!worker.session) {
		const { resolvedTools } = resolveAgentPermissions(deps, vaultRoot, worker);
		worker.session = processRunner.acquireSession?.(worker.agent, resolvedTools) ?? null;
		if (worker.session) {
			// Re-prime with history then send message
			const systemPrompt = readSystemPrompt(deps, vaultRoot, worker.name);
			const character = buildCharacter(worker.agent);
			const history = storeToPromptTurns(getActiveHistory(worker.conversation));
			const prompt = buildPrimingPrompt(worker.name, systemPrompt, character, history);
			try {
				await worker.session.send(prompt).result;
			} catch {
				worker.session = null;
			}
		}
		if (worker.session?.alive) {
			// Session acquired and primed — now send the actual message
			setWorkerState(worker, "thinking", worldState);
			try {
				setWorkerState(worker, "working", worldState);
				const proc = worker.session.send(message);
				if (opts?.onEvent) proc.onEvent(opts.onEvent);
				const result = await proc.result;

				const parsed = parseAgentResponse(result.text);
				worker.conversation = appendStoreTurn(worker.conversation, { role: "user", content: message, ts: deps.clock.iso() });
				worker.conversation = appendStoreTurn(worker.conversation, { role: "agent", content: parsed.message, ts: deps.clock.iso() });
				saveConversation(deps, varDir, worker.name, worker.conversation);

				worker.failureCount = 0;
				opts?.onResponse?.(parsed);
			} catch {
				worker.failureCount++;
			}

			if (worker.state !== "stopped") {
				setWorkerState(worker, "idle", worldState);
			}
			drainQueue(worker);
			return;
		}
	}

	// Fallback — one-shot with history in prompt
	const prompt = buildPrompt(deps, vaultRoot, worker, message, opts);
	const { resolvedTools } = resolveAgentPermissions(deps, vaultRoot, worker);

	let proc: import("../domain/agents/worker-types.js").AgentProcess;
	if (pool) {
		const acquired = pool.acquire(worker.agent, prompt, resolvedTools);
		if (acquired.queued) {
			setWorkerState(worker, "queued", worldState);
		}
		proc = acquired.process;
	} else {
		proc = processRunner.spawn(worker.agent, prompt, resolvedTools);
	}

	if (opts?.onEvent) proc.onEvent(opts.onEvent);
	setWorkerState(worker, "thinking", worldState);

	try {
		setWorkerState(worker, "working", worldState);
		const result = await proc.result;
		if (pool) pool.release(worker.name);

		const stopped = handleLlmResult(worker, result.exitCode, result.text, worldState);
		if (stopped) return;

		const freshState = readAgentState(deps, varDir, worker.name);
		const cleared = clearOnceGrants(freshState);
		if (cleared !== freshState) writeAgentState(deps, varDir, worker.name, cleared);

		const parsed = parseAgentResponse(result.text);

		worker.conversation = appendStoreTurn(worker.conversation, { role: "user", content: message, ts: deps.clock.iso() });
		worker.conversation = appendStoreTurn(worker.conversation, { role: "agent", content: parsed.message, ts: deps.clock.iso() });
		saveConversation(deps, varDir, worker.name, worker.conversation);

		opts?.onResponse?.(parsed);
	} catch {
		worker.failureCount++;
		if (pool) pool.release(worker.name);
	}

	if (worker.state !== "stopped") {
		setWorkerState(worker, "idle", worldState);
	}
	drainQueue(worker);
}
```

- [ ] **Step 8: Update `buildPrompt` to use conversation store for history**

Replace the `buildPrompt` function:

```typescript
function buildPrompt(
	deps: WorkerManagerDeps,
	vaultRoot: string,
	worker: WorkerImpl,
	message: string,
	opts: SendOptions | undefined,
): string {
	const systemPrompt = readSystemPrompt(deps, vaultRoot, worker.name);
	const character = buildCharacter(worker.agent);
	const history = storeToPromptTurns(getActiveHistory(worker.conversation));
	return opts?.task
		? buildTaskPrompt(worker.name, message, systemPrompt, character)
		: buildResponsePrompt(worker.name, message, systemPrompt, character, history);
}
```

- [ ] **Step 9: Update `stop` to use decay timer**

Replace the `stop` method in the returned manager:

```typescript
stop(agentName: string): void {
	const worker = workers.get(agentName);
	if (!worker) return;

	// If worker has a live session, enter decay instead of immediate stop
	if (worker.session?.alive) {
		setWorkerState(worker, "decaying", worldState);
		const timeout = config?.decayTimeoutMs ?? 300_000;
		worker.decayTimer = setTimeout(() => {
			worker.session?.kill();
			worker.session = null;
			worker.decayTimer = null;
			setWorkerState(worker, "stopped", worldState);
		}, timeout);
		return;
	}

	if (pool) pool.cancel(agentName);
	setWorkerState(worker, "stopped", worldState);
},
```

- [ ] **Step 10: Update `stopAll` to bypass decay — immediate kill**

```typescript
stopAll(): void {
	for (const worker of workers.values()) {
		if (worker.decayTimer) {
			clearTimeout(worker.decayTimer);
			worker.decayTimer = null;
		}
		if (worker.session) {
			worker.session.kill();
			worker.session = null;
		}
		setWorkerState(worker, "stopped", worldState);
	}
},
```

- [ ] **Step 11: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep "worker-manager" || echo "No type errors"`

- [ ] **Step 12: Commit implementation**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts"
git commit -m "feat(worker-manager): wire session lifecycle, conversation store, decay timer"
```

---

### Task 12: Update worker-manager tests

**Files:**
- Modify: `tests/infrastructure/worker-manager.test.ts`

- [ ] **Step 1: Update `makeProcessRunner` to include `acquireSession`**

```typescript
function makeProcessRunner(resultOverride?, sessionOverride?: { send: ReturnType<typeof vi.fn>; kill: ReturnType<typeof vi.fn>; alive: boolean } | null) {
	// ... existing code ...
	return {
		spawn: vi.fn(/* existing */),
		acquireSession: vi.fn(() => sessionOverride ?? null),
		get _lastProc() { return lastProc; },
	};
}
```

- [ ] **Step 2: Add mock session factory**

```typescript
function makeMockSession(responseText = "Ready") {
	return {
		send: vi.fn(() => ({
			onEvent: vi.fn(() => () => {}),
			result: Promise.resolve({ text: responseText, thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		})),
		kill: vi.fn(),
		alive: true,
	};
}
```

- [ ] **Step 3: Write session lifecycle tests**

```typescript
// ── Session lifecycle ────────────────────────────────────────────

it("spawn primes AI agent with startup prompt via session", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	await vi.waitFor(() => expect(session.send).toHaveBeenCalled());
	const prompt = session.send.mock.calls[0][0] as string;
	expect(prompt).toContain("Bob");
});

it("reuses session for subsequent messages", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession("Hi");
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(1)); // priming

	mgr.send("Bob", "Hello");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(2));
	// Verify runner.spawn was never called (session used instead)
	expect(runner.spawn).not.toHaveBeenCalled();
});

it("falls back to one-shot when no session support", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const runner = makeProcessRunner(); // acquireSession returns null
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.send("Bob", "Hello");
	await vi.waitFor(() => expect(runner.spawn).toHaveBeenCalled());
});
```

- [ ] **Step 4: Write decay timer tests**

```typescript
it("stop enters decaying state when session is alive", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const ws = makeWorldState();
	const mgr = createWorkerManager(makeDeps(), ws, runner, "/vault", undefined);
	mgr.spawnAll();
	// Wait for priming to complete before stopping
	await vi.waitFor(() => expect(session.send).toHaveBeenCalled());
	mgr.stop("Bob");
	const worker = mgr.getWorker("Bob");
	expect(worker!.state).toBe("decaying");
	expect(session.kill).not.toHaveBeenCalled(); // not killed yet
});

it("message to decaying worker clears timer and processes", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession("Ok");
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(1));

	mgr.stop("Bob"); // enters decaying
	mgr.send("Bob", "Wake up");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(2));
	const worker = mgr.getWorker("Bob");
	expect(worker!.state).toBe("idle");
});

it("stopAll bypasses decay and kills sessions immediately", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.stopAll();
	expect(session.kill).toHaveBeenCalled();
	const worker = mgr.getWorker("Bob");
	expect(worker!.state).toBe("stopped");
});
```

- [ ] **Step 5: Update existing tests that check prompt history**

Remove or update the "includes prior conversation history in subsequent prompts" and "does not include history for task prompts" tests from the earlier in-memory fix — they should now test via the conversation store path.

- [ ] **Step 6: Run all worker-manager tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`

Expected: All tests pass

- [ ] **Step 7: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5`

Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/infrastructure/worker-manager.test.ts"
git commit -m "test(worker-manager): add session lifecycle, decay timer, and priming tests"
```

---

## Chunk 5: Validation + Final Cleanup

### Task 13: Validate interactive mode response boundaries

**This is a manual validation step.** Before shipping, verify that Claude and Cursor CLIs emit `type: "result"` NDJSON events in interactive mode (no `-p`).

- [ ] **Step 1: Test Claude interactive stream-json**

Run manually:
```bash
echo "Say hello" | claude --output-format stream-json --verbose 2>/dev/null
```

Verify the output contains a `{"type":"result",...}` line. If not, update the response boundary detection in `claude-provider.ts` to use `message_stop` or a quiet-period heuristic.

- [ ] **Step 2: Test Cursor interactive stream-json (if available)**

```bash
echo "Say hello" | agent --output-format stream-json --force --trust 2>/dev/null
```

Same verification.

- [ ] **Step 3: Document results in a comment at the top of claude-provider.ts createSession**

---

### Task 14: Final integration test and cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep -c "error" || echo "0 errors"`

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

Expected: `Built: .flowti/bin/main.mjs`

- [ ] **Step 5: Final commit if any lint/type fixes were needed**

```bash
git add "01 - Projects/Flowti CLI/"
git commit -m "fix: address lint and type issues from LLM session management"
```
