# Actionable Agent Tasks Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tasks on the agent detail page selectable with Open (dispatch), Done (mark complete), and Remove (delete) actions.

**Architecture:** Add `removeTask` pure function to agent-state.ts. Modify the agent-detail view handler in extensibility-handlers.ts to inject task menu items before the action items. Each task item navigates to an inline sub-menu with 3 actions. Remove inline task rendering from agents-display.ts since tasks are now menu items.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-actionable-agent-tasks-design.md`

---

## File Structure

### Modified files (4)

| File | Change |
|------|--------|
| `src/domain/agents/agent-state.ts` | Add `removeTask()` pure function |
| `src/ui/handlers/extensibility-handlers.ts` | Inject task menu items into agent-detail view, add task sub-menu handler |
| `src/ui/displays/agents-display.ts` | Remove task list rendering from `renderAgentState` |
| `configs/sitemap.json` | No changes needed — tasks injected programmatically in view handler |

---

## Chunk 1: Actionable Tasks

### Task 1: Add `removeTask` to agent-state.ts

**Files:**
- Modify: `src/domain/agents/agent-state.ts`
- Modify: `tests/domain/agents/agent-state.test.ts`

- [x] **Step 1: Write tests**

Add to `tests/domain/agents/agent-state.test.ts`:

```typescript
describe("removeTask", () => {
	it("removes first non-done match by name", () => {
		const state: AgentState = {
			name: "Dev", status: "busy",
			tasks: [
				{ name: "Build", assignedAt: "t1", status: "pending" },
				{ name: "Build", assignedAt: "t2", status: "pending" },
			],
			briefs: [],
		};
		const result = removeTask(state, "Build");
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].assignedAt).toBe("t2");
	});

	it("leaves done tasks with same name", () => {
		const state: AgentState = {
			name: "Dev", status: "idle",
			tasks: [
				{ name: "Build", assignedAt: "t1", status: "done" },
				{ name: "Build", assignedAt: "t2", status: "pending" },
			],
			briefs: [],
		};
		const result = removeTask(state, "Build");
		expect(result.tasks).toHaveLength(1);
		expect(result.tasks[0].status).toBe("done");
	});

	it("returns state unchanged when no non-done match", () => {
		const state: AgentState = {
			name: "Dev", status: "idle",
			tasks: [{ name: "Build", assignedAt: "t1", status: "done" }],
			briefs: [],
		};
		const result = removeTask(state, "Build");
		expect(result).toEqual(state);
	});

	it("returns state unchanged when no match at all", () => {
		const state: AgentState = {
			name: "Dev", status: "idle",
			tasks: [{ name: "Test", assignedAt: "t1", status: "pending" }],
			briefs: [],
		};
		const result = removeTask(state, "Build");
		expect(result).toEqual(state);
	});
});
```

Import `removeTask` at the top of the test file.

- [x] **Step 2: Run tests — expect FAIL**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [x] **Step 3: Implement `removeTask`**

Add to `src/domain/agents/agent-state.ts` after `completeFirstTask`:

```typescript
/** Remove the first non-done task matching the name. */
export function removeTask(state: AgentState, taskName: string): AgentState {
	const idx = state.tasks.findIndex((t) => t.name === taskName && t.status !== "done");
	if (idx === -1) return state;
	const tasks = [...state.tasks];
	tasks.splice(idx, 1);
	return { ...state, tasks };
}
```

- [x] **Step 4: Run tests — expect PASS**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-state.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-state.test.ts"
git commit -m "feat: add removeTask to agent-state"
```

### Task 2: Remove inline task rendering from agents-display.ts

**Files:**
- Modify: `src/ui/displays/agents-display.ts`
- Modify: `tests/ui/displays/agents-display.test.ts`

- [x] **Step 1: Update `renderAgentState`**

Read `src/ui/displays/agents-display.ts`. Find `renderAgentState` (line ~93). Remove the task rendering block (lines ~101-109). Keep the state/interaction/briefs display. The function should become:

