# Agent Shell Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate scattered agent CLI execution into a single `IAgentShell` infrastructure singleton with `talk()`, `dispatch()`, and `getActiveDispatch()` methods.

**Architecture:** New `agent-shell.ts` in infrastructure absorbs `agent-process.ts` and `agent-runner.ts`. Menus call `deps.agentShell.talk()` / `deps.agentShell.dispatch()` instead of spawning processes directly. Provider resolution (`resolveProvider`) is an exported pure function for testability. The shell owns full lifecycle: state management, inbox notes, session tracking, active dispatch registry.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/superpowers/specs/2026-03-15-agent-shell-design.md`

---

## File Structure

### New files (2)
| File | Responsibility |
|------|---------------|
| `src/infrastructure/agent-shell.ts` | `IAgentShell` implementation + `resolveProvider` + `createAgentShell` factory |
| `tests/infrastructure/agent-shell.test.ts` | Shell + provider resolution tests |

### Modified files (8)
| File | Change |
|------|--------|
| `src/infrastructure/types.ts` | Add `IAgentShell`, `TalkSession`, `TalkResult`, `DispatchHandle`, `ProviderConfig`, `TalkOptions`, `DispatchOptions` |
| `src/infrastructure/types-config.ts` | Add `provider?: string` to `AgentsConfig` |
| `src/infrastructure/deps.ts` | Add `agentShell` to `CliDeps`, add `AgentMenuDeps` ISP subset |
| `src/main.ts` | Bootstrap `agentShell` via factory |
| `src/ui/menus/agents-interact-menu.ts` | Replace process spawning with `deps.agentShell.talk()` |
| `src/ui/menus/agents-run-menu.ts` | Replace `spawnAndStream` with `deps.agentShell.dispatch()` |
| `src/ui/menus/roster-task-menu.ts` | Replace clarify/launch with `talk()` + `dispatch()` |
| `src/ui/handlers/extensibility-handlers.ts` | Agent detail: live output via `getActiveDispatch()` |

### Deleted files (2)
| File | Reason |
|------|--------|
| `src/infrastructure/agent-process.ts` | Absorbed into agent-shell |
| `src/domain/agents/agent-runner.ts` | Absorbed into agent-shell |

---

## Chunk 1: Types + Provider Resolution

### Task 1: Add types to `types.ts` and `types-config.ts`

**Files:**
- Modify: `src/infrastructure/types.ts`
- Modify: `src/infrastructure/types-config.ts`

- [ ] **Step 1: Add all new interfaces to `types.ts`**

After the existing `BackgroundProcess` interface, add:

```typescript
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";
import type { AgentResponse } from "../domain/agents/agent-conversation.js";
import type { AgentCharacter } from "../domain/agents/agent-conversation.js";

export interface ProviderConfig {
	readonly binary: string;
	readonly streamArgs: readonly string[];
	readonly textArgs: readonly string[];
}

export interface TalkOptions {
	readonly thinkingDisplay?: "full" | "indicator" | "hidden";
	readonly character?: AgentCharacter;
	readonly idleTimeoutMs?: number;
}

export interface TalkResult {
	readonly response: AgentResponse;
	readonly thinking: string;
	readonly detached: boolean;
}

export interface TalkSession {
	onEvent(callback: (event: AgentStreamEvent) => void): () => void;
	readonly result: Promise<TalkResult | null>;
	detach(): void;
}

export interface DispatchOptions {
	readonly iterDir?: string;
	readonly iterationNumber?: number;
}

export interface DispatchHandle {
	onEvent(callback: (event: AgentStreamEvent) => void): () => void;
	readonly sessionId: string;
	readonly agentName: string;
	readonly task: string;
	readonly running: boolean;
	stop(): void;
}

