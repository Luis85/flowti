# Agent Task Execution — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents receive tasks from the Director, execute them autonomously (via LLM, tool, or both), work at their workstation, and report back when done.

**Architecture:** Extend the pipe-delimited `suggestedTasks` format with `input:` and `tool:` segments. Plugin parses these from vault agent markdown files, renders them in the tasks panel with an input modal. A new `executeTask()` method on DashboardStore orchestrates: brain locks agent at workstation, tool command runs via `child_process`, LLM interprets results, completion triggers bubble + talk entry + unread dot.

**Tech Stack:** TypeScript, Lit, ExcaliburJS (brain system), Node child_process, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-agent-task-execution-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `CLI: src/domain/agents/agent-types.ts` | Extend `SuggestedTask` with `input?` and `tool?` |
| `CLI: src/domain/agents/agent-store.ts` | Export + extend `parseSuggestedTask()` for new format |
| `Plugin: src/game/data/types.ts` | Mirror extended `SuggestedTask`, add task status union |
| `Plugin: src/game/systems/brain-system.ts` | `taskLocked` flag, `assignWork()`, `releaseWork()` |
| `Plugin: src/game/store/dashboard-store.ts` | `executeTask()`, `unreadAgents`, tool spawning |
| `Plugin: src/game/ui/panel-tasks.ts` | Input modal, progress indicators, richer task cards |
| `Plugin: src/game/ui/roster-bar.ts` | Unread dot on agent card |
| `Plugin: src/infrastructure/handlers/agent-handlers.ts` | Parse `suggestedTasks` in `loadAgentCards()` |

---

## Phase A: Data Model (CLI + Plugin types)

