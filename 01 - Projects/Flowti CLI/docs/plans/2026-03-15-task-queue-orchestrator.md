# Task Queue Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add automatic task dequeue on dispatch completion, stale state health recovery, and global UI refresh.

**Architecture:** The dispatch completion handler in `agent-shell.ts` marks tasks done and auto-dequeues the next pending task after a 10s cooldown. A `reconcileStaleAgents()` method recovers busy agents with no active process. The router intercepts a reserved `F5` key to re-render the current page.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-task-queue-orchestrator-design.md`

---

## File Structure

### Modified files (6)

| File | Change |
|------|--------|
| `src/domain/agents/agent-state.ts` | Add `completeFirstTask()` pure function |
| `src/infrastructure/agent-shell.ts` | Completion handler auto-dequeue + `reconcileStaleAgents()` + failure counter |
| `src/infrastructure/types.ts` | Add `reconcileStaleAgents` to `IAgentShell`, add `"refresh"` to `MenuResult` |
| `src/infrastructure/sitemap-router.ts` | Handle `"refresh"` result in `#applyResult`, reserved key in `runMenu` |
| `src/infrastructure/menu.ts` | Add `"refresh"` to `EXIT_RESULTS` set |
| `src/main.ts` | Call `reconcileStaleAgents()` at startup |
| `src/ui/handlers/register-handlers.ts` | Call `reconcileStaleAgents()` on start view render |

### Note on refresh key

The spec proposed `r` as the refresh key, but 3 pages already use `r` (README, Remove Agent, Regenerate Dirty). Use **F5** instead — it has no conflicts and is the universal refresh convention. The `runMenu` function reads raw input, so function keys work if the terminal supports them. Fallback: use `*` (asterisk) which has zero conflicts in the sitemap. The plan uses `"*"` as the key — easy to type, no conflicts, obvious meaning.

---

## Chunk 1: Domain — `completeFirstTask`

### Task 1: Add `completeFirstTask` to agent-state.ts

**Files:**
- Modify: `src/domain/agents/agent-state.ts`
- Modify: `tests/domain/agents/agent-state.test.ts` (if exists, else create at `tests/domain/agents/agent-state.test.ts`)

- [ ] **Step 1: Write tests for `completeFirstTask`**

Add to the agent-state test file:

```typescript
describe("completeFirstTask", () => {
	it("marks only the first pending task with matching name", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Build", assignedAt: "t1", status: "pending" },
				{ name: "Build", assignedAt: "t2", status: "pending" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.tasks[0].status).toBe("done");
		expect(result.tasks[1].status).toBe("pending");
	});

	it("marks in-progress task when no pending match", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Build", assignedAt: "t1", status: "in-progress" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.tasks[0].status).toBe("done");
	});

	it("leaves tasks with different name unchanged", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Build", assignedAt: "t1", status: "pending" },
				{ name: "Test", assignedAt: "t2", status: "pending" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.tasks[0].status).toBe("done");
		expect(result.tasks[1].status).toBe("pending");
	});

	it("returns idle status when all tasks done", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Build", assignedAt: "t1", status: "pending" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.status).toBe("idle");
	});

	it("preserves busy status when other tasks remain pending", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Build", assignedAt: "t1", status: "pending" },
				{ name: "Test", assignedAt: "t2", status: "pending" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.status).toBe("busy");
	});

	it("returns state unchanged when no matching task", () => {
		const state: AgentState = {
			name: "Dev", status: "busy", tasks: [
				{ name: "Test", assignedAt: "t1", status: "pending" },
			], briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result).toEqual(state);
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL (function not defined)**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [ ] **Step 3: Implement `completeFirstTask`**

Add to `src/domain/agents/agent-state.ts` after `completeTask`:

```typescript
/** Mark the first task matching the name (pending or in-progress) as done. Unlike completeTask, this marks only ONE match. */
export function completeFirstTask(state: AgentState, taskName: string): AgentState {
	let found = false;
	const tasks = state.tasks.map((t) => {
		if (!found && t.name === taskName && (t.status === "pending" || t.status === "in-progress")) {
			found = true;
			return { ...t, status: "done" as const };
		}
		return t;
	});
	if (!found) return state;
	const allDone = tasks.every((t) => t.status === "done");
	return { ...state, tasks, status: allDone ? "idle" : state.status };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-state.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-state.test.ts"
git commit -m "feat: add completeFirstTask to agent-state"
```

---

## Chunk 2: Auto-Dequeue in Dispatch Completion

### Task 2: Add types and update `IAgentShell` interface

**Files:**
- Modify: `src/infrastructure/types.ts`

- [ ] **Step 1: Add `reconcileStaleAgents` to `IAgentShell`**

After `getActiveDispatch` in the `IAgentShell` interface, add:

```typescript
reconcileStaleAgents(): { recovered: string[] };
```

- [ ] **Step 2: Add `"refresh"` to `MenuResult`**

Change:

```typescript
export type MenuResult = "main" | "quit" | "start" | void;
```

To:

```typescript
export type MenuResult = "main" | "quit" | "start" | "refresh" | void;
```

- [ ] **Step 3: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: FAIL — `createAgentShell` doesn't return `reconcileStaleAgents` yet. That's OK — fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts"
git commit -m "feat: add reconcileStaleAgents to IAgentShell and refresh to MenuResult"
```

### Task 3: Implement auto-dequeue and `reconcileStaleAgents` in agent-shell.ts

**Files:**
- Modify: `src/infrastructure/agent-shell.ts`
- Modify: `tests/infrastructure/agent-shell.test.ts`

- [ ] **Step 1: Import `completeFirstTask` in agent-shell.ts**

Update the import from agent-state.ts:

```typescript
import { readAgentState, writeAgentState, completeFirstTask } from "../domain/agents/agent-state.js";
```

- [ ] **Step 2: Add failure counter and system inbox note writer**

Inside `createAgentShell`, after the `varDir` declaration, add:

```typescript
const failureCounts = new Map<string, number>();
```

Add a new function after `writeInboxNote` (module level):

```typescript
function writeSystemInboxNote(
	deps: ShellBaseDeps, vaultRoot: string, agentName: string, message: string,
): void {
	const inboxDir = deps.paths.join(vaultRoot, "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) deps.disk.mkdirSync(inboxDir, { recursive: true });
	const slug = `system-${agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${deps.clock.ms()}`;
	const lines = [
		"---", `type: agent-note`, `from: system`, `persona: ${agentName}`,
		`date: ${deps.clock.iso()}`, `status: message`, "---", "",
		`# System Note — ${agentName}`, "", message, "",
	];
	deps.disk.writeFileSync(deps.paths.join(inboxDir, `${slug}.md`), lines.join("\n"), "utf-8");
}
```

- [ ] **Step 3: Replace the dispatch completion handler**

Replace the current completion handler (lines 255-265):

```typescript
// Background completion — inbox note + state cleanup + auto-dequeue
proc.waitForExit(processTimeout).then((exitCode) => {
	const accumulated = textBuffer.join("");
	if (accumulated) {
		writeInboxNote(deps, vaultRoot, agent.name, agent.persona, task, accumulated, thinkingBuffer.join(""));
	}

	// Mark current task done
	let state = readAgentState(deps, varDir, agent.name);
	state = completeFirstTask(state, task);
	writeAgentState(deps, varDir, agent.name, state);

	// Track failures for auto-dequeue guard
	const failed = exitCode !== 0 && !accumulated;
	if (failed) {
		failureCounts.set(agent.name, (failureCounts.get(agent.name) ?? 0) + 1);
	} else {
		failureCounts.delete(agent.name);
	}

	if ((failureCounts.get(agent.name) ?? 0) >= 3) {
		writeSystemInboxNote(deps, vaultRoot, agent.name, "Auto-dequeue stopped after repeated failures.");
		setAgentStatus(agent.name, "idle");
		activeDispatches.delete(agent.name);
		failureCounts.delete(agent.name);
		return;
	}

	// Check for next pending task
	const nextTask = state.tasks.find((t) => t.status === "pending");
	if (nextTask && deps.disk.existsSync(briefPath)) {
		writeSystemInboxNote(deps, vaultRoot, agent.name, `Starting next task: ${nextTask.name}`);
		setTimeout(() => {
			// Re-read state to guard against manual intervention during cooldown
			const freshState = readAgentState(deps, varDir, agent.name);
			const stillPending = freshState.tasks.find((t) => t.name === nextTask.name && t.status === "pending");
			if (!stillPending) {
				setAgentStatus(agent.name, "idle");
				activeDispatches.delete(agent.name);
				return;
			}
			// Mark in-progress and re-dispatch
			const updated = { ...freshState, tasks: freshState.tasks.map((t) => t.name === nextTask.name && t.status === "pending" ? { ...t, status: "in-progress" as const } : t) };
			writeAgentState(deps, varDir, agent.name, updated);
			// Re-use dispatch — this recursively attaches the same completion handler
			activeDispatches.delete(agent.name);
			shell.dispatch(agent, briefPath, nextTask.name, opts);
		}, 10_000);
	} else {
		setAgentStatus(agent.name, "idle");
		activeDispatches.delete(agent.name);
	}
}).catch(() => {
	activeDispatches.delete(agent.name);
});
```

**Important:** The `dispatch` method needs to reference itself for recursive re-dispatch. Assign the return object to a `const shell` before returning:

Change `return {` to `const shell: IAgentShell = {` and add `return shell;` at the end of `createAgentShell`.

- [ ] **Step 4: Add `reconcileStaleAgents` method**

Add to the shell object, after `getActiveDispatch`:

```typescript
reconcileStaleAgents(): { recovered: string[] } {
	const recovered: string[] = [];
	if (!deps.disk.existsSync(varDir)) return { recovered };
	const files = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
	for (const file of files) {
		try {
			const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
			const raw = JSON.parse(content) as { name?: string; status?: string };
			if (raw.status !== "busy" || !raw.name) continue;
			if (activeDispatches.has(raw.name)) continue;
			// Stale — recover to idle
			const state = readAgentState(deps, varDir, raw.name);
			writeAgentState(deps, varDir, raw.name, { ...state, status: "idle" });
			writeSystemInboxNote(deps, vaultRoot, raw.name, "Process was interrupted. Recovered to idle.");
			recovered.push(raw.name);
		} catch { /* corrupt file — skip */ }
	}
	return { recovered };
},
```

- [ ] **Step 5: Write tests for auto-dequeue and health monitor**

Add to `tests/infrastructure/agent-shell.test.ts`:

```typescript
describe("dispatch auto-dequeue", () => {
	it("marks task done on completion", async () => {
		// Setup: write a state file with a pending task, dispatch, resolve process exit
		// Verify: state file has task marked done
	});

	it("dispatches next pending task after cooldown", async () => {
		// Setup: state file with 2 pending tasks, dispatch first
		// Use vi.useFakeTimers(), advance 10s
		// Verify: spawnBackground called twice
	});

	it("sets idle when no pending tasks remain", async () => {
		// Setup: state file with 1 pending task, dispatch
		// Verify: state set to idle after completion
	});

	it("skips re-dispatch when brief file missing", async () => {
		// Setup: existsSync returns false for brief path
		// Verify: sets idle, no second spawn
	});

	it("stops after 3 consecutive failures", async () => {
		// Setup: process exits non-zero with no output 3 times
		// Verify: writes "stopped after repeated failures" note
	});
});

describe("reconcileStaleAgents", () => {
	it("recovers stale busy agent to idle", () => {
		// Setup: write data-dev.json with status: busy, no active dispatch
		// Call reconcileStaleAgents
		// Verify: state is idle, inbox note written
	});

	it("ignores agent with active dispatch", () => {
		// Setup: write data-dev.json with status: busy, add to activeDispatches
		// Verify: state unchanged
	});

	it("ignores idle agents", () => {
		// Setup: write data-dev.json with status: idle
		// Verify: not included in recovered
	});

	it("returns recovered agent names", () => {
		// Setup: 2 stale agents
		// Verify: recovered array has both names
	});
});
```

Note: These tests are structural guides. The implementer should write the full mock setup following the existing patterns in agent-shell.test.ts (using `createMockDeps`, `createMockAgent`, etc.).

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 7: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts"
git commit -m "feat: auto-dequeue on dispatch completion and reconcileStaleAgents"
```

---

## Chunk 3: Refresh Signal + Bootstrap

### Task 4: Add refresh handling to menu and router

**Files:**
- Modify: `src/infrastructure/menu.ts`
- Modify: `src/infrastructure/sitemap-router.ts`

- [ ] **Step 1: Add `"refresh"` to EXIT_RESULTS in menu.ts**

Change:

```typescript
const EXIT_RESULTS: Set<string> = new Set(["main", "quit", "start"]);
```

To:

```typescript
const EXIT_RESULTS: Set<string> = new Set(["main", "quit", "start", "refresh"]);
```

- [ ] **Step 2: Add `*` key as refresh trigger in `runMenu`**

After the `findMatch` check in `runMenu`, add a refresh key check:

```typescript
if (choice === "*") return "refresh" as MenuResult;
```

Add this BEFORE the `findMatch` call so `*` is always intercepted.

- [ ] **Step 3: Handle `"refresh"` in router `#applyResult`**

In `#applyResult`, add a case before `if (result === "quit")`:

```typescript
if (result === "refresh") return false; // re-render current page (don't pop stack)
```

This causes the while loop in `run()` to iterate again, re-rendering the current page.

- [ ] **Step 4: Run type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/menu.test.ts tests/infrastructure/sitemap-router.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/menu.ts" "01 - Projects/Flowti CLI/src/infrastructure/sitemap-router.ts"
git commit -m "feat: add refresh signal via * key in menu and router"
```

### Task 5: Bootstrap reconcileStaleAgents at startup and start view

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/handlers/register-handlers.ts`

- [ ] **Step 1: Call reconcileStaleAgents in main.ts**

After `const deps = createDefaultDeps(cliConfig.agents, VAULT_ROOT);` and `initializeDeps(deps);`, add:

```typescript
const { recovered } = deps.agentShell.reconcileStaleAgents();
if (recovered.length > 0) log(`  ${DIM}Recovered ${recovered.length} stale agent(s): ${recovered.join(", ")}${RESET}`);
```

- [ ] **Step 2: Call reconcileStaleAgents in start view render**

In `register-handlers.ts`, in the `renderBusyAgents` function (or the start view `beforeRender` handler), add at the top:

```typescript
deps.agentShell.reconcileStaleAgents();
```

This ensures stale agents are cleaned up whenever the user sees the start view.

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 4: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/main.ts" "01 - Projects/Flowti CLI/src/ui/handlers/register-handlers.ts"
git commit -m "feat: bootstrap reconcileStaleAgents at startup and start view"
```

### Task 6: Full verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 3: Manual smoke test**

Run `.\flowti.cmd` and verify:
- Assign 2 tasks to an agent via roster menu
- First task dispatches, agent shows as "busy"
- Press `*` to refresh — view re-renders
- When first task completes, inbox note appears, second task auto-starts after 10s
- Kill the CLI while agent is busy, restart — agent recovers to idle with inbox note
- Assign a task after recovery — works normally