export interface IAgentShell {
	talk(agent: import("../domain/agents/agent-types.js").AgentSummary, prompt: string, opts?: TalkOptions): TalkSession;
	dispatch(agent: import("../domain/agents/agent-types.js").AgentSummary, briefPath: string, task: string, opts?: DispatchOptions): DispatchHandle;
	getActiveDispatch(agentName: string): DispatchHandle | null;
}
```

- [ ] **Step 2: Add `provider` to `AgentsConfig`**

In `types-config.ts`, update `AgentsConfig`:

```typescript
export interface AgentsConfig { dir?: string; roster?: string[]; autonomous?: boolean; claudeSync?: boolean; skillMap?: Record<string, string[]>; thinkingDisplay?: "full" | "indicator" | "hidden"; processTimeoutMs?: number; provider?: string; }
```

- [ ] **Step 3: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/src/infrastructure/types-config.ts"
git commit -m "feat: add IAgentShell types and provider config"
```

### Task 2: Add `agentShell` to deps + `AgentMenuDeps` ISP subset

**Files:**
- Modify: `src/infrastructure/deps.ts`

- [ ] **Step 1: Add agentShell to CliDeps and create AgentMenuDeps**

Add `agentShell: IAgentShell` to the `CliDeps` interface. Add new ISP subset:

```typescript
export type AgentMenuDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "input" | "log" | "agentShell">;
```

- [ ] **Step 2: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: FAIL — `createDefaultDeps` doesn't return `agentShell` yet. That's OK — fixed in Task 4.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/deps.ts"
git commit -m "feat: add agentShell to CliDeps and AgentMenuDeps subset"
```

### Task 3: Create `agent-shell.ts` with `resolveProvider` + skeleton

**Files:**
- Create: `src/infrastructure/agent-shell.ts`
- Create: `tests/infrastructure/agent-shell.test.ts`

- [ ] **Step 1: Write provider resolution tests**

```typescript
import { describe, it, expect } from "vitest";
import { resolveProvider } from "../../../src/infrastructure/agent-shell.js";

describe("resolveProvider", () => {
	it("defaults to anthropic when no config", () => {
		const p = resolveProvider();
		expect(p.binary).toBe("claude");
		expect(p.streamArgs).toContain("stream-json");
	});

	it("uses agent override over global default", () => {
		const p = resolveProvider("anthropic", "cursor");
		expect(p.binary).toBe("cursor");
	});

	it("uses global default when no agent override", () => {
		const p = resolveProvider("cursor");
		expect(p.binary).toBe("cursor");
	});

	it("unknown provider uses provider string as binary", () => {
		const p = resolveProvider("ollama");
		expect(p.binary).toBe("ollama");
	});

	it("anthropic includes verbose and stream-json flags", () => {
		const p = resolveProvider("anthropic");
		expect(p.streamArgs).toContain("-p");
		expect(p.streamArgs).toContain("--output-format");
		expect(p.streamArgs).toContain("stream-json");
		expect(p.streamArgs).toContain("--verbose");
	});
});
```

- [ ] **Step 2: Create agent-shell.ts with resolveProvider + createAgentShell skeleton**

```typescript
/**
 * agent-shell.ts — Provider-agnostic agent execution layer.
 *
 * Consolidates all CLI process management for agent talk and dispatch.
 * Supports Claude CLI and Cursor (future) via provider resolution.
 */

import type { CliDeps } from "./deps.js";
import type { AgentsConfig } from "./types-config.js";
import type { IAgentShell, ProviderConfig, TalkSession, TalkResult, TalkOptions, DispatchHandle, DispatchOptions } from "./types.js";
import type { AgentSummary } from "../domain/agents/agent-types.js";
import type { AgentStreamEvent } from "../domain/agents/agent-stream.js";

export type ShellBaseDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

// ── Provider resolution (exported pure function) ────────────────────