### Task 1: Extend SuggestedTask type and parser (CLI)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-types.ts:89-95`
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-store.ts:43-47`
- Test: `01 - Projects/Flowti CLI/tests/domain/agents/agent-store.test.ts`

- [ ] **Step 1: Write failing test for extended parser**

In the agent-store test file, add tests for the new `input:` and `tool:` segments:

```typescript
describe("parseSuggestedTask", () => {
	it("parses name and phases only", () => {
		const result = parseSuggestedTask("Refine goal|new,planned");
		expect(result).toEqual({ name: "Refine goal", phases: ["new", "planned"] });
	});

	it("parses input segment", () => {
		const result = parseSuggestedTask("Refine goal|new|input:text:What is the goal?");
		expect(result).toEqual({
			name: "Refine goal",
			phases: ["new"],
			input: { type: "text", prompt: "What is the goal?" },
		});
	});

	it("parses tool segment", () => {
		const result = parseSuggestedTask("Run tests|any|tool:flowti test --format=json");
		expect(result).toEqual({
			name: "Run tests",
			phases: ["any"],
			tool: { command: "flowti test --format=json" },
		});
	});

	it("parses both input and tool", () => {
		const result = parseSuggestedTask("Review|ready|input:text:Which PR?|tool:flowti review");
		expect(result).toEqual({
			name: "Review",
			phases: ["ready"],
			input: { type: "text", prompt: "Which PR?" },
			tool: { command: "flowti review" },
		});
	});

	it("handles segments in any order", () => {
		const result = parseSuggestedTask("Review|ready|tool:flowti review|input:text:Which PR?");
		expect(result.input).toEqual({ type: "text", prompt: "Which PR?" });
		expect(result.tool).toEqual({ command: "flowti review" });
	});

	it("handles no phases with input", () => {
		const result = parseSuggestedTask("Quick task||input:text:Details?");
		expect(result).toEqual({
			name: "Quick task",
			phases: [],
			input: { type: "text", prompt: "Details?" },
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-store.test.ts -t "parseSuggestedTask" --config configs/vitest.config.ts`

Expected: FAIL — `parseSuggestedTask` is not exported, tests can't import it.

- [ ] **Step 3: Extend SuggestedTask type**

In `agent-types.ts` (lines 89-95), add optional fields:

```typescript
export interface SuggestedTask {
	name: string;
	phases: string[];
	input?: { type: "text"; prompt: string };
	tool?: { command: string };
}
```

- [ ] **Step 4: Export and extend parseSuggestedTask**

In `agent-store.ts`, export the function and extend parsing (line 43):

```typescript
export function parseSuggestedTask(raw: string): SuggestedTask {
	const segments = raw.split("|");
	const name = segments[0].trim();
	const phases = segments.length > 1
		? segments[1].split(",").map((s) => s.trim()).filter(Boolean)
		: [];

	let input: SuggestedTask["input"];
	let tool: SuggestedTask["tool"];

	for (let i = 2; i < segments.length; i++) {
		const seg = segments[i].trim();
		if (seg.startsWith("input:")) {
			const rest = seg.slice(6);
			const colonIdx = rest.indexOf(":");
			if (colonIdx !== -1) {
				input = { type: "text", prompt: rest.slice(colonIdx + 1) };
			}
		} else if (seg.startsWith("tool:")) {
			tool = { command: seg.slice(5) };
		}
	}

	const result: SuggestedTask = { name, phases };
	if (input) result.input = input;
	if (tool) result.tool = tool;
	return result;
}
```

Note: `SuggestedTask` fields `input` and `tool` are optional, so `result` starts without them and they're only added if parsed. This requires changing `SuggestedTask` from all-readonly to mutable in the builder, or using object spread. Since the interface already doesn't use `readonly`, assign directly.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-store.test.ts --config configs/vitest.config.ts`

Expected: All tests pass including new `parseSuggestedTask` tests.

- [ ] **Step 6: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All ~7,400 tests pass. No regressions from type change.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-types.ts" \
       "01 - Projects/Flowti CLI/src/domain/agents/agent-store.ts" \
       "01 - Projects/Flowti CLI/tests/domain/agents/agent-store.test.ts"
git commit -m "feat(agents): extend SuggestedTask with input and tool segments"
```

---

### Task 2: Mirror types in Plugin + parse in loadAgentCards

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/data/types.ts:66`
- Modify: `01 - Projects/Flowti Plugin/src/domain/agents/types.ts`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts:98-124`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/handlers/agent-handlers.test.ts`

- [ ] **Step 1: Extend DashboardAgent suggestedTasks type**

In `src/game/data/types.ts` line 66, update:

```typescript
readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
```

- [ ] **Step 2: Add task status type**

In `src/game/data/types.ts`, add after `DashboardAgent`:

```typescript
export type TaskStatus = "pending" | "in-progress" | "completed" | "failed";

export interface TrackedTask {
	readonly name: string;
	readonly status: TaskStatus;
	readonly assignedAt: number;
	readonly input?: string;
	readonly tool?: { command: string };
}
```

- [ ] **Step 3: Add parseSuggestedTask to agent-handlers**

In `agent-handlers.ts`, add a `parseSuggestedTask()` function (after `parseFrontmatter`, before `loadAgentCards`):

```typescript
function parseSuggestedTask(raw: string): { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } } {
	const segments = raw.split("|");
	const name = segments[0].trim();
	const phases = segments.length > 1
		? segments[1].split(",").map((s) => s.trim()).filter(Boolean)
		: [];

	let input: { type: "text"; prompt: string } | undefined;
	let tool: { command: string } | undefined;

	for (let i = 2; i < segments.length; i++) {
		const seg = segments[i].trim();
		if (seg.startsWith("input:")) {
			const rest = seg.slice(6);
			const colonIdx = rest.indexOf(":");
			if (colonIdx !== -1) {
				input = { type: "text", prompt: rest.slice(colonIdx + 1) };
			}
		} else if (seg.startsWith("tool:")) {
			tool = { command: seg.slice(5) };
		}
	}

	return { name, phases, ...(input && { input }), ...(tool && { tool }) };
}
```

- [ ] **Step 4: Extract suggestedTasks in loadAgentCards**

In `loadAgentCards()` (line 98-124), after extracting `persona`/`mood`/`attrs`, also extract `suggestedTasks`:

```typescript
const suggestedTasks = Array.isArray(fm.suggestedTasks)
	? (fm.suggestedTasks as string[]).map(parseSuggestedTask)
	: undefined;
```

Add `suggestedTasks` to the `AgentCard` type in `src/domain/agents/types.ts` and pass it through. The `AgentCard` interface needs a new field:

```typescript
readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
```

- [ ] **Step 5: Write test for suggestedTasks parsing**

Add to `agent-handlers.test.ts`:

```typescript
it("parses suggestedTasks with input and tool segments", async () => {
	const agentMd = `---
type: Agent
name: Tester
suggestedTasks:
  - Run tests|any|tool:flowti test
  - Review code|ready|input:text:Which file?
---
# Tester
`;
	const adapter = mockVaultAdapter({ "agents/tester.md": agentMd });
	mountAgentSidepanel(container, {
		eventBus: mockEventBus(),
		vaultAdapter: adapter,
		agentsDir: "agents",
	});
	await vi.waitFor(() => {
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		const agents = el.agents as { name: string; suggestedTasks?: { name: string; tool?: { command: string }; input?: { type: string; prompt: string } }[] }[];
		expect(agents[0].suggestedTasks).toHaveLength(2);
		expect(agents[0].suggestedTasks![0].tool).toEqual({ command: "flowti test" });
		expect(agents[0].suggestedTasks![1].input).toEqual({ type: "text", prompt: "Which file?" });
	});
});
```

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/agent-handlers.test.ts`

Expected: All tests pass including new suggestedTasks test.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/types.ts" \
       "01 - Projects/Flowti Plugin/src/domain/agents/types.ts" \
       "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts" \
       "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/agent-handlers.test.ts"
git commit -m "feat(agents): mirror extended SuggestedTask types in Plugin, parse in loadAgentCards"
```

---

## Phase B: Brain System (workstation locking)

### Task 3: Add taskLocked flag and assignWork/releaseWork

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts:17-36,290-312`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/brain-system.test.ts` (create if needed)

- [ ] **Step 1: Write failing tests for assignWork/releaseWork**

```typescript
describe("task locking", () => {
	it("assignWork transitions agent to walking-to workstation", () => {
		brain.register("atlas", { domain: "engineering", personality: [], attributes: { int: 14 } });
		brain.assignWork("atlas");
		const entry = brain.getState("atlas");
		expect(entry?.state).toBe("walking-to");
	});

	it("updateWorking does not exit when taskLocked", () => {
		brain.register("atlas", { domain: "engineering", personality: [], attributes: { int: 14 } });
		brain.assignWork("atlas");
		// Simulate arriving at workstation
		brain.forceState("atlas", "working");
		// Advance past focusDuration
		for (let i = 0; i < 100; i++) brain.update(1000);
		const entry = brain.getState("atlas");
		expect(entry?.state).toBe("working");
	});

	it("releaseWork allows normal behavior", () => {
		brain.register("atlas", { domain: "engineering", personality: [], attributes: { int: 14 } });
		brain.assignWork("atlas");
		brain.forceState("atlas", "working");
		brain.releaseWork("atlas");
		const entry = brain.getState("atlas");
		expect(entry?.state).toBe("idle");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/brain-system.test.ts`

Expected: FAIL — `assignWork`, `releaseWork`, `forceState` don't exist.

- [ ] **Step 3: Add taskLocked to AgentBrainEntry**

In `brain-system.ts` line 36, add to the `AgentBrainEntry` interface:

```typescript
taskLocked: boolean;
```

Initialize to `false` in `register()`.

- [ ] **Step 4: Implement assignWork**

Add method to `BrainSystem`:

```typescript
assignWork(name: string): void {
	const entry = this.entries.get(name);
	if (!entry) return;
	entry.taskLocked = true;
	entry.state = "walking-to";
	entry.stateTimer = 0;
	const ws = preferredWorkstation(entry.domain, this.targetBounds);
	entry.targetPos = ws;
	entry.target = { kind: "workstation", x: ws.x, y: ws.y };
	this.config.onWorkstationChange?.(name, "claim", ws);
}
```

- [ ] **Step 5: Implement releaseWork**

```typescript
releaseWork(name: string): void {
	const entry = this.entries.get(name);
	if (!entry) return;
	entry.taskLocked = false;
	if (entry.state === "working") {
		this.config.onWorkstationChange?.(name, "vacate", entry.position);
	}
	entry.state = "idle";
	entry.target = { kind: "none" };
	entry.targetPos = null;
	entry.stateTimer = 0;
}
```

- [ ] **Step 6: Guard updateWorking with taskLocked**

In `updateWorking()` (line 290), add early return at the top:

```typescript
private updateWorking(entry: AgentBrainEntry, name: string): void {
	if (entry.taskLocked) return; // Task-locked agents stay at workstation indefinitely
	// ... existing focusDuration logic
}
```

- [ ] **Step 7: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/`

Expected: All brain system tests pass.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/brain-system.test.ts"
git commit -m "feat(brain): taskLocked flag with assignWork/releaseWork for task execution"
```

---

## Phase C: Task Executor (DashboardStore)

### Task 4: Add executeTask, unreadAgents, and tool spawning

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts:46,341-377`
- Test: `01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
describe("executeTask", () => {
	it("adds task to assignedTasks as pending", () => {
		const store = new DashboardStore();
		store.executeTask("atlas", { name: "Review", phases: [] });
		const tasks = store.assignedTasks.get("atlas");
		expect(tasks).toHaveLength(1);
		expect(tasks![0].status).toBe("pending");
	});

	it("dispatches task-assigned event", () => {
		const store = new DashboardStore();
		let detail: unknown = null;
		store.addEventListener("task-assigned", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		store.executeTask("atlas", { name: "Review", phases: [] });
		expect(detail).toEqual(expect.objectContaining({ agentName: "atlas" }));
	});

	it("logs to debug console", () => {
		const store = new DashboardStore();
		store.executeTask("atlas", { name: "Review", phases: [] }, "the input");
		expect(store.debugLog).toHaveLength(1);
		expect(store.debugLog[0].prompt).toContain("Review");
		expect(store.debugLog[0].prompt).toContain("the input");
	});
});

describe("unreadAgents", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.unreadAgents.size).toBe(0);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`

Expected: FAIL — `executeTask` and `unreadAgents` don't exist.

- [ ] **Step 3: Add unreadAgents field**

In `dashboard-store.ts`, add to public state (after `assignedTasks`):

```typescript
unreadAgents: Set<string> = new Set();
```

- [ ] **Step 4: Update assignedTasks type**

Change the `assignedTasks` type (line 46) to use `TrackedTask`:

```typescript
assignedTasks: Map<string, { name: string; status: string; assignedAt: number; input?: string; tool?: { command: string } }[]> = new Map();
```

- [ ] **Step 5: Implement executeTask**

Add new method to DashboardStore:

```typescript
executeTask(agentName: string, task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }, userInput?: string): void {
	// Track task
	const tasks = this.assignedTasks.get(agentName) ?? [];
	tasks.push({
		name: task.name,
		status: "pending",
		assignedAt: Date.now(),
		input: userInput,
		tool: task.tool,
	});
	this.assignedTasks.set(agentName, tasks);

	// Build task prompt
	const inputLine = userInput ? `\nDirector's input: ${userInput}` : "";
	const toolLine = task.tool
		? `\nA tool has been dispatched: "${task.tool.command}". Its output will follow. Interpret the results and summarize for the Director.`
		: "\nWork through this using your expertise. Report when complete.";
	const taskPrompt = `[Task Assignment]\nTask: ${task.name}${inputLine}\n\nExecute this task. When done, report your results concisely.${toolLine}`;

	this.pushDebugEntry(agentName, taskPrompt, "task");

	// Dispatch events
	this.dispatchEvent(new CustomEvent("task-assigned", {
		detail: { agentName, task: task.name, tool: task.tool?.command },
	}));
	this.notify();

	// Send to LLM
	const proc = this.getOrStartProcess(agentName);
	if (!proc) {
		this.markTaskStatus(agentName, task.name, "failed");
		this.pushAgentResponse(agentName, "[offline] Cannot execute task — CLI executor not available.");
		return;
	}

	proc.send(taskPrompt);

	// Spawn tool if mapped
	if (task.tool) {
		this.runToolCommand(agentName, task, proc);
	}
}

private markTaskStatus(agentName: string, taskName: string, status: string): void {
	const tasks = this.assignedTasks.get(agentName) ?? [];
	const entry = tasks.find((t) => t.name === taskName && t.status !== "completed" && t.status !== "failed");
	if (entry) (entry as { status: string }).status = status;
	this.notify();
}

private runToolCommand(agentName: string, task: { name: string; tool?: { command: string } }, proc: AgentProcess): void {
	if (!task.tool) return;

	const args = task.tool.command.split(/\s+/);
	const cmd = args.shift()!;

	import("node:child_process").then(({ execFile }) => {
		execFile(cmd, args, { cwd: this.cliExecutor ? undefined : undefined, timeout: 120_000 }, (error, stdout, stderr) => {
			const output = [`[Tool output for "${task.name}"]`, "", stdout];
			if (stderr) output.push("[stderr]", stderr);
			if (error) output.push(`[exit code: ${error.code ?? "unknown"}]`);

			proc.send(output.join("\n"));
			this.pushDebugEntry(agentName, output.join("\n"), "tool-output");
		});
	});
}
```

- [ ] **Step 6: Wire task completion — listen for response after task**

In `handleCliEvent`, detect when a response arrives while the agent has a pending/in-progress task. Add after the existing response handling:

```typescript
case "response": {
	const text = extractAgentMessage(event.text ?? "");
	this.pushAgentResponse(agentName, text);

	// Check if agent has an active task — mark completed on final response
	const agentTasks = this.assignedTasks.get(agentName) ?? [];
	const activeTask = agentTasks.find((t) => t.status === "pending" || t.status === "in-progress");
	if (activeTask) {
		this.markTaskStatus(agentName, activeTask.name, "completed");
		this.unreadAgents.add(agentName);
		this.dispatchEvent(new CustomEvent("task-completed", {
			detail: { agentName, task: activeTask.name, result: text },
		}));
	}

	this.dispatchEvent(new CustomEvent("agent-response-received", {
		detail: { agentName, text, type: "speaking" },
	}));
	break;
}
```

- [ ] **Step 7: Clear unread on talk tab selection**

In `selectTab()`, add unread clearing:

```typescript
selectTab(tab: TabName): void {
	this.selectedTab = tab;
	if (tab === "talk" && this.selectedAgent) {
		this.unreadAgents.delete(this.selectedAgent);
	}
	this.notify();
}
```

- [ ] **Step 8: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`

Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" \
       "01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts"
git commit -m "feat(store): executeTask with tool spawning, unreadAgents, completion tracking"
```

---

## Phase D: UI (panel-tasks + roster-bar)

### Task 5: Input modal and task progress in panel-tasks

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-tasks.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/ui/panel-tasks.test.ts` (create)

- [ ] **Step 1: Add pendingTaskDef and inputValue state**

Replace `pendingTask: string | null` (line 185) with:

```typescript
private pendingTaskDef: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } } | null = null;
private inputValue = "";
```

- [ ] **Step 2: Update handleAssignClick to accept full task object**

```typescript
private handleAssignClick(task: { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }): void {
	if (task.input) {
		this.pendingTaskDef = task;
		this.inputValue = "";
	} else if (this.isAiAgent) {
		this.pendingTaskDef = task;
		this.inputValue = "";
	} else {
		void this.store.executeTask(this.agent.name, task);
	}
}
```

- [ ] **Step 3: Update handleConfirm to call executeTask**

```typescript
private handleConfirm(): void {
	if (this.pendingTaskDef) {
		void this.store.executeTask(
			this.agent.name,
			this.pendingTaskDef,
			this.pendingTaskDef.input ? this.inputValue : undefined,
		);
	}
	this.pendingTaskDef = null;
	this.inputValue = "";
}
```

- [ ] **Step 4: Update renderConfirmDialog to show input modal**

Replace `renderConfirmDialog()` (lines 272-291):

```typescript
private renderConfirmDialog() {
	if (!this.pendingTaskDef) return nothing;

	const task = this.pendingTaskDef;
	const agentName = this.agent?.name ?? "";
	const hasInput = !!task.input;

	return html`
		<div class="confirm-overlay">
			<div class="confirm-dialog">
				<div class="confirm-message">
					${hasInput
						? task.input!.prompt
						: html`Assign "${task.name}" to ${agentName}?`}
				</div>
				${hasInput ? html`
					<input
						class="task-input"
						type="text"
						.value="${this.inputValue}"
						@input="${(e: Event) => { this.inputValue = (e.target as HTMLInputElement).value; }}"
						@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter" && this.inputValue.trim()) this.handleConfirm(); }}"
						placeholder="Type your answer..."
					/>
				` : nothing}
				<div class="confirm-buttons">
					<button class="confirm-btn" @click="${this.handleConfirm}" ?disabled="${hasInput && !this.inputValue.trim()}">
						${hasInput ? "Send" : "Confirm"}
					</button>
					<button class="cancel-btn" @click="${this.handleCancel}">Cancel</button>
				</div>
			</div>
		</div>
	`;
}
```

- [ ] **Step 5: Add CSS for task-input**

Add to the static styles:

```css
.task-input {
	width: 100%;
	padding: 6px 10px;
	margin-bottom: 10px;
	background: var(--bg-primary);
	border: 1px solid var(--border);
	border-radius: 4px;
	color: var(--text-primary);
	font-family: inherit;
	font-size: 12px;
	outline: none;
	box-sizing: border-box;
}

.task-input:focus {
	border-color: var(--accent-blue);
}
```

- [ ] **Step 6: Update renderSuggestedTasks to pass full task object**

In `renderSuggestedTasks()` (line 262-266), change the button click handler:

```typescript
@click="${() => { this.handleAssignClick(task); }}"
```

- [ ] **Step 7: Add progress indicator to task list**

Update `renderTaskList()` to show status badges with the `failed` state:

Add CSS for `.task-badge[data-status="failed"]`:

```css
.task-badge[data-status="failed"] {
	background: #7f1d1d;
	color: #f87171;
}
```

- [ ] **Step 8: Update properties declaration**

Replace `pendingTask` property with new state properties:

```typescript
pendingTaskDef: { state: true },
inputValue: { state: true },
```

- [ ] **Step 9: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/panel-tasks.test.ts`

Expected: All tests pass.

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/panel-tasks.ts" \
       "01 - Projects/Flowti Plugin/tests/game/ui/panel-tasks.test.ts"
git commit -m "feat(tasks): input modal for parameterized tasks, progress indicators"
```

---

### Task 6: Unread dot on roster bar

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/roster-bar.ts:119-136`

- [ ] **Step 1: Add store property to roster bar**

The roster bar currently only receives `domainAgents`. It needs access to `store.unreadAgents`. Add a `store` property:

```typescript
store: { attribute: false },
```

- [ ] **Step 2: Add unread dot to renderContent**

In `renderContent()` (lines 119-136), after the status dot, add an unread indicator:

```typescript
const hasUnread = this.store?.unreadAgents?.has(agent.name) ?? false;
```

Add in the card HTML:

```html
${hasUnread ? html`<span class="unread-dot"></span>` : nothing}
```

- [ ] **Step 3: Add CSS for unread dot**

```css
.unread-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	background: #f59e0b;
	position: absolute;
	top: 2px;
	right: 2px;
}

.card {
	position: relative;
}
```

- [ ] **Step 4: Wire store to roster bar in engine**

In `engine.ts`, where the roster bar is created, pass the store. Search for where `ft-game-roster-bar` is mounted and add `.store="${store}"`.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/roster-bar.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(roster): unread dot indicator for task completion"
```

---

## Phase E: Engine Wiring

### Task 7: Wire brain locking + talk engine to task lifecycle

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`

- [ ] **Step 1: Listen for task-assigned event**

Add listener in the engine's store event section:

```typescript
store.addEventListener("task-assigned", ((e: CustomEvent) => {
	const { agentName } = e.detail;
	brainSystem.assignWork(agentName);
	talkEngine.activate(agentName);
}) as EventListener);
```

- [ ] **Step 2: Listen for task-completed event**

```typescript
store.addEventListener("task-completed", ((e: CustomEvent) => {
	const { agentName, result } = e.detail;
	brainSystem.releaseWork(agentName);
	talkEngine.silence(agentName);
	// Show completion bubble
	bubbleSystem.showBubble(agentName, "speech", result.slice(0, 80), engine.currentScene, findAgentActor, 5000);
}) as EventListener);
```

- [ ] **Step 3: Run full Plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`

Expected: All ~8,200 tests pass.

- [ ] **Step 4: Build both projects**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

Expected: Both build cleanly.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): wire brain locking + talk engine to task lifecycle events"
```

---

## Verification

- [ ] **Full CLI test suite**: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts` — all pass
- [ ] **Full Plugin test suite**: `cd "01 - Projects/Flowti Plugin" && npx vitest run` — all pass
- [ ] **CLI build**: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs` — clean
- [ ] **Plugin build**: `cd "01 - Projects/Flowti Plugin" && npm run build` — clean
