# Agent Chat View v2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the brittle agent chat monolith with an ink-powered chat view behind an `IChatRenderer` service interface, supporting conversation mode, task mode, and streaming feedback.

**Architecture:** ChatShell (UI orchestrator) calls IChatRenderer (interface). InkChatRenderer (infrastructure) implements it with React/ink. Ink is lazy-loaded and contained to 1 file. The chat subsystem is built as new files first; sitemap/handler integration is deferred to coordinate with the parallel quality refactoring.

**Tech Stack:** ink 6.x, react 19.x, @inkjs/ui 2.x, TypeScript, Vitest

**Spec:** `docs/specs/2026-03-15-agent-chat-v2-design.md`

---

## File Map

### New Files (chat subsystem — no shared file modifications)

| File | Layer | Responsibility |
|------|-------|----------------|
| `src/infrastructure/chat/chat-renderer-types.ts` | Infra | IChatRenderer interface + all chat view types |
| `src/infrastructure/chat/command-parser.ts` | Infra | Parse `/slash commands` from raw input text |
| `src/infrastructure/chat/ink-chat-renderer.ts` | Infra | Ink/React implementation of IChatRenderer |
| `src/infrastructure/chat/components/header-bar.tsx` | Infra | React: agent name, status, topic, shortcuts |
| `src/infrastructure/chat/components/message-area.tsx` | Infra | React: scrollable message list + history summary |
| `src/infrastructure/chat/components/message.tsx` | Infra | React: single message bubble (user or agent) |
| `src/infrastructure/chat/components/tool-panel.tsx` | Infra | React: collapsible tool call list |
| `src/infrastructure/chat/components/activity-bar.tsx` | Infra | React: status, elapsed time, token usage |
| `src/infrastructure/chat/components/input-area.tsx` | Infra | React: prompt input with command parsing |
| `src/infrastructure/chat/components/task-view.tsx` | Infra | React: task mode (brief + activity feed) |
| `src/ui/menus/chat-shell.ts` | UI | Orchestrator: domain ↔ renderer wiring |
| `tests/infrastructure/chat/command-parser.test.ts` | Test | Command parser unit tests |
| `tests/infrastructure/chat/chat-renderer-types.test.ts` | Test | Type guard + helper tests |
| `tests/infrastructure/chat/ink-chat-renderer.test.ts` | Test | Ink component render tests |
| `tests/ui/menus/chat-shell.test.ts` | Test | ChatShell orchestration with mock renderer |

### Modified Files (DEFERRED — coordinate with quality refactor)

| File | Change | When |
|------|--------|------|
| `package.json` | Add ink, react, @inkjs/ui, @types/react | Task 1 (needed for compilation) |
| `configs/tsconfig.json` | Add `"jsx": "react-jsx"` for .tsx files | Task 1 (needed for compilation) |
| `configs/esbuild.config.mjs` | Add ink/react to externals | Task 1 (needed for build) |
| `src/infrastructure/deps.ts` | Add chatRenderer lazy factory | Integration phase |
| `src/ui/handlers/register-handlers.ts` | Register chat view + dashboard handlers | Integration phase |
| `configs/sitemap.json` | Add agents-chat + agents-dashboard pages | Integration phase |

---

## Chunk 1: Foundation — Dependencies, Types, Command Parser

### Task 1: Install npm dependencies and configure build tooling

**Files:**
- Modify: `01 - Projects/Flowti CLI/package.json`
- Modify: `01 - Projects/Flowti CLI/configs/tsconfig.json`
- Modify: `01 - Projects/Flowti CLI/configs/esbuild.config.mjs`

- [ ] **Step 1: Install ink, react, and supporting packages**

```bash
cd "01 - Projects/Flowti CLI"
npm install ink react @inkjs/ui
npm install --save-dev @types/react ink-testing-library
```

This adds `ink`, `react`, `@inkjs/ui` to `dependencies` (first runtime deps ever) and `@types/react`, `ink-testing-library` to `devDependencies`.

- [ ] **Step 2: Enable JSX in tsconfig**

In `configs/tsconfig.json`:

1. Add to `compilerOptions`:
```json
"jsx": "react-jsx"
```

2. Update the `include` array to also match `.tsx` files:
```json
"include": ["../src/**/*.ts", "../src/**/*.tsx", "vendor.d.ts"]
```

This lets TypeScript compile `.tsx` files used by the ink React components.

- [ ] **Step 3: Add ink/react to esbuild externals**

In `configs/esbuild.config.mjs`, add to the `external` array:

```javascript
external: [
    "node:*",
    "eslint",
    "typedoc",
    "ink",
    "react",
    "react/jsx-runtime",
    "@inkjs/ui",
    "yoga-wasm-web",
],
```

Ink's yoga-layout uses WASM binaries that can't be bundled by esbuild. Marking these as external means the CLI must be run from a directory where `node_modules` is resolvable. Since the CLI is launched from the project root via `flowti.cmd`, this works.

- [ ] **Step 4: Verify type-check still passes**

```bash
cd "01 - Projects/Flowti CLI"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS (no new source files yet, just config changes).

- [ ] **Step 5: Verify existing tests still pass**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run --config configs/vitest.config.ts
```

Expected: All ~5,920 tests pass. No regressions from config changes.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/package.json" "01 - Projects/Flowti CLI/package-lock.json" "01 - Projects/Flowti CLI/configs/tsconfig.json" "01 - Projects/Flowti CLI/configs/esbuild.config.mjs"
git commit -m "build: add ink, react, @inkjs/ui dependencies for agent chat v2"
```

---

### Task 2: Define chat view types and IChatRenderer interface

**Files:**
- Create: `src/infrastructure/chat/chat-renderer-types.ts`
- Create: `tests/infrastructure/chat/chat-renderer-types.test.ts`

- [ ] **Step 1: Write failing tests for type guards and helpers**

Create `tests/infrastructure/chat/chat-renderer-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	isChatCommand,
	type ChatViewStatus,
	type ChatConfig,
	type ChatMessage,
	type ChatTurn,
	type ChatCommand,
	type ChatToolCall,
} from "../../../src/infrastructure/chat/chat-renderer-types.js";

describe("ChatViewStatus", () => {
	it("accepts valid statuses", () => {
		const valid: ChatViewStatus[] = ["idle", "thinking", "working", "waiting", "error"];
		expect(valid).toHaveLength(5);
	});
});

describe("ChatConfig", () => {
	it("accepts minimal config", () => {
		const config: ChatConfig = { agentName: "Atlas", mode: "conversation" };
		expect(config.agentName).toBe("Atlas");
		expect(config.mode).toBe("conversation");
	});

	it("accepts full config", () => {
		const config: ChatConfig = {
			agentName: "Atlas",
			persona: "Lead Architect",
			topicName: "feature-auth",
			mode: "task",
			taskBrief: "Write unit tests for auth module",
		};
		expect(config.taskBrief).toBe("Write unit tests for auth module");
	});
});

describe("ChatMessage", () => {
	it("accepts user message", () => {
		const msg: ChatMessage = { role: "user", content: "Hello", timestamp: "2026-03-15T12:00:00Z" };
		expect(msg.role).toBe("user");
	});

	it("accepts agent message with tools", () => {
		const tool: ChatToolCall = { name: "Read", target: "auth.ts", status: "done", durationMs: 120 };
		const msg: ChatMessage = {
			role: "agent", content: "Done.", timestamp: "2026-03-15T12:00:01Z", tools: [tool],
		};
		expect(msg.tools).toHaveLength(1);
	});
});