```typescript
export function renderAgentState(state: AgentState, log: (msg?: string) => void): void {
	const color = STATUS_COLORS[state.status] ?? DIM;
	log(`\n  ${BOLD}State${RESET}  ${color}${state.status}${RESET}`);
	if (state.lastInteraction) {
		const when = state.lastInteraction.slice(0, 10);
		const what = state.lastInteractionType ?? "unknown";
		log(`  ${DIM}Last interaction:${RESET} ${what} (${when})`);
	}
	if (state.briefs.length > 0) {
		log(`  ${DIM}Briefs generated: ${state.briefs.length}${RESET}`);
	}
}
```

- [x] **Step 2: Update tests if needed**

Read `tests/ui/displays/agents-display.test.ts`. If there are tests for task rendering in `renderAgentState`, remove or update them since tasks are no longer rendered there.

- [x] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/displays/agents-display.test.ts --config configs/vitest.config.ts`

- [x] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/displays/agents-display.ts" "01 - Projects/Flowti CLI/tests/ui/displays/agents-display.test.ts"
git commit -m "refactor: remove inline task rendering from renderAgentState"
```

### Task 3: Add task menu items and sub-menu to agent-detail view

**Files:**
- Modify: `src/ui/handlers/extensibility-handlers.ts`

- [x] **Step 1: Add task menu builder helper**

Read `src/ui/handlers/extensibility-handlers.ts`. Find the `agent-detail` view handler (line ~263). Add a helper function before `registerExtensibilityHandlers`:

```typescript
function buildTaskMenuItems(
	state: import("../../domain/agents/agent-state.js").AgentState,
	agent: import("../../domain/agents/agent-types.js").AgentSummary,
	ctx: RouterContext,
): MenuEntry[] {
	const pending = state.tasks.filter((t) => t.status !== "done");
	if (pending.length === 0) return [];
	const { YELLOW, DIM, RESET } = { YELLOW, DIM, RESET };
	const items: MenuEntry[] = [{ separator: true } as MenuEntry];
	for (let i = 0; i < pending.length; i++) {
		const task = pending[i];
		const statusColor = task.status === "in-progress" ? YELLOW : DIM;
		items.push({
			key: `t${i + 1}`,
			label: `${task.name} ${statusColor}[${task.status}]${RESET}`,
			group: "tasks",
			action: () => navigateWithParams("agent-task-action", { agentName: agent.name, taskName: task.name }) as MenuResult,
		});
	}
	return items;
}
```

Wait — `navigateWithParams` navigates to a page, but we don't want a new sitemap page. Instead, the action should show an inline sub-menu. Use a direct handler:

```typescript
function buildTaskMenuItems(
	state: import("../../domain/agents/agent-state.js").AgentState,
	agent: import("../../domain/agents/agent-types.js").AgentSummary,
	ctx: RouterContext,
): MenuEntry[] {
	const pending = state.tasks.filter((t) => t.status !== "done");
	if (pending.length === 0) return [];
	return pending.map((task, i) => ({
		key: `t${i + 1}`,
		label: `${task.name} ${DIM}[${task.status}]${RESET}`,
		group: "tasks",
		action: () => showTaskActions(agent, task.name, ctx),
	}));
}
```

- [x] **Step 2: Add task action sub-menu**

Add a helper function:

```typescript
async function showTaskActions(
	agent: import("../../domain/agents/agent-types.js").AgentSummary,
	taskName: string, ctx: RouterContext,
): Promise<MenuResult> {
	const { runMenu } = await import("../../infrastructure/menu.js");
	const { readAgentState, writeAgentState, completeFirstTask, removeTask } = await import("../../domain/agents/agent-state.js");

	const items: MenuEntry[] = [
		{ key: "1", label: "Open — dispatch agent with this task", action: async () => {
			await openTask(agent, taskName, ctx);
			return undefined;
		}},
		{ key: "2", label: "Done — mark as completed", action: async () => {
			const dir = varDir(ctx);
			let state = readAgentState(ctx.deps, dir, agent.name);
			state = completeFirstTask(state, taskName);
			writeAgentState(ctx.deps, dir, agent.name, state);
			ctx.deps.log(`\n  ${GREEN}✓${RESET} Task "${taskName}" marked done.\n`);
			return undefined;
		}},
		{ key: "3", label: "Remove — delete from task list", action: async () => {
			const dir = varDir(ctx);
			let state = readAgentState(ctx.deps, dir, agent.name);
			state = removeTask(state, taskName);
			writeAgentState(ctx.deps, dir, agent.name, state);
			ctx.deps.log(`\n  ${GREEN}✓${RESET} Task "${taskName}" removed.\n`);
			return undefined;
		}},
	];

	ctx.deps.log(`\n  ${BOLD}Task:${RESET} ${taskName}\n`);
	return runMenu(null, items);
}
```

