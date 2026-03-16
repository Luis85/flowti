# TUI Chat Wiring — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire ChatShell into the TUI chat page so users can have real conversations with agents via Claude CLI.

**Architecture:** A thin `TuiChatRenderer` adapter bridges `useChatSession` (React hook) to `IChatRenderer` (ChatShell's interface). The chat page creates a ChatShell on mount, checks for Claude CLI availability, and orchestrates the full conversation lifecycle. `processRunner` is added to `TuiContextValue` (not LoaderDeps) as the single new dependency.

**Tech Stack:** React 19, Ink 6, Vitest, ink-testing-library 4

**Spec:** `docs/specs/2026-03-16-tui-chat-wiring-design.md`

**Run all tests:** `npx vitest run --config configs/vitest.config.ts`
**Run TUI tests only:** `npx vitest run tests/tui/ --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: TuiChatRenderer Adapter

Create the adapter that bridges `ChatSessionState` to `IChatRenderer`.

### Task 1: Write TuiChatRenderer tests

**Files:**
- Create: `tests/tui/chat/tui-chat-renderer.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/tui/chat/tui-chat-renderer.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { TuiChatRenderer } from "../../../src/tui/chat/tui-chat-renderer.js";
import type { ChatSessionState } from "../../../src/tui/hooks/use-chat-session.js";

function createMockSession(): ChatSessionState {
	return {
		state: {
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
			mode: "conversation",
		},
		submit: vi.fn(),
		command: vi.fn(),
		pushMessage: vi.fn(),
		pushStreamEvent: vi.fn(),
		updateStatus: vi.fn(),
		updateMode: vi.fn(),
		showHistory: vi.fn(),
		onUserInput: vi.fn(),
		onCommandHandler: vi.fn(),
	};
}

describe("TuiChatRenderer", () => {
	it("mount is a no-op", async () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		await expect(renderer.mount({ agentName: "Test", mode: "conversation" })).resolves.toBeUndefined();
	});

	it("unmount returns main", async () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const result = await renderer.unmount();
		expect(result).toBe("main");
	});

	it("pushMessage delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const msg = { role: "user" as const, content: "hello", timestamp: "2026-03-16T10:00:00Z" };
		renderer.pushMessage(msg);
		expect(session.pushMessage).toHaveBeenCalledWith(msg);
	});

	it("pushStreamEvent delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const event = { kind: "text" as const, text: "hi" };
		renderer.pushStreamEvent(event);
		expect(session.pushStreamEvent).toHaveBeenCalledWith(event);
	});

	it("updateStatus delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		renderer.updateStatus("thinking");
		expect(session.updateStatus).toHaveBeenCalledWith("thinking");
	});

	it("updateMode delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		renderer.updateMode("task");
		expect(session.updateMode).toHaveBeenCalledWith("task");
	});

	it("showHistory delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const turns = [{ role: "user" as const, content: "hi", timestamp: "2026-03-16T10:00:00Z" }];
		renderer.showHistory("summary", turns);
		expect(session.showHistory).toHaveBeenCalledWith("summary", turns);
	});

	it("onUserInput delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const cb = vi.fn();
		renderer.onUserInput(cb);
		expect(session.onUserInput).toHaveBeenCalledWith(cb);
	});

	it("onCommand delegates to session", () => {
		const session = createMockSession();
		const renderer = new TuiChatRenderer(session);
		const cb = vi.fn();
		renderer.onCommand(cb);
		expect(session.onCommandHandler).toHaveBeenCalledWith(cb);
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/tui/chat/tui-chat-renderer.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module `../../../src/tui/chat/tui-chat-renderer.js` not found.

### Task 2: Implement TuiChatRenderer

**Files:**
- Create: `src/tui/chat/tui-chat-renderer.ts`

- [ ] **Step 1: Create the adapter**

Create `src/tui/chat/tui-chat-renderer.ts`:

```typescript
/**
 * tui-chat-renderer.ts — Adapter bridging useChatSession to IChatRenderer.
 *
 * ChatShell expects an IChatRenderer object. useChatSession is a React hook
 * returning ChatSessionState. This class delegates every IChatRenderer method
 * to the corresponding ChatSessionState callback.
 */

import type { IChatRenderer, ChatConfig, ChatMessage, ChatTurn, ChatViewStatus, ChatCommand } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";
import type { MenuResult } from "../../infrastructure/types.js";
import type { ChatSessionState } from "../hooks/use-chat-session.js";

export class TuiChatRenderer implements IChatRenderer {
	constructor(private readonly session: ChatSessionState) {}

	async mount(_config: ChatConfig): Promise<void> {
		// No-op — TUI page is already rendered.
	}

	async unmount(): Promise<MenuResult> {
		return "main";
	}

	pushMessage(message: ChatMessage): void {
		this.session.pushMessage(message);
	}

	pushStreamEvent(event: AgentStreamEvent): void {
		this.session.pushStreamEvent(event);
	}

	updateStatus(status: ChatViewStatus): void {
		this.session.updateStatus(status);
	}

	updateMode(mode: "conversation" | "task"): void {
		this.session.updateMode(mode);
	}

	showHistory(summary: string, recentTurns: readonly ChatTurn[]): void {
		this.session.showHistory(summary, recentTurns);
	}

	onUserInput(callback: (text: string) => void): void {
		this.session.onUserInput(callback);
	}

	onCommand(callback: (cmd: ChatCommand) => void): void {
		this.session.onCommandHandler(callback);
	}
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/tui/chat/tui-chat-renderer.test.ts --config configs/vitest.config.ts`

Expected: All 9 tests PASS.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/chat/tui-chat-renderer.ts" "01 - Projects/Flowti CLI/tests/tui/chat/tui-chat-renderer.test.ts"
git commit -m "feat(tui): add TuiChatRenderer — IChatRenderer adapter for useChatSession"
```

---

## Chunk 2: Dependency Wiring

Add `processRunner` to `TuiContextValue` and create it in `tui-entry.ts`.

### Task 3: Add processRunner to TuiContextValue

**Files:**
- Modify: `src/tui/context.tsx`

- [ ] **Step 1: Import the type and add the field**

In `src/tui/context.tsx`, add the import and field:

```typescript
// Add to imports:
import type { IAgentProcessRunner } from "../domain/agents/worker-types.js";

// Add to TuiContextValue interface:
export interface TuiContextValue {
	readonly deps: LoaderDeps;
	readonly vaultRoot: string;
	readonly projectPath: string;
	readonly projectsDir: string;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly iterationsConfig: IterationsConfig | undefined;
	readonly projectConfig: ProjectConfig | undefined;
	readonly processRunner: IAgentProcessRunner;
}
```

- [ ] **Step 2: Run type check to see what breaks**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: Errors in `tui-entry.ts` (missing `processRunner` in context object) and test files that construct mock `TuiContextValue`. This is expected — we fix them next.

### Task 4: Wire processRunner in tui-entry.ts

**Files:**
- Modify: `src/tui/tui-entry.ts`

- [ ] **Step 1: Import and create the process runner**

In `src/tui/tui-entry.ts`:

```typescript
// Add import:
import { createProcessRunner } from "../infrastructure/agent-process-runner.js";

// Inside runTui(), before tuiContext creation:
const processRunner = createProcessRunner({ disk, paths, clock, shell, log }, cliConfig.agents);

// Add to tuiContext object:
const tuiContext: TuiContextValue = {
	deps: { disk, paths, clock, shell, log },
	vaultRoot: VAULT_ROOT,
	projectPath: CLI_PROJECT,
	projectsDir: PROJECTS_DIR,
	agentsConfig: cliConfig.agents,
	iterationsConfig: projectConfig?.management?.iterations,
	projectConfig: projectConfig ?? undefined,
	processRunner,
};
```

- [ ] **Step 2: Fix test mocks**

Update all test files that create mock `TuiContextValue` to include `processRunner`. Search for `mockTuiContext` in test files:

- `tests/tui/app.test.ts`
- `tests/tui/shell/content-area.test.ts`
- `tests/tui/pages/agents-chat-page.test.ts`
- `tests/tui/pages/projects-list-page.test.ts`

Add to each mock:

```typescript
processRunner: { spawn: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }) } as never,
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 4: Run TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/context.tsx" "01 - Projects/Flowti CLI/src/tui/tui-entry.ts" "01 - Projects/Flowti CLI/tests/tui/app.test.ts" "01 - Projects/Flowti CLI/tests/tui/shell/content-area.test.ts" "01 - Projects/Flowti CLI/tests/tui/pages/agents-chat-page.test.ts" "01 - Projects/Flowti CLI/tests/tui/pages/projects-list-page.test.ts"
git commit -m "feat(tui): add processRunner to TuiContextValue, wire in tui-entry"
```

---

## Chunk 3: Chat Page Orchestration

Replace the current placeholder orchestration in `agents-chat-page.tsx` with real ChatShell wiring.

### Task 5: Rewrite agents-chat-page with ChatShell integration

**Files:**
- Modify: `src/tui/pages/agents-chat-page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the entire contents of `src/tui/pages/agents-chat-page.tsx`:

```typescript
/**
 * agents-chat-page.tsx — Agent chat interface wired to ChatShell.
 *
 * Renders the chat inline using useChatSession. On mount, resolves the agent,
 * checks for Claude CLI, creates a ChatShell, and starts the conversation.
 * Gracefully disables input when Claude CLI is not available.
 */

import React, { useEffect, useState, useRef } from "react";
import { Box, Text } from "ink";
import { registerPage } from "./page-registry.js";
import { useTuiContext } from "../context.js";
import { useChatSession } from "../hooks/use-chat-session.js";
import { TuiChatRenderer } from "../chat/tui-chat-renderer.js";
import { HeaderBar } from "../../infrastructure/chat/components/header-bar.js";
import { MessageArea } from "../../infrastructure/chat/components/message-area.js";
import { ActivityBar as ChatStatusBar } from "../../infrastructure/chat/components/activity-bar.js";
import { InputArea } from "../../infrastructure/chat/components/input-area.js";
import { TaskView } from "../../infrastructure/chat/components/task-view.js";
import type { PageProps } from "../types.js";

type ConnectionStatus = "connecting" | "connected" | "error";

function AgentsChatPage({ params, enabled, goBack }: PageProps): React.JSX.Element {
	const agentName = params.agentName ?? "Agent";
	const tui = useTuiContext();
	const session = useChatSession();
	const { state } = session;
	const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");
	const [connectionError, setConnectionError] = useState("");
	const shellRef = useRef<{ started: boolean }>({ started: false });

	useEffect(() => {
		if (shellRef.current.started) return;
		shellRef.current.started = true;

		let cancelled = false;

		(async () => {
			// 1. Check Claude CLI
			const hasClaude = tui.deps.shell.check("claude --version");
			if (!hasClaude) {
				if (!cancelled) {
					setConnectionError("Claude CLI not found. Install Claude Code or add it to PATH.");
					setConnectionStatus("error");
				}
				return;
			}

			// 2. Resolve agent
			const { findAgent } = await import("../../domain/agents/agent-store.js");
			const agent = findAgent(tui.deps, tui.vaultRoot, agentName, tui.agentsConfig);
			if (!agent) {
				if (!cancelled) {
					setConnectionError(`Agent "${agentName}" not found.`);
					setConnectionStatus("error");
				}
				return;
			}

			// 3. Create ChatShell
			const { ChatShell } = await import("../../ui/menus/chat-shell.js");
			const renderer = new TuiChatRenderer(session);
			const chatDeps = {
				disk: tui.deps.disk,
				paths: tui.deps.paths,
				clock: tui.deps.clock,
				shell: tui.deps.shell,
				log: tui.deps.log,
				processRunner: tui.processRunner,
			};
			const shell = new ChatShell(renderer, agent, chatDeps, tui.vaultRoot, tui.projectPath);

			if (!cancelled) {
				setConnectionStatus("connected");
			}

			// 4. Start — resolves when ChatShell exits (/done, /back)
			await shell.start();

			// 5. ChatShell exited — navigate back
			if (!cancelled) {
				goBack();
			}
		})();

		return () => { cancelled = true; };
	}, [agentName, tui, session, goBack]);

	const isDisabled = !enabled || connectionStatus !== "connected" || state.status === "thinking" || state.status === "working";
	const showTask = state.mode === "task" && state.taskTools.length > 0;

	// Connection status message for MessageArea
	const statusMessage = connectionStatus === "connecting"
		? "Connecting..."
		: connectionStatus === "error"
			? connectionError
			: "";

	return (
		<Box flexDirection="column" flexGrow={1}>
			<HeaderBar
				agentName={agentName}
				status={connectionStatus === "connected" ? state.status : "idle"}
			/>
			{statusMessage !== ""
				? <Box flexGrow={1} alignItems="center" justifyContent="center">
					<Text color={connectionStatus === "error" ? "red" : "yellow"}>{statusMessage}</Text>
				</Box>
				: showTask
					? <TaskView
						brief={agentName}
						tools={state.taskTools}
						status={state.status}
						elapsed={state.elapsed}
					/>
					: <MessageArea
						summary={state.summary}
						recentTurns={state.recentTurns}
						messages={state.messages}
						streamingText={state.streamingText}
						streamingThinking={state.streamingThinking}
						agentName={agentName}
						agentStatus={state.status}
						toolsExpanded={state.toolsExpanded}
					/>
			}
			<ChatStatusBar
				status={connectionStatus === "connected" ? state.status : "idle"}
				elapsed={state.elapsed}
				inputTokens={state.inputTokens}
				outputTokens={state.outputTokens}
				currentTool={state.currentTool !== "" ? state.currentTool : undefined}
			/>
			<InputArea
				disabled={isDisabled}
				onSubmit={session.submit}
				onCommand={session.command}
			/>
		</Box>
	);
}

registerPage("agents-chat", AgentsChatPage);
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 3: Run TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS. The existing agents-chat-page tests check for registration, agent name rendering, and idle status — these should still pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/agents-chat-page.tsx"
git commit -m "feat(tui): wire ChatShell into agents-chat-page — real Claude CLI conversations"
```

---

## Chunk 4: Verification

### Task 6: Update chat page tests for connection states

**Files:**
- Modify: `tests/tui/pages/agents-chat-page.test.ts`

- [ ] **Step 1: Update tests**

The existing tests need mocks for `findAgent` and `shell.check`. Update `tests/tui/pages/agents-chat-page.test.ts` — add a test verifying the error state renders when Claude CLI is missing:

Read the current test file first. It likely has mocks for TuiProvider. Add a test that sets `shell.check` to return `false` and verifies the error message appears.

Since the page does dynamic imports (`import("../../domain/agents/agent-store.js")`), the existing tests may need `vi.mock()` at the top. Read the file, then add the appropriate test based on its structure.

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/tui/pages/agents-chat-page.test.ts --config configs/vitest.config.ts`

Expected: All tests PASS.

### Task 7: Full verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 2: Run all TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: Run lint**

Run: `npx eslint src/ --config configs/eslint.config.mjs`

Expected: No errors (warnings are acceptable).

- [ ] **Step 5: Commit any remaining fixes**

If any fixes were needed, stage and commit:

```bash
git add "01 - Projects/Flowti CLI/tests/tui/pages/agents-chat-page.test.ts"
git commit -m "test(tui): update chat page tests for connection states"
```