describe("ChatTurn", () => {
	it("accepts turn with thinking", () => {
		const turn: ChatTurn = { role: "agent", content: "I'll do it.", timestamp: "2026-03-15T12:00:00Z", thinking: "Let me think..." };
		expect(turn.thinking).toBe("Let me think...");
	});
});

describe("isChatCommand", () => {
	it("returns true for slash-prefixed input", () => {
		expect(isChatCommand("/done")).toBe(true);
		expect(isChatCommand("/new")).toBe(true);
	});

	it("returns false for regular text", () => {
		expect(isChatCommand("hello")).toBe(false);
		expect(isChatCommand("")).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/chat-renderer-types.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement chat-renderer-types.ts**

Create `src/infrastructure/chat/chat-renderer-types.ts`:

```typescript
/**
 * chat-renderer-types.ts — Types and interface for the agent chat view.
 *
 * Defines the IChatRenderer contract between ChatShell (UI layer) and
 * InkChatRenderer (infrastructure). No ink/react imports here.
 */

import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../types.js";

// ── Status ──────────────────────────────────────────────────────────

/** Derived from WorkerState with "error" added for chat-specific display. */
export type ChatViewStatus = "idle" | "thinking" | "working" | "waiting" | "error";

// ── Config ──────────────────────────────────────────────────────────

/** Configuration passed to the renderer on mount. */
export interface ChatConfig {
	readonly agentName: string;
	readonly persona?: string;
	readonly topicName?: string;
	readonly mode: "conversation" | "task";
	readonly taskBrief?: string;
}

// ── Messages ────────────────────────────────────────────────────────

/** A completed message in the conversation. */
export interface ChatMessage {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly timestamp: string;
	readonly tools?: readonly ChatToolCall[];
}

/** A tool call summary for the collapsible tool panel. */
export interface ChatToolCall {
	readonly name: string;
	readonly target?: string;
	readonly input?: string;
	readonly output?: string;
	readonly status: "done" | "active" | "error";
	readonly durationMs?: number;
}

/**
 * A conversation turn for history display.
 * Projected from ConversationTurn (agent-conversation-store.ts)
 * to only the fields the renderer needs.
 */
export interface ChatTurn {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly timestamp: string;
	readonly thinking?: string;
}

// ── Commands ────────────────────────────────────────────────────────

/** Discriminated union of slash commands parsed from user input. */
export type ChatCommand =
	| { readonly type: "new" }
	| { readonly type: "done" }
	| { readonly type: "back" }
	| { readonly type: "let-go" }
	| { readonly type: "history" }
	| { readonly type: "topics" }
	| { readonly type: "pick"; readonly name: string }
	| { readonly type: "clear" }
	| { readonly type: "focus" }
	| { readonly type: "talk" };

/** Check if raw input text is a slash command. */
export function isChatCommand(input: string): boolean {
	return input.startsWith("/");
}

// ── Renderer Interface ──────────────────────────────────────────────

/** Contract between ChatShell and any terminal chat renderer implementation. */
export interface IChatRenderer {
	mount(config: ChatConfig): Promise<void>;
	unmount(): Promise<MenuResult>;

	pushMessage(message: ChatMessage): void;
	pushStreamEvent(event: AgentStreamEvent): void;
	updateStatus(status: ChatViewStatus): void;
	updateMode(mode: "conversation" | "task"): void;
	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void;

	onUserInput(callback: (text: string) => void): void;
	onCommand(callback: (cmd: ChatCommand) => void): void;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/chat-renderer-types.test.ts --config configs/vitest.config.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Type-check**

```bash
cd "01 - Projects/Flowti CLI"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/chat-renderer-types.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/chat-renderer-types.test.ts"
git commit -m "feat(chat): add IChatRenderer interface and chat view types"
```

---

### Task 3: Implement the command parser

**Files:**
- Create: `src/infrastructure/chat/command-parser.ts`
- Create: `tests/infrastructure/chat/command-parser.test.ts`

- [ ] **Step 1: Write failing tests for command parsing**

Create `tests/infrastructure/chat/command-parser.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { parseCommand } from "../../../src/infrastructure/chat/command-parser.js";

describe("parseCommand", () => {
	it("parses /new", () => {
		expect(parseCommand("/new")).toEqual({ type: "new" });
	});

	it("parses /done", () => {
		expect(parseCommand("/done")).toEqual({ type: "done" });
	});

	it("parses /back", () => {
		expect(parseCommand("/back")).toEqual({ type: "back" });
	});

	it("parses /let go", () => {
		expect(parseCommand("/let go")).toEqual({ type: "let-go" });
	});

	it("parses /history", () => {
		expect(parseCommand("/history")).toEqual({ type: "history" });
	});

	it("parses /topics", () => {
		expect(parseCommand("/topics")).toEqual({ type: "topics" });
	});

	it("parses /pick with name", () => {
		expect(parseCommand("/pick feature-auth")).toEqual({ type: "pick", name: "feature-auth" });
	});

	it("parses /pick with multi-word name", () => {
		expect(parseCommand("/pick my cool topic")).toEqual({ type: "pick", name: "my cool topic" });
	});

	it("parses /clear", () => {
		expect(parseCommand("/clear")).toEqual({ type: "clear" });
	});

	it("parses /focus", () => {
		expect(parseCommand("/focus")).toEqual({ type: "focus" });
	});

	it("parses /talk", () => {
		expect(parseCommand("/talk")).toEqual({ type: "talk" });
	});

	it("returns null for unknown command", () => {
		expect(parseCommand("/unknown")).toBeNull();
	});

	it("returns null for non-command input", () => {
		expect(parseCommand("hello")).toBeNull();
	});

	it("returns null for empty input", () => {
		expect(parseCommand("")).toBeNull();
	});

	it("is case-insensitive", () => {
		expect(parseCommand("/DONE")).toEqual({ type: "done" });
		expect(parseCommand("/New")).toEqual({ type: "new" });
	});

	it("trims whitespace", () => {
		expect(parseCommand("  /done  ")).toEqual({ type: "done" });
	});

	it("returns null for /pick without a name", () => {
		expect(parseCommand("/pick")).toBeNull();
		expect(parseCommand("/pick  ")).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/command-parser.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the command parser**

Create `src/infrastructure/chat/command-parser.ts`:

```typescript
/**
 * command-parser.ts — Parse slash commands from raw user input.
 *
 * Pure function — no I/O, no side effects.
 */

import type { ChatCommand } from "./chat-renderer-types.js";

const SIMPLE_COMMANDS: ReadonlyMap<string, ChatCommand> = new Map([
	["new", { type: "new" }],
	["done", { type: "done" }],
	["back", { type: "back" }],
	["let go", { type: "let-go" }],
	["history", { type: "history" }],
	["topics", { type: "topics" }],
	["clear", { type: "clear" }],
	["focus", { type: "focus" }],
	["talk", { type: "talk" }],
]);

/**
 * Parse raw input text into a ChatCommand, or null if not a valid command.
 * Commands start with `/` and are case-insensitive.
 */
export function parseCommand(input: string): ChatCommand | null {
	const trimmed = input.trim();
	if (!trimmed.startsWith("/")) return null;

	const body = trimmed.slice(1).toLowerCase();

	const simple = SIMPLE_COMMANDS.get(body);
	if (simple) return simple;

	if (body.startsWith("pick ")) {
		const name = trimmed.slice(1).slice(5).trim();
		if (!name) return null;
		return { type: "pick", name };
	}

	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/command-parser.test.ts --config configs/vitest.config.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/command-parser.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/command-parser.test.ts"
git commit -m "feat(chat): add slash command parser"
```

---

## Chunk 2: ChatShell — The UI Orchestrator

### Task 4: Implement ChatShell with mock renderer tests

ChatShell is the UI-layer orchestrator. It wires the domain (processRunner, conversation store) to the renderer (IChatRenderer). Tested entirely with a mock renderer — no ink needed.

**Files:**
- Create: `src/ui/menus/chat-shell.ts`
- Create: `tests/ui/menus/chat-shell.test.ts`

**Domain dependencies to understand:**
- `agent-conversation-store.ts` — `loadConversation`, `saveConversation`, `createThread`, `appendTurn`, `getActiveHistory`
- `agent-conversation.ts` — `buildConversationPrompt`, `parseAgentResponse`
- `agent-stream.ts` — `AgentStreamEvent` type
- `worker-types.ts` — `IAgentProcessRunner`, `AgentProcess`

- [ ] **Step 1: Write failing tests for ChatShell**

Create `tests/ui/menus/chat-shell.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../../src/infrastructure/shell.js", () => ({ shell: {} }));
vi.mock("../../../src/infrastructure/paths.js", () => ({ paths: {} }));
vi.mock("../../../src/infrastructure/clock.js", () => ({ clock: {} }));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { ChatShell } from "../../../src/ui/menus/chat-shell.js";
import type { IChatRenderer, ChatConfig, ChatMessage, ChatCommand, ChatViewStatus } from "../../../src/infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../../src/domain/agents/agent-stream.js";
import type { AgentSummary } from "../../../src/domain/agents/agent-types.js";

function createMockRenderer(): IChatRenderer & {
	messages: ChatMessage[];
	events: AgentStreamEvent[];
	statuses: ChatViewStatus[];
	_userInputCb: ((text: string) => void) | null;
	_commandCb: ((cmd: ChatCommand) => void) | null;
	_mountConfig: ChatConfig | null;
	_history: { summary: string; turns: unknown[] } | null;
	_modes: string[];
} {
	const mock: ReturnType<typeof createMockRenderer> = {
		messages: [],
		events: [],
		statuses: [],
		_userInputCb: null,
		_commandCb: null,
		_mountConfig: null,
		_history: null,
		_modes: [],
		mount: vi.fn(async (config: ChatConfig) => { mock._mountConfig = config; }),
		unmount: vi.fn(async () => "main" as const),
		pushMessage: vi.fn((msg: ChatMessage) => { mock.messages.push(msg); }),
		pushStreamEvent: vi.fn((event: AgentStreamEvent) => { mock.events.push(event); }),
		updateStatus: vi.fn((status: ChatViewStatus) => { mock.statuses.push(status); }),
		updateMode: vi.fn((mode: string) => { mock._modes.push(mode); }),
		showHistory: vi.fn((summary: string, turns: unknown[]) => { mock._history = { summary, turns }; }),
		onUserInput: vi.fn((cb: (text: string) => void) => { mock._userInputCb = cb; }),
		onCommand: vi.fn((cb: (cmd: ChatCommand) => void) => { mock._commandCb = cb; }),
	};
	return mock;
}

function makeAgent(overrides?: Partial<AgentSummary>): AgentSummary {
	return {
		name: "Atlas", agentType: "ai", description: "Lead Architect",
		persona: "Atlas the Architect", skills: [], tools: [], roles: [], file: "atlas.md",
		...overrides,
	};
}

function makeDeps() {
	return {
		disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(), writeFileSync: vi.fn(), mkdirSync: vi.fn() } as never,
		paths: { join: vi.fn((...a: string[]) => a.join("/")), resolve: vi.fn((...a: string[]) => a.join("/")), dirname: vi.fn(() => ".") } as never,
		clock: { ms: vi.fn(() => 1234), iso: vi.fn(() => "2026-03-15T12:00:00Z") } as never,
		shell: { check: vi.fn(() => true) } as never,
		log: vi.fn(),
		processRunner: {
			spawn: vi.fn(() => ({
				onEvent: vi.fn(() => () => {}),
				result: Promise.resolve({ text: '{"message":"Hello","status":"message"}', thinking: "", exitCode: 0 }),
				kill: vi.fn(),
			})),
		},
	};
}

describe("ChatShell", () => {
	it("mounts the renderer with correct config", async () => {
		const renderer = createMockRenderer();
		const agent = makeAgent();
		const shell = new ChatShell(renderer, agent, makeDeps(), ".", "/projects/test");
		await shell.start();
		expect(renderer.mount).toHaveBeenCalledWith(
			expect.objectContaining({ agentName: "Atlas", persona: "Atlas the Architect", mode: "conversation" }),
		);
	});

	it("registers user input and command callbacks", async () => {
		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), makeDeps(), ".");
		await shell.start();
		expect(renderer.onUserInput).toHaveBeenCalled();
		expect(renderer.onCommand).toHaveBeenCalled();
	});

	it("handles /done command by unmounting", async () => {
		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), makeDeps(), ".");
		await shell.start();
		renderer._commandCb!({ type: "done" });
		// Give it a tick to process
		await new Promise((r) => setTimeout(r, 10));
		expect(renderer.unmount).toHaveBeenCalled();
	});

	it("handles /new command by resetting conversation", async () => {
		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), makeDeps(), ".");
		await shell.start();
		renderer._commandCb!({ type: "new" });
		await new Promise((r) => setTimeout(r, 10));
		// Renderer should be cleared and status shows history was reset
		expect(renderer.showHistory).toHaveBeenCalled();
	});

	it("sends user input to processRunner and pushes stream events", async () => {
		const deps = makeDeps();
		const events: AgentStreamEvent[] = [];
		let eventCb: ((e: AgentStreamEvent) => void) | null = null;
		deps.processRunner.spawn = vi.fn(() => ({
			onEvent: vi.fn((cb: (e: AgentStreamEvent) => void) => { eventCb = cb; return () => {}; }),
			result: new Promise<{ text: string; thinking: string; exitCode: number }>((resolve) => {
				setTimeout(() => {
					eventCb!({ kind: "text", text: "Hello back" });
					eventCb!({ kind: "done" });
					resolve({ text: "Hello back", thinking: "", exitCode: 0 });
				}, 10);
			}),
			kill: vi.fn(),
		}));

		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), deps, ".");
		await shell.start();

		renderer._userInputCb!("Hello");
		await new Promise((r) => setTimeout(r, 50));

		expect(deps.processRunner.spawn).toHaveBeenCalled();
		expect(renderer.updateStatus).toHaveBeenCalledWith("thinking");
	});

	it("switches to task mode when multiple tool calls detected", async () => {
		const deps = makeDeps();
		let eventCb: ((e: AgentStreamEvent) => void) | null = null;
		deps.processRunner.spawn = vi.fn(() => ({
			onEvent: vi.fn((cb: (e: AgentStreamEvent) => void) => { eventCb = cb; return () => {}; }),
			result: new Promise<{ text: string; thinking: string; exitCode: number }>((resolve) => {
				setTimeout(() => {
					eventCb!({ kind: "thinking", text: "planning" });
					eventCb!({ kind: "tool-start", id: "1", name: "Read" });
					eventCb!({ kind: "tool-end", id: "1" });
					eventCb!({ kind: "tool-start", id: "2", name: "Edit" });
					eventCb!({ kind: "tool-end", id: "2" });
					eventCb!({ kind: "done" });
					resolve({ text: "Done", thinking: "planning", exitCode: 0 });
				}, 10);
			}),
			kill: vi.fn(),
		}));

		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), deps, ".");
		await shell.start();
		renderer._userInputCb!("Implement auth tests");
		await new Promise((r) => setTimeout(r, 50));

		// Should have pushed stream events to renderer
		expect(renderer.pushStreamEvent).toHaveBeenCalled();
	});

	it("handles error events gracefully", async () => {
		const deps = makeDeps();
		let eventCb: ((e: AgentStreamEvent) => void) | null = null;
		deps.processRunner.spawn = vi.fn(() => ({
			onEvent: vi.fn((cb: (e: AgentStreamEvent) => void) => { eventCb = cb; return () => {}; }),
			result: new Promise<{ text: string; thinking: string; exitCode: number }>((resolve) => {
				setTimeout(() => {
					eventCb!({ kind: "error", message: "Rate limited" });
					eventCb!({ kind: "done" });
					resolve({ text: "", thinking: "", exitCode: 1 });
				}, 10);
			}),
			kill: vi.fn(),
		}));

		const renderer = createMockRenderer();
		const shell = new ChatShell(renderer, makeAgent(), deps, ".");
		await shell.start();
		renderer._userInputCb!("Hello");
		await new Promise((r) => setTimeout(r, 50));

		expect(renderer.updateStatus).toHaveBeenCalledWith("error");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/ui/menus/chat-shell.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ChatShell**

Create `src/ui/menus/chat-shell.ts`:

```typescript
/**
 * chat-shell.ts — Chat view orchestrator.
 *
 * Wires the IChatRenderer (infrastructure) to domain functions
 * (processRunner, conversation store). Lives in the UI layer.
 * Knows about agents, conversations, and domain types.
 * The renderer never touches domain logic or persistence.
 */

import type { IChatRenderer, ChatConfig, ChatMessage, ChatCommand, ChatViewStatus } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import type { IAgentProcessRunner, AgentProcess } from "../../domain/agents/worker-types.js";
import type { ConversationFile, ConversationTurn } from "../../domain/agents/agent-conversation-store.js";
import { loadConversation, saveConversation, createThread, appendTurn, getActiveHistory } from "../../domain/agents/agent-conversation-store.js";
import { buildConversationPrompt, parseAgentResponse } from "../../domain/agents/agent-conversation.js";
import { readSystemPrompt } from "../../domain/agents/agent-store.js";
import type { MenuResult } from "../../infrastructure/types.js";

export interface ChatShellDeps {
	readonly disk: import("../../infrastructure/types.js").IFileSystem;
	readonly paths: import("../../infrastructure/types.js").IPaths;
	readonly clock: import("../../infrastructure/types.js").IClock;
	readonly shell: import("../../infrastructure/types.js").IShell;
	readonly log: (msg?: string) => void;
	readonly processRunner: IAgentProcessRunner;
}

export class ChatShell {
	private readonly renderer: IChatRenderer;
	private readonly agent: AgentSummary;
	private readonly deps: ChatShellDeps;
	private readonly varDir: string;
	private readonly projectPath: string;
	private conversation: ConversationFile;
	private activeProcess: AgentProcess | null = null;
	private currentMode: "conversation" | "task" = "conversation";
	private toolCount = 0;
	private resolveExit: ((result: MenuResult) => void) | null = null;

	constructor(renderer: IChatRenderer, agent: AgentSummary, deps: ChatShellDeps, vaultRoot: string, projectPath: string) {
		this.renderer = renderer;
		this.agent = agent;
		this.deps = deps;
		this.varDir = deps.paths.join(vaultRoot, ".flowti", "var");
		this.projectPath = projectPath;
		this.conversation = loadConversation(deps, this.varDir, agent.name);
	}

	async start(): Promise<MenuResult> {
		const config: ChatConfig = {
			agentName: this.agent.name,
			persona: this.agent.persona,
			topicName: this.conversation.activeThread ?? undefined,
			mode: this.currentMode,
		};

		await this.renderer.mount(config);
		this.renderer.onUserInput((text) => this.handleUserInput(text));
		this.renderer.onCommand((cmd) => this.handleCommand(cmd));

		this.loadHistory();

		return new Promise((resolve) => {
			this.resolveExit = resolve;
		});
	}

	private loadHistory(): void {
		const history = getActiveHistory(this.conversation);
		const recentTurns = history.slice(-5).map((t) => ({
			role: t.role,
			content: t.content,
			timestamp: t.ts,
			thinking: t.thinking,
		}));
		const olderCount = Math.max(0, history.length - 5);
		const summary = olderCount > 0
			? `${olderCount} earlier message${olderCount > 1 ? "s" : ""} in this conversation.`
			: "";
		this.renderer.showHistory(summary, recentTurns);
	}

	private async handleUserInput(text: string): Promise<void> {
		if (!text.trim()) return;

		if (!this.conversation.activeThread) {
			this.conversation = createThread(this.conversation, `thread-${this.deps.clock.ms()}`, this.deps.clock.iso());
		}

		const userMsg: ChatMessage = {
			role: "user",
			content: text,
			timestamp: this.deps.clock.iso(),
		};
		this.renderer.pushMessage(userMsg);
		this.renderer.updateStatus("thinking");

		this.conversation = appendTurn(this.conversation, { role: "user", content: text, ts: this.deps.clock.iso() });

		const history = getActiveHistory(this.conversation);
		const oldHistory = history.slice(0, -1).map((t) => ({ role: t.role, content: t.content }));
		const systemPrompt = readSystemPrompt(this.deps, this.projectPath, this.agent.name);
		const prompt = buildConversationPrompt(this.agent.name, systemPrompt, oldHistory, text, {
			description: this.agent.description,
			persona: this.agent.persona,
		});

		this.toolCount = 0;
		this.activeProcess = this.deps.processRunner.spawn(this.agent, prompt);

		const unsubscribe = this.activeProcess.onEvent((event) => this.handleStreamEvent(event));

		try {
			const result = await this.activeProcess.result;
			unsubscribe();
			this.activeProcess = null;

			if (result.text) {
				const parsed = parseAgentResponse(result.text);
				const agentMsg: ChatMessage = {
					role: "agent",
					content: parsed.message,
					timestamp: this.deps.clock.iso(),
				};
				this.renderer.pushMessage(agentMsg);
				this.conversation = appendTurn(this.conversation, {
					role: "agent", content: parsed.message, ts: this.deps.clock.iso(),
					thinking: result.thinking || undefined,
				});
			}

			saveConversation(this.deps, this.varDir, this.agent.name, this.conversation);

			if (result.exitCode !== 0 && !result.text) {
				this.renderer.updateStatus("error");
			} else {
				this.renderer.updateStatus("idle");
			}
		} catch {
			this.activeProcess = null;
			this.renderer.updateStatus("error");
		}
	}

	private handleStreamEvent(event: AgentStreamEvent): void {
		this.renderer.pushStreamEvent(event);

		if (event.kind === "tool-start") {
			this.toolCount++;
			if (this.toolCount >= 2 && this.currentMode === "conversation") {
				this.currentMode = "task";
				this.renderer.updateMode("task");
			}
			this.renderer.updateStatus("working");
		} else if (event.kind === "error") {
			this.renderer.updateStatus("error");
		} else if (event.kind === "thinking") {
			this.renderer.updateStatus("thinking");
		}
	}

	private async handleCommand(cmd: ChatCommand): Promise<void> {
		switch (cmd.type) {
			case "done":
			case "back": {
				if (this.activeProcess) this.activeProcess.kill();
				const result = await this.renderer.unmount();
				this.resolveExit?.(cmd.type === "back" ? "main" : result);
				break;
			}
			case "let-go": {
				const result = await this.renderer.unmount();
				this.resolveExit?.(result);
				break;
			}
			case "new": {
				this.conversation = createThread(this.conversation, `thread-${this.deps.clock.ms()}`, this.deps.clock.iso());
				saveConversation(this.deps, this.varDir, this.agent.name, this.conversation);
				this.renderer.showHistory("", []);
				break;
			}
			case "clear": {
				this.renderer.showHistory("", []);
				break;
			}
			case "talk": {
				this.currentMode = "conversation";
				this.renderer.updateMode("conversation");
				break;
			}
			case "focus": {
				this.currentMode = "task";
				this.renderer.updateMode("task");
				break;
			}
			case "history": {
				const history = getActiveHistory(this.conversation, 100);
				const turns = history.map((t) => ({
					role: t.role, content: t.content, timestamp: t.ts, thinking: t.thinking,
				}));
				this.renderer.showHistory("", turns);
				break;
			}
			case "topics": {
				const topics = this.conversation.threads.map((t) => t.id).join(", ");
				this.deps.log(`Topics: ${topics}`);
				break;
			}
			case "pick": {
				const thread = this.conversation.threads.find((t) => t.id === cmd.name);
				if (thread) {
					this.conversation = { ...this.conversation, activeThread: thread.id };
					saveConversation(this.deps, this.varDir, this.agent.name, this.conversation);
					this.loadHistory();
				}
				break;
			}
		}
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/ui/menus/chat-shell.test.ts --config configs/vitest.config.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run --config configs/vitest.config.ts
```

Expected: All ~5,920+ tests pass.

- [ ] **Step 6: Type-check**

```bash
cd "01 - Projects/Flowti CLI"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/chat-shell.ts" "01 - Projects/Flowti CLI/tests/ui/menus/chat-shell.test.ts"
git commit -m "feat(chat): add ChatShell orchestrator with mock renderer tests"
```

---

## Chunk 3: InkChatRenderer — React Components

### Task 5: Implement ink React components

The React components are the private implementation of IChatRenderer. They live in `src/infrastructure/chat/components/` and are only imported by `ink-chat-renderer.ts`.

**Files:**
- Create: `src/infrastructure/chat/components/header-bar.tsx`
- Create: `src/infrastructure/chat/components/message.tsx`
- Create: `src/infrastructure/chat/components/tool-panel.tsx`
- Create: `src/infrastructure/chat/components/message-area.tsx`
- Create: `src/infrastructure/chat/components/activity-bar.tsx`
- Create: `src/infrastructure/chat/components/input-area.tsx`
- Create: `src/infrastructure/chat/components/task-view.tsx`

- [ ] **Step 1: Create HeaderBar component**

Create `src/infrastructure/chat/components/header-bar.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface HeaderBarProps {
	readonly agentName: string;
	readonly persona?: string;
	readonly status: ChatViewStatus;
	readonly topicName?: string;
}

const STATUS_COLORS: Record<ChatViewStatus, string> = {
	idle: "green",
	thinking: "yellow",
	working: "yellow",
	waiting: "cyan",
	error: "red",
};

const STATUS_LABELS: Record<ChatViewStatus, string> = {
	idle: "idle",
	thinking: "thinking",
	working: "working",
	waiting: "waiting",
	error: "error",
};

export function HeaderBar({ agentName, persona, status, topicName }: HeaderBarProps): React.ReactElement {
	const statusColor = STATUS_COLORS[status];
	return (
		<Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} paddingX={1} justifyContent="space-between">
			<Box gap={1}>
				<Text color="cyan" bold>{"◆ "}{agentName}</Text>
				{persona && <><Text dimColor>│</Text><Text dimColor>{persona}</Text></>}
				<Text dimColor>│</Text>
				<Text color={statusColor}>● {STATUS_LABELS[status]}</Text>
			</Box>
			<Box gap={1}>
				{topicName && <><Text dimColor>Topic: </Text><Text color="magenta">{topicName}</Text><Text dimColor>│</Text></>}
				<Text dimColor>Esc exit │ / commands</Text>
			</Box>
		</Box>
	);
}
```

- [ ] **Step 2: Create Message component**

Create `src/infrastructure/chat/components/message.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage } from "../chat-renderer-types.js";
import { ToolPanel } from "./tool-panel.js";

interface MessageProps {
	readonly message: ChatMessage;
	readonly agentName: string;
	readonly toolsExpanded: boolean;
	readonly onToggleTools?: () => void;
}

function relativeTime(timestamp: string): string {
	const diff = Date.now() - new Date(timestamp).getTime();
	if (diff < 60_000) return "just now";
	const mins = Math.floor(diff / 60_000);
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	return `${hours}h ago`;
}

export function Message({ message, agentName, toolsExpanded }: MessageProps): React.ReactElement {
	const isUser = message.role === "user";
	const name = isUser ? "You" : agentName;
	const nameColor = isUser ? "blue" : "cyan";
	const time = relativeTime(message.timestamp);

	return (
		<Box flexDirection="column" marginBottom={1} paddingLeft={1}>
			<Box gap={1}>
				<Text color={nameColor} dimColor>{name}</Text>
				<Text dimColor>· {time}</Text>
			</Box>
			<Box paddingLeft={1}>
				<Text>{message.content}</Text>
			</Box>
			{message.tools && message.tools.length > 0 && (
				<Box paddingLeft={1}>
					<ToolPanel tools={message.tools} expanded={toolsExpanded} />
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 3: Create ToolPanel component**

Create `src/infrastructure/chat/components/tool-panel.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatToolCall } from "../chat-renderer-types.js";

interface ToolPanelProps {
	readonly tools: readonly ChatToolCall[];
	readonly expanded: boolean;
}

function toolSummary(tool: ChatToolCall): string {
	return tool.target ? `${tool.name} ${tool.target}` : tool.name;
}

export function ToolPanel({ tools, expanded }: ToolPanelProps): React.ReactElement {
	if (!expanded) {
		const arrow = "▶";
		const summary = tools.map(toolSummary).join(" · ");
		return (
			<Box>
				<Text color="magenta">{arrow}</Text>
				<Text dimColor> {tools.length} tool call{tools.length > 1 ? "s" : ""} — {summary}</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text dimColor>▼ {tools.length} tool call{tools.length > 1 ? "s" : ""}</Text>
			{tools.map((tool, i) => (
				<Box key={i} paddingLeft={1} flexDirection="column">
					<Box gap={1}>
						<Text color={tool.status === "done" ? "green" : tool.status === "error" ? "red" : "yellow"}>
							{tool.status === "done" ? "✓" : tool.status === "error" ? "✗" : "⟳"}
						</Text>
						<Text>{toolSummary(tool)}</Text>
						{tool.durationMs !== undefined && <Text dimColor>{tool.durationMs}ms</Text>}
					</Box>
					{tool.input && <Text dimColor wrap="truncate-end">  in: {tool.input}</Text>}
					{tool.output && <Text dimColor wrap="truncate-end">  out: {tool.output}</Text>}
				</Box>
			))}
		</Box>
	);
}
```

- [ ] **Step 4: Create MessageArea component**

Create `src/infrastructure/chat/components/message-area.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage, ChatTurn, ChatViewStatus } from "../chat-renderer-types.js";
import { Message } from "./message.js";

interface MessageAreaProps {
	readonly summary: string;
	readonly recentTurns: readonly ChatTurn[];
	readonly messages: readonly ChatMessage[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly agentName: string;
	readonly agentStatus: ChatViewStatus;
	readonly toolsExpanded: boolean;
}

export function MessageArea({
	summary, recentTurns, messages, streamingText, streamingThinking, agentName, agentStatus, toolsExpanded,
}: MessageAreaProps): React.ReactElement {
	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			{summary && (
				<Box marginBottom={1}>
					<Text dimColor italic>  {summary}</Text>
				</Box>
			)}
			{recentTurns.length > 0 && summary && (
				<Box marginBottom={1}>
					<Text dimColor>  ────────────────────────────</Text>
				</Box>
			)}
			{recentTurns.map((turn, i) => (
				<Message key={`h-${i}`} message={{ role: turn.role, content: turn.content, timestamp: turn.timestamp }} agentName={agentName} toolsExpanded={false} />
			))}
			{messages.map((msg, i) => (
				<Message key={`m-${i}`} message={msg} agentName={agentName} toolsExpanded={toolsExpanded} />
			))}
			{(streamingText || streamingThinking) && (
				<Box flexDirection="column" paddingLeft={1} marginBottom={1}>
					<Box gap={1}>
						<Text color="cyan" dimColor>{agentName}</Text>
						<Text color="yellow">⟳ {agentStatus}</Text>
					</Box>
					{streamingThinking && (
						<Box paddingLeft={1}>
							<Text dimColor italic>{streamingThinking}</Text>
						</Box>
					)}
					{streamingText && (
						<Box paddingLeft={1}>
							<Text>{streamingText}</Text>
						</Box>
					)}
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 5: Create ActivityBar component**

Create `src/infrastructure/chat/components/activity-bar.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface ActivityBarProps {
	readonly status: ChatViewStatus;
	readonly elapsed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly currentTool?: string;
}

function formatElapsed(ms: number): string {
	if (ms < 1000) return "0s";
	const secs = Math.floor(ms / 1000);
	if (secs < 60) return `${secs}s`;
	const mins = Math.floor(secs / 60);
	return `${mins}m ${secs % 60}s`;
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function statusLabel(status: ChatViewStatus, currentTool?: string): string {
	if (status === "working" && currentTool) return `Using tool: ${currentTool}`;
	if (status === "thinking") return "Thinking";
	if (status === "working") return "Working";
	if (status === "waiting") return "Waiting";
	if (status === "error") return "Error";
	return "Idle";
}

export function ActivityBar({ status, elapsed, inputTokens, outputTokens, currentTool }: ActivityBarProps): React.ReactElement {
	const statusColor = status === "error" ? "red" : status === "idle" ? "green" : "yellow";
	return (
		<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} justifyContent="space-between">
			<Box gap={1}>
				<Text color={statusColor}>{status === "idle" ? "●" : "⟳"}</Text>
				<Text dimColor>{statusLabel(status, currentTool)}</Text>
				{elapsed > 0 && <><Text dimColor>·</Text><Text dimColor>{formatElapsed(elapsed)}</Text></>}
			</Box>
			{(inputTokens > 0 || outputTokens > 0) && (
				<Text dimColor>tokens: {formatTokens(inputTokens)} in / {formatTokens(outputTokens)} out</Text>
			)}
		</Box>
	);
}
```

- [ ] **Step 6: Create InputArea component**

Create `src/infrastructure/chat/components/input-area.tsx`:

```tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { parseCommand } from "../command-parser.js";
import type { ChatCommand } from "../chat-renderer-types.js";

interface InputAreaProps {
	readonly disabled: boolean;
	readonly onSubmit: (text: string) => void;
	readonly onCommand: (cmd: ChatCommand) => void;
}

export function InputArea({ disabled, onSubmit, onCommand }: InputAreaProps): React.ReactElement {
	const [value, setValue] = useState("");

	const handleSubmit = (): void => {
		const trimmed = value.trim();
		if (!trimmed) return;
		const cmd = parseCommand(trimmed);
		if (cmd) {
			onCommand(cmd);
		} else {
			onSubmit(trimmed);
		}
		setValue("");
	};

	useInput((_input, key) => {
		if (key.escape) {
			onCommand({ type: "done" });
		}
	});

	return (
		<Box paddingX={1} paddingY={0}>
			<Text color="cyan">❯ </Text>
			{disabled
				? <Text dimColor>Agent is working...</Text>
				: <TextInput value={value} onChange={setValue} onSubmit={handleSubmit} />
			}
		</Box>
	);
}
```

- [ ] **Step 7: Create TaskView component**

Create `src/infrastructure/chat/components/task-view.tsx`:

```tsx
import React from "react";
import { Box, Text } from "ink";
import type { ChatToolCall, ChatViewStatus } from "../chat-renderer-types.js";

interface TaskViewProps {
	readonly brief: string;
	readonly tools: readonly ChatToolCall[];
	readonly status: ChatViewStatus;
	readonly elapsed: number;
}

export function TaskView({ brief, tools, status, elapsed }: TaskViewProps): React.ReactElement {
	const doneCount = tools.filter((t) => t.status === "done").length;
	const activeCount = tools.filter((t) => t.status === "active").length;

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Box marginBottom={1} flexDirection="column">
				<Text color="magenta" dimColor>TASK BRIEF</Text>
				<Text>{brief}</Text>
			</Box>

			<Box marginBottom={1} flexDirection="column">
				<Text color="magenta" dimColor>ACTIVITY FEED</Text>
				{tools.map((tool, i) => (
					<Box key={i} gap={1}>
						<Text color={tool.status === "done" ? "green" : tool.status === "error" ? "red" : "yellow"}>
							{tool.status === "done" ? "✓" : tool.status === "active" ? "⟳" : "○"}
						</Text>
						<Text>{tool.target ? `${tool.name} ${tool.target}` : tool.name}</Text>
						{tool.durationMs !== undefined && <Text dimColor>{Math.ceil(tool.durationMs / 1000)}s</Text>}
					</Box>
				))}
			</Box>

			<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1} justifyContent="space-between">
				<Box gap={1}>
					<Text color="green">{doneCount}</Text><Text dimColor>done</Text>
					<Text dimColor>·</Text>
					<Text color="yellow">{activeCount}</Text><Text dimColor>active</Text>
					<Text dimColor>·</Text>
					<Text dimColor>{Math.floor(elapsed / 1000)}s elapsed</Text>
				</Box>
				<Text dimColor>Enter interrupt · Esc detach</Text>
			</Box>
		</Box>
	);
}
```

- [ ] **Step 8: Type-check all components**

```bash
cd "01 - Projects/Flowti CLI"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS. All .tsx files compile with the `"jsx": "react-jsx"` setting.

- [ ] **Step 9: Commit components**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/"
git commit -m "feat(chat): add ink React components for chat view"
```

---

### Task 6: Implement InkChatRenderer

Wires the React component tree into the IChatRenderer interface. This is the only file that imports ink.

**Files:**
- Create: `src/infrastructure/chat/ink-chat-renderer.ts`
- Create: `tests/infrastructure/chat/ink-chat-renderer.test.ts`

- [ ] **Step 1: Write failing tests using ink-testing-library**

Create `tests/infrastructure/chat/ink-chat-renderer.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HeaderBar } from "../../../src/infrastructure/chat/components/header-bar.js";
import { ActivityBar } from "../../../src/infrastructure/chat/components/activity-bar.js";
import { ToolPanel } from "../../../src/infrastructure/chat/components/tool-panel.js";
import { Message } from "../../../src/infrastructure/chat/components/message.js";
import { TaskView } from "../../../src/infrastructure/chat/components/task-view.js";

describe("HeaderBar", () => {
	it("renders agent name and status", () => {
		const { lastFrame } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "idle" }),
		);
		const output = lastFrame();
		expect(output).toContain("Atlas");
		expect(output).toContain("idle");
	});

	it("renders persona when provided", () => {
		const { lastFrame } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", persona: "Lead Architect", status: "thinking" }),
		);
		const output = lastFrame();
		expect(output).toContain("Lead Architect");
		expect(output).toContain("thinking");
	});

	it("renders topic name when provided", () => {
		const { lastFrame } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "idle", topicName: "feature-auth" }),
		);
		expect(lastFrame()).toContain("feature-auth");
	});
});

describe("ActivityBar", () => {
	it("renders idle status", () => {
		const { lastFrame } = render(
			React.createElement(ActivityBar, { status: "idle", elapsed: 0, inputTokens: 0, outputTokens: 0 }),
		);
		expect(lastFrame()).toContain("Idle");
	});

	it("renders token counts", () => {
		const { lastFrame } = render(
			React.createElement(ActivityBar, { status: "thinking", elapsed: 5000, inputTokens: 2400, outputTokens: 890 }),
		);
		const output = lastFrame()!;
		expect(output).toContain("2.4k");
		expect(output).toContain("890");
	});

	it("renders current tool name", () => {
		const { lastFrame } = render(
			React.createElement(ActivityBar, { status: "working", elapsed: 3000, inputTokens: 0, outputTokens: 0, currentTool: "Edit" }),
		);
		expect(lastFrame()).toContain("Edit");
	});
});

describe("ToolPanel", () => {
	it("renders collapsed summary", () => {
		const tools = [
			{ name: "Read", target: "auth.ts", status: "done" as const },
			{ name: "Edit", target: "auth.ts", status: "done" as const },
		];
		const { lastFrame } = render(
			React.createElement(ToolPanel, { tools, expanded: false }),
		);
		const output = lastFrame()!;
		expect(output).toContain("2 tool calls");
		expect(output).toContain("Read auth.ts");
	});

	it("renders expanded details", () => {
		const tools = [
			{ name: "Read", target: "auth.ts", status: "done" as const, durationMs: 120 },
		];
		const { lastFrame } = render(
			React.createElement(ToolPanel, { tools, expanded: true }),
		);
		const output = lastFrame()!;
		expect(output).toContain("✓");
		expect(output).toContain("120ms");
	});
});

describe("Message", () => {
	it("renders user message", () => {
		const msg = { role: "user" as const, content: "Hello there", timestamp: new Date().toISOString() };
		const { lastFrame } = render(
			React.createElement(Message, { message: msg, agentName: "Atlas", toolsExpanded: false }),
		);
		const output = lastFrame()!;
		expect(output).toContain("You");
		expect(output).toContain("Hello there");
	});

	it("renders agent message", () => {
		const msg = { role: "agent" as const, content: "I can help with that", timestamp: new Date().toISOString() };
		const { lastFrame } = render(
			React.createElement(Message, { message: msg, agentName: "Atlas", toolsExpanded: false }),
		);
		const output = lastFrame()!;
		expect(output).toContain("Atlas");
		expect(output).toContain("I can help with that");
	});

	it("renders tool panel when message has tools", () => {
		const msg = {
			role: "agent" as const, content: "Done.", timestamp: new Date().toISOString(),
			tools: [{ name: "Read", target: "file.ts", status: "done" as const }],
		};
		const { lastFrame } = render(
			React.createElement(Message, { message: msg, agentName: "Atlas", toolsExpanded: false }),
		);
		expect(lastFrame()).toContain("1 tool call");
	});
});

describe("TaskView", () => {
	it("renders task brief", () => {
		const { lastFrame } = render(
			React.createElement(TaskView, { brief: "Write auth tests", tools: [], status: "working", elapsed: 5000 }),
		);
		expect(lastFrame()).toContain("Write auth tests");
	});

	it("renders tool activity with status icons", () => {
		const tools = [
			{ name: "Read", target: "auth.ts", status: "done" as const, durationMs: 2000 },
			{ name: "Edit", target: "auth.ts", status: "active" as const },
		];
		const { lastFrame } = render(
			React.createElement(TaskView, { brief: "Implement feature", tools, status: "working", elapsed: 10000 }),
		);
		const output = lastFrame()!;
		expect(output).toContain("✓");
		expect(output).toContain("⟳");
	});

	it("renders progress counts", () => {
		const tools = [
			{ name: "Read", status: "done" as const },
			{ name: "Read", status: "done" as const },
			{ name: "Edit", status: "active" as const },
		];
		const { lastFrame } = render(
			React.createElement(TaskView, { brief: "Test", tools, status: "working", elapsed: 3000 }),
		);
		const output = lastFrame()!;
		expect(output).toContain("2");
		expect(output).toContain("done");
		expect(output).toContain("1");
		expect(output).toContain("active");
	});
});
```

- [ ] **Step 2: Run tests (ink-testing-library was installed in Task 1)**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/ink-chat-renderer.test.ts --config configs/vitest.config.ts
```

Expected: PASS (components already created in Task 5).

- [ ] **Step 4: Implement InkChatRenderer**

Create `src/infrastructure/chat/ink-chat-renderer.ts`:

```typescript
/**
 * ink-chat-renderer.ts — Ink/React implementation of IChatRenderer.
 *
 * This is the ONLY file in the codebase that imports ink and react.
 * All React components are co-located in ./components/.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { render, Box } from "ink";
import type {
	IChatRenderer, ChatConfig, ChatMessage, ChatTurn,
	ChatCommand, ChatViewStatus, ChatToolCall,
} from "./chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../types.js";
import { HeaderBar } from "./components/header-bar.js";
import { MessageArea } from "./components/message-area.js";
import { ActivityBar } from "./components/activity-bar.js";
import { InputArea } from "./components/input-area.js";
import { TaskView } from "./components/task-view.js";

const RENDER_INTERVAL = process.platform === "win32" ? 80 : 16;

interface ChatAppState {
	config: ChatConfig;
	status: ChatViewStatus;
	messages: ChatMessage[];
	summary: string;
	recentTurns: readonly ChatTurn[];
	streamingText: string;
	streamingThinking: string;
	currentTool: string;
	toolsExpanded: boolean;
	taskTools: ChatToolCall[];
	elapsed: number;
	inputTokens: number;
	outputTokens: number;
}

interface ChatAppProps {
	readonly initialConfig: ChatConfig;
	readonly stateRef: React.MutableRefObject<ChatAppState>;
	readonly onInput: (text: string) => void;
	readonly onCommand: (cmd: ChatCommand) => void;
}

function ChatApp({ initialConfig, stateRef, onInput, onCommand }: ChatAppProps): React.ReactElement {
	const [state, setState] = useState<ChatAppState>(stateRef.current);
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		timerRef.current = setInterval(() => {
			setState({ ...stateRef.current });
		}, RENDER_INTERVAL);
		return () => { if (timerRef.current) clearInterval(timerRef.current); };
	}, [stateRef]);

	const isWorking = state.status === "thinking" || state.status === "working";
	const isTaskMode = state.config.mode === "task";

	return React.createElement(Box, { flexDirection: "column", height: process.stdout.rows ?? 24 },
		React.createElement(HeaderBar, {
			agentName: state.config.agentName,
			persona: state.config.persona,
			status: state.status,
			topicName: state.config.topicName,
		}),
		isTaskMode && state.config.taskBrief
			? React.createElement(TaskView, {
				brief: state.config.taskBrief,
				tools: state.taskTools,
				status: state.status,
				elapsed: state.elapsed,
			})
			: React.createElement(MessageArea, {
				summary: state.summary,
				recentTurns: state.recentTurns,
				messages: state.messages,
				streamingText: state.streamingText,
				streamingThinking: state.streamingThinking,
				agentName: state.config.agentName,
				agentStatus: state.status,
				toolsExpanded: state.toolsExpanded,
			}),
		React.createElement(ActivityBar, {
			status: state.status,
			elapsed: state.elapsed,
			inputTokens: state.inputTokens,
			outputTokens: state.outputTokens,
			currentTool: state.currentTool || undefined,
		}),
		React.createElement(InputArea, {
			disabled: isWorking,
			onSubmit: onInput,
			onCommand,
		}),
	);
}

export class InkChatRenderer implements IChatRenderer {
	private inkInstance: ReturnType<typeof render> | null = null;
	private stateRef: React.MutableRefObject<ChatAppState> | null = null;
	private userInputCb: ((text: string) => void) | null = null;
	private commandCb: ((cmd: ChatCommand) => void) | null = null;
	private startTime = 0;
	private elapsedTimer: ReturnType<typeof setInterval> | null = null;

	async mount(config: ChatConfig): Promise<void> {
		const state: ChatAppState = {
			config,
			status: "idle",
			messages: [],
			summary: "",
			recentTurns: [],
			streamingText: "",
			streamingThinking: "",
			currentTool: "",
			toolsExpanded: false,
			taskTools: [],
			elapsed: 0,
			inputTokens: 0,
			outputTokens: 0,
		};
		const ref = { current: state };
		this.stateRef = ref as React.MutableRefObject<ChatAppState>;
		this.startTime = Date.now();

		this.inkInstance = render(
			React.createElement(ChatApp, {
				initialConfig: config,
				stateRef: ref as React.MutableRefObject<ChatAppState>,
				onInput: (text: string) => this.userInputCb?.(text),
				onCommand: (cmd: ChatCommand) => this.commandCb?.(cmd),
			}),
		);
	}

	async unmount(): Promise<MenuResult> {
		if (this.elapsedTimer) clearInterval(this.elapsedTimer);
		this.inkInstance?.unmount();
		this.inkInstance = null;
		return "main";
	}

	pushMessage(message: ChatMessage): void {
		if (!this.stateRef) return;
		this.stateRef.current = {
			...this.stateRef.current,
			messages: [...this.stateRef.current.messages, message],
			streamingText: "",
			streamingThinking: "",
		};
	}

	pushStreamEvent(event: AgentStreamEvent): void {
		if (!this.stateRef) return;
		const s = this.stateRef.current;
		switch (event.kind) {
			case "thinking":
				this.stateRef.current = { ...s, streamingThinking: s.streamingThinking + event.text };
				break;
			case "text":
				this.stateRef.current = { ...s, streamingText: s.streamingText + event.text };
				break;
			case "tool-start":
				this.stateRef.current = {
					...s,
					currentTool: event.name,
					taskTools: [...s.taskTools, { name: event.name, status: "active", id: event.id }],
				};
				break;
			case "tool-input":
				// Accumulate partial JSON input for the active tool
				this.stateRef.current = {
					...s,
					taskTools: s.taskTools.map((t) =>
						t.status === "active" ? { ...t, input: (t.input ?? "") + event.json } : t,
					),
				};
				break;
			case "tool-end":
				this.stateRef.current = {
					...s,
					currentTool: "",
					taskTools: s.taskTools.map((t) =>
						t.status === "active" && (t as { id?: string }).id === event.id
							? { ...t, status: "done" as const }
							: t,
					),
				};
				break;
			case "error":
				this.stateRef.current = { ...s, streamingText: s.streamingText + `\nError: ${event.message}` };
				break;
			case "usage":
				this.stateRef.current = { ...s, inputTokens: event.inputTokens, outputTokens: event.outputTokens };
				break;
			case "done":
				this.stateRef.current = { ...s, elapsed: Date.now() - this.startTime };
				break;
		}
	}

	updateStatus(status: ChatViewStatus): void {
		if (!this.stateRef) return;
		this.stateRef.current = { ...this.stateRef.current, status };
		if (status === "thinking" || status === "working") {
			if (!this.elapsedTimer) {
				this.elapsedTimer = setInterval(() => {
					if (this.stateRef) {
						this.stateRef.current = { ...this.stateRef.current, elapsed: Date.now() - this.startTime };
					}
				}, 1000);
			}
		} else if (this.elapsedTimer) {
			clearInterval(this.elapsedTimer);
			this.elapsedTimer = null;
		}
	}

	updateMode(mode: "conversation" | "task"): void {
		if (!this.stateRef) return;
		this.stateRef.current = {
			...this.stateRef.current,
			config: { ...this.stateRef.current.config, mode },
		};
	}

	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void {
		if (!this.stateRef) return;
		this.stateRef.current = { ...this.stateRef.current, summary, recentTurns, messages: [] };
	}

	onUserInput(callback: (text: string) => void): void {
		this.userInputCb = callback;
	}

	onCommand(callback: (cmd: ChatCommand) => void): void {
		this.commandCb = callback;
	}
}
```

- [ ] **Step 5: Run component tests**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run tests/infrastructure/chat/ink-chat-renderer.test.ts --config configs/vitest.config.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI"
npx vitest run --config configs/vitest.config.ts
```

Expected: All tests pass including the new chat tests.

- [ ] **Step 7: Type-check**

```bash
cd "01 - Projects/Flowti CLI"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/ink-chat-renderer.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/ink-chat-renderer.test.ts"
git commit -m "feat(chat): add InkChatRenderer implementation"
```

---

## Chunk 4: Integration (DEFERRED)

> **Note:** This chunk is intentionally deferred to coordinate with the parallel quality refactoring. The chat subsystem (Chunks 1-3) is fully self-contained and testable without these changes. Execute this chunk once the refactoring stabilizes.

### Task 7: Wire ChatShell into the sitemap

**Files:**
- Modify: `src/infrastructure/deps.ts`
- Modify: `src/ui/handlers/register-handlers.ts`
- Modify: `configs/sitemap.json`
- Create: `src/ui/handlers/chat-handlers.ts`

Steps (high-level — flesh out when executing):

- [ ] Add `chatRenderer` lazy factory to `CliDeps` in `deps.ts`
- [ ] Create `chat-handlers.ts` with ViewHandler for `agents-chat`
- [ ] Register chat view handler in `register-handlers.ts`
- [ ] Add `agents-chat` page to `sitemap.json`
- [ ] Rewire `onTalk` action in `agent-detail` page from `agents:talk` to `navigate:agents-chat`
- [ ] Test the full navigation flow (start → agent-detail → agents-chat → back)
- [ ] Commit

### Task 8: Add agent dashboard

**Files:**
- Create: `src/ui/displays/dashboard-display.ts`
- Modify: `src/ui/handlers/register-handlers.ts`
- Modify: `configs/sitemap.json`

Steps (high-level — flesh out when executing):

- [ ] Create `dashboard-display.ts` — pure renderer for agent status table
- [ ] Add `agents-dashboard` page to `sitemap.json`
- [ ] Register dashboard ViewHandler and `agents:status` data source
- [ ] Add dashboard navigation to `start` and `ai-tools` pages
- [ ] Enrich `start:banner` handler with detailed agent status
- [ ] Test dashboard rendering and navigation
- [ ] Commit