- [x] **Step 3: Add `openTask` helper**

```typescript
async function openTask(
	agent: import("../../domain/agents/agent-types.js").AgentSummary,
	taskName: string, ctx: RouterContext,
): Promise<void> {
	const { readSystemPrompt } = await import("../../domain/agents/agent-store.js");
	const { buildConversationPrompt } = await import("../../domain/agents/agent-conversation.js");

	// Try to find existing brief
	let briefPath: string | null = null;
	if (ctx.project) {
		try {
			const { findCurrentIteration, iterationsDir } = await import("../../domain/iterations/iteration-store.js");
			const iterCfg = ctx.project.config.management?.iterations;
			const iteration = findCurrentIteration(ctx.deps, ctx.project.path, iterCfg);
			if (iteration) {
				const dir = iterationsDir(ctx.deps, ctx.project.path, iterCfg);
				const briefDir = ctx.deps.paths.join(dir, "briefs");
				if (ctx.deps.disk.existsSync(briefDir)) {
					const files = ctx.deps.disk.readdirSync(briefDir);
					const slug = agent.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
					const match = files.find((f) => f.includes(slug) && f.includes(iteration.status));
					if (match) briefPath = ctx.deps.paths.join(briefDir, match);
				}
			}
		} catch { /* no iteration context */ }
	}

	// If no brief, build a fresh prompt
	if (!briefPath) {
		const systemPrompt = readSystemPrompt(ctx.deps, VAULT_ROOT, agent.name, vaultAgents);
		const character = { description: agent.description, persona: agent.persona, mood: agent.mood, personality: agent.personality, attributes: agent.attributes, experience: agent.experience };
		const prompt = buildConversationPrompt(agent.name, systemPrompt, [], taskName, character);
		const tempPath = ctx.deps.paths.join(ctx.deps.paths.resolve("."), `.flowti-task-${ctx.deps.clock.ms()}.tmp`);
		ctx.deps.disk.writeFileSync(tempPath, prompt, "utf-8");
		briefPath = tempPath;
	}

	ctx.deps.agentShell.dispatch(agent, briefPath, taskName);
	const who = agent.persona ?? agent.name;
	ctx.deps.log(`\n  ${GREEN}✓${RESET} ${who} is working on: ${taskName}\n`);
}
```

Note: `vaultAgents` is a closure variable in `registerExtensibilityHandlers`. Both `showTaskActions` and `openTask` must be defined INSIDE `registerExtensibilityHandlers` to access it, or accept it as a parameter.

- [x] **Step 4: Inject task items into agent-detail view**

Update the agent-detail view handler. Change the menu items line from:

```typescript
return runMenu(null, [...(ctx.dataSourceEntries?.["_actions"] ?? [])], {
```

To:

```typescript
const taskItems = buildTaskMenuItems(state, agent, ctx);
const actions = [...(ctx.dataSourceEntries?.["_actions"] ?? [])];
return runMenu(null, [...taskItems, ...actions], {
```

- [x] **Step 5: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [x] **Step 6: Verify lint (complexity check)**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ui/handlers/extensibility-handlers.ts --config configs/eslint.config.mjs`

If `extensibility-handlers.ts` exceeds 350 lines, extract `showTaskActions` and `openTask` into a new file `src/ui/handlers/agent-task-handlers.ts`.

- [x] **Step 7: Run full tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [x] **Step 8: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [x] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/handlers/extensibility-handlers.ts"
git commit -m "feat: actionable tasks on agent detail page with Open/Done/Remove"
```

### Task 4: Full verification

- [x] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npm test`

- [x] **Step 2: Manual smoke test**

Run `.\flowti.cmd`:
- Navigate to an agent with pending tasks
- Verify tasks appear as `t1)`, `t2)` items in their own group
- Select a task → see Open/Done/Remove sub-menu
- Test Done → task disappears from list
- Test Remove → task disappears entirely
- Test Open → agent dispatches with the task