export function resolveProvider(globalDefault?: string, agentProvider?: string): ProviderConfig {
	const provider = agentProvider ?? globalDefault ?? "anthropic";
	switch (provider) {
		case "anthropic": return {
			binary: "claude",
			streamArgs: ["-p", "--output-format", "stream-json", "--verbose"],
			textArgs: ["--print"],
		};
		case "cursor": return {
			binary: "cursor",
			streamArgs: ["--print", "--json"],
			textArgs: ["--print"],
		};
		default: return {
			binary: provider,
			streamArgs: ["-p"],
			textArgs: ["--print"],
		};
	}
}

// ── Factory ─────────────────────────────────────────────────────────

export function createAgentShell(deps: ShellBaseDeps, config: AgentsConfig | undefined, vaultRoot: string): IAgentShell {
	const activeDispatches = new Map<string, DispatchHandle>();
	const globalProvider = config?.provider;
	const processTimeout = config?.processTimeoutMs ?? 3_600_000;

	return {
		talk(_agent: AgentSummary, _prompt: string, _opts?: TalkOptions): TalkSession {
			throw new Error("Not implemented yet");
		},
		dispatch(_agent: AgentSummary, _briefPath: string, _task: string, _opts?: DispatchOptions): DispatchHandle {
			throw new Error("Not implemented yet");
		},
		getActiveDispatch(agentName: string): DispatchHandle | null {
			return activeDispatches.get(agentName) ?? null;
		},
	};
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts"
git commit -m "feat: add agent-shell with resolveProvider and factory skeleton"
```

---

## Chunk 2: Implement `talk()` and `dispatch()`

### Task 4: Implement `talk()` in agent-shell.ts

**Files:**
- Modify: `src/infrastructure/agent-shell.ts`
- Modify: `tests/infrastructure/agent-shell.test.ts`

- [ ] **Step 1: Write talk() tests**

Add tests for: spawns correct binary, emits events via onEvent, result contains response + thinking, returns null on empty response, detach promotes to dispatch and sets state busy. Mock `deps.shell.spawnBackground` and `deps.disk`.

- [ ] **Step 2: Implement talk()**

The `talk` method:
1. Resolves provider via `resolveProvider(globalProvider, agent.ai?.provider)`
2. Writes prompt to temp file
3. Spawns process: `${binary} ${streamArgs.join(" ")} < ${tempFile}`
4. Creates event emitter (Set of callbacks)
5. Parses stream via `parseStreamLine` + `updateStreamState`
6. Sets up rolling idle timeout (resets on each output event)
7. Creates `TalkSession` with `onEvent`, `result` promise, and `detach()`
8. `result` resolves when process exits — accumulated text passed through `parseAgentResponse`
9. `detach()` sets muted flag, registers in `activeDispatches` synchronously, sets state busy, attaches background completion handler (inbox + state idle)
10. Temp file cleanup in finally

Import from domain: `parseStreamLine`, `createStreamState`, `updateStreamState` from `agent-stream.ts`, `parseAgentResponse` from `agent-conversation.ts`, `readAgentState`, `writeAgentState` from `agent-state.ts`.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts"
git commit -m "feat: implement talk() in agent-shell with detach and idle timeout"
```

### Task 5: Implement `dispatch()` in agent-shell.ts

**Files:**
- Modify: `src/infrastructure/agent-shell.ts`
- Modify: `tests/infrastructure/agent-shell.test.ts`

- [ ] **Step 1: Write dispatch() tests**

Add tests for: registers in activeDispatches, sets state busy, sets state idle on exit, writes inbox note, creates session when iterDir provided, removes from registry on exit, handle.running reflects state.

- [ ] **Step 2: Implement dispatch()**

The `dispatch` method:
1. Resolves provider
2. Spawns process with brief via stdin redirect
3. Registers in `activeDispatches[agent.name]` SYNCHRONOUSLY
4. Sets agent state → "busy"
5. Creates session if `opts.iterDir` provided (via `createSession` from `agent-session.ts`)
6. Creates event emitter, parses stream
7. On exit: accumulate text → `parseAgentResponse` → write inbox note → if session: `appendStructuredOutput` + `updateSessionStatus` → set state idle → remove from registry
8. Returns `DispatchHandle` with `onEvent`, `sessionId`, `agentName`, `task`, `running`, `stop()`

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts"
git commit -m "feat: implement dispatch() in agent-shell with session tracking and inbox"
```

---

## Chunk 3: Bootstrap + Wire Menus

### Task 6: Bootstrap agentShell in main.ts

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Import and create agentShell in deps initialization**

Find where `CliDeps` is assembled. Import `createAgentShell` from `./infrastructure/agent-shell.js`. Construct it with the base deps, `cliConfig.agents`, and `VAULT_ROOT`. Add to the deps object.

- [ ] **Step 2: Verify type-check passes**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/main.ts"
git commit -m "feat: bootstrap agentShell in CliDeps initialization"
```

### Task 7: Simplify `agents-interact-menu.ts`

**Files:**
- Modify: `src/ui/menus/agents-interact-menu.ts`
- Modify: `tests/ui/menus/agents-menu.test.ts`

- [ ] **Step 1: Replace sendTurn with deps.agentShell.talk()**

Remove: `sendTurn` function (~80 lines), `createSpinner` usage inside sendTurn, all process spawning, idle timeout, detach race, background handler, inbox writing, state management.

Keep: `createSpinner` (for UX), `displayResponse`, `askUser`, conversation persistence (`loadConversation`, `saveConversation`, etc.), `buildConversationPrompt`.

New `talkToAgentInteractive` flow:
```typescript
const content = buildConversationPrompt(agentName, systemPrompt, oldHistory, userMessage, character);
const session = deps.agentShell.talk(agent, content, { character, thinkingDisplay, idleTimeoutMs: config?.processTimeoutMs });
const spinner = createSpinner(who, deps.log, "Enter to step away");
session.onEvent((event) => {
  if (event.kind === "thinking" || event.kind === "text") spinner.stop();
  // render thinking preview if desired
});
deps.input.ask("").then(() => { spinner.stop(); session.detach(); });
const result = await session.result;
spinner.stop();
if (!result || !result.response.message) return; // detached or error
displayResponse(agentName, result.response, deps, character?.persona);
// persist to conversation...
```

- [ ] **Step 2: Change deps type from ShellMenuDeps to AgentMenuDeps**

Update function signatures and the `sendClarification` function similarly.

- [ ] **Step 3: Update tests**

Mock `deps.agentShell.talk()` instead of `spawnBackground`. Remove mocks for `parseStreamLine`, `buildClaudeArgs`. Simplify test setup.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/menus/agents-menu.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-interact-menu.ts" "01 - Projects/Flowti CLI/tests/ui/menus/agents-menu.test.ts"
git commit -m "refactor: simplify agents-interact-menu to use agentShell.talk()"
```

### Task 8: Simplify `agents-run-menu.ts`

**Files:**
- Modify: `src/ui/menus/agents-run-menu.ts`
- Modify: `tests/ui/menus/agents-run-menu.test.ts`

- [ ] **Step 1: Replace spawnAndStream with deps.agentShell.dispatch()**

Remove: `spawnAndStream` function, all imports of `agent-process`, `agent-session`, `agent-stream`, `agent-run-display` (renderStreamEvent).

New flow:
```typescript
const handle = deps.agentShell.dispatch(agent, briefPath, task, { iterDir, iterationNumber: iteration.number });
handle.onEvent((event) => renderStreamEvent(event, deps.log, thinkingDisplay));
// If autonomous: don't await — return immediately, agent works in background
```

- [ ] **Step 2: Update tests**

Mock `deps.agentShell.dispatch()`. Remove process spawning mocks.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/menus/agents-run-menu.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/agents-run-menu.ts" "01 - Projects/Flowti CLI/tests/ui/menus/agents-run-menu.test.ts"
git commit -m "refactor: simplify agents-run-menu to use agentShell.dispatch()"
```

### Task 9: Simplify `roster-task-menu.ts`

**Files:**
- Modify: `src/ui/menus/roster-task-menu.ts`
- Modify: `tests/ui/menus/roster-task-menu.test.ts`

- [ ] **Step 1: Replace clarifyAndLaunch/launchBackground/sendClarification with shell calls**

Remove: `clarifyAndLaunch`, `launchBackground`, `sendClarification` functions (~150 lines). Remove direct process spawning imports.

New flow:
```typescript
// Clarification
const content = buildClarificationPrompt(agent.name, systemPrompt, task, "", "", [], undefined, character);
const session = deps.agentShell.talk(agent, content);
const result = await session.result;
// Show response, loop for follow-up questions...

// Launch
deps.agentShell.dispatch(agent, briefPath, task, { iterDir, iterationNumber: iteration.number });
```

- [ ] **Step 2: Change deps type to AgentMenuDeps**

- [ ] **Step 3: Update tests**

Mock `deps.agentShell`. Remove all process/stream mocks.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/menus/roster-task-menu.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/menus/roster-task-menu.ts" "01 - Projects/Flowti CLI/tests/ui/menus/roster-task-menu.test.ts"
git commit -m "refactor: simplify roster-task-menu to use agentShell"
```

---

## Chunk 4: Agent Detail Live View + Cleanup

### Task 10: Add live output to agent detail page

**Files:**
- Modify: `src/ui/handlers/extensibility-handlers.ts`

- [ ] **Step 1: Update agent-detail view handler**

In the `agent-detail` view handler, after rendering the agent detail and state, check for active dispatch:

```typescript
const handle = ctx.deps.agentShell?.getActiveDispatch(agent.name);
if (handle) {
  ctx.deps.log(`  ${CYAN}Currently working on:${RESET} ${handle.task}`);
  // Show recent output — subscribe briefly
}
```

- [ ] **Step 2: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts"
git commit -m "feat: show live dispatch status on agent detail page"
```

### Task 11: Delete absorbed files

**Files:**
- Delete: `src/infrastructure/agent-process.ts`
- Delete: `src/domain/agents/agent-runner.ts`
- Delete: `tests/infrastructure/agent-process.test.ts`
- Delete: `tests/domain/agents/agent-runner.test.ts`

- [ ] **Step 1: Remove imports of deleted modules**

Search for all imports of `agent-process.js` and `agent-runner.js` across the codebase. Update or remove them. Key files: `agents-run-menu.ts`, `agents-interact-menu.ts`, `roster-task-menu.ts`, `extensibility-handlers.ts`.

Check for re-exports in barrel files like `agent-brief.ts`.

- [ ] **Step 2: Delete the files**

```bash
rm "01 - Projects/Flowti CLI/src/infrastructure/agent-process.ts"
rm "01 - Projects/Flowti CLI/src/domain/agents/agent-runner.ts"
rm "01 - Projects/Flowti CLI/tests/infrastructure/agent-process.test.ts"
rm "01 - Projects/Flowti CLI/tests/domain/agents/agent-runner.test.ts"
```

- [ ] **Step 3: Run full type-check + test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor: delete agent-process and agent-runner, absorbed into agent-shell"
```

### Task 12: Full verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All tests pass (count will be slightly lower due to deleted test files, but no failures)

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Build succeeds

- [ ] **Step 3: Manual smoke test**

Run `.\flowti.cmd`, navigate to agents, talk to Bobby. Verify:
- Spinner shows immediately
- Thinking preview streams
- Response displays cleanly
- Enter to step away works
- Start menu shows busy agents
- Inbox notes appear after background completion

- [ ] **Step 4: Commit any cleanup**

Stage specific files only. No `git add -A`.
