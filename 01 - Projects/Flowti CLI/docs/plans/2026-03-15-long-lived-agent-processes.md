# Long-Lived Agent Processes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make dispatched agents notification-driven — they can ask questions, the user answers via `!` key from any menu, and the agent continues.

**Architecture:** The dispatch completion handler gains response-status awareness: "question" responses push to a notification queue and set agent state to "waiting". `answerAgent()` respawns the process with conversation history + answer. A status bar in `runMenu` shows pending questions with `!` key to respond.

**Tech Stack:** TypeScript, Node.js built-ins, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-long-lived-agent-processes-design.md`

---

## File Structure

### New files (2)

| File | Responsibility |
|------|---------------|
| `src/ui/displays/status-bar-display.ts` | `renderStatusBar()` — ANSI rendering of agent notification bar |
| `tests/ui/displays/status-bar-display.test.ts` | Tests for status bar rendering |

### Modified files (7)

| File | Change |
|------|--------|
| `src/domain/agents/agent-state.ts` | Add `"waiting"` to status, add `pendingQuestion` field, update `recordInteraction`/`completeTask`/`completeFirstTask` guards |
| `src/infrastructure/types.ts` | Add `PendingQuestion` interface, add `pendingQuestions()`/`answerAgent()` to `IAgentShell`, add `onAgentQuestion` to `MenuOptions` |
| `src/infrastructure/agent-shell.ts` | Notification queue, `pendingQuestions()`, `answerAgent()`, dispatch completion handler question-awareness |
| `src/infrastructure/menu.ts` | Handle `!` key, render status bar via `beforeMenu` |
| `src/infrastructure/sitemap-router.ts` | Wire `onAgentQuestion` callback when calling `runMenu` |
| `src/ui/handlers/register-handlers.ts` | Show `"waiting"` agents in start view, wire status bar |
| `tests/infrastructure/agent-shell.test.ts` | Tests for notification queue, pendingQuestions, answerAgent |

---

## Chunk 1: Domain — "waiting" Status + State Guards

### Task 1: Add "waiting" status and pendingQuestion to agent-state.ts

**Files:**
- Modify: `src/domain/agents/agent-state.ts`
- Modify: `tests/domain/agents/agent-state.test.ts`

- [ ] **Step 1: Update AgentState interface**

Add `"waiting"` to status and `pendingQuestion` field:

```typescript
export interface AgentPendingQuestion {
	readonly question: string;
	readonly briefPath: string;
	readonly task: string;
	readonly iterDir?: string;
	readonly iterationNumber?: number;
}

export interface AgentState {
	readonly name: string;
	readonly status: "idle" | "active" | "busy" | "waiting";
	readonly lastInteraction?: string;
	readonly lastInteractionType?: AgentInteractionType;
	readonly tasks: readonly AgentTask[];
	readonly briefs: readonly AgentBriefRef[];
	readonly pendingQuestion?: AgentPendingQuestion;
}
```

- [ ] **Step 2: Update readAgentState to parse pendingQuestion**

In `readAgentState`, add to the return object:

```typescript
pendingQuestion: raw.pendingQuestion as AgentPendingQuestion | undefined,
```

Use `as unknown as Partial<AgentState>` for the raw cast since the type changed.

- [ ] **Step 3: Update state transition guards**

Update `recordInteraction` to preserve `"waiting"`:

```typescript
export function recordInteraction(state: AgentState, type: AgentInteractionType, timestamp: string): AgentState {
	return { ...state, lastInteraction: timestamp, lastInteractionType: type, status: (state.status === "busy" || state.status === "waiting") ? state.status : "active" };
}
```

Update `completeTask` to not override `"waiting"`:

```typescript
return { ...state, tasks, status: allDone && state.status !== "waiting" ? "idle" : state.status };
```

Update `completeFirstTask` the same way:

```typescript
return { ...state, tasks, status: allDone && state.status !== "waiting" ? "idle" : state.status };
```

- [ ] **Step 4: Write tests**

Add to `tests/domain/agents/agent-state.test.ts`:

```typescript
describe("waiting status", () => {
	it("recordInteraction preserves waiting status", () => {
		const state: AgentState = { name: "Dev", status: "waiting", tasks: [], briefs: [] };
		const result = recordInteraction(state, "talk", "2026-01-01");
		expect(result.status).toBe("waiting");
	});

	it("completeFirstTask does not override waiting to idle", () => {
		const state: AgentState = {
			name: "Dev", status: "waiting",
			tasks: [{ name: "Build", assignedAt: "t1", status: "pending" }],
			briefs: [],
		};
		const result = completeFirstTask(state, "Build");
		expect(result.status).toBe("waiting");
	});

	it("completeTask does not override waiting to idle", () => {
		const state: AgentState = {
			name: "Dev", status: "waiting",
			tasks: [{ name: "Build", assignedAt: "t1", status: "pending" }],
			briefs: [],
		};
		const result = completeTask(state, "Build");
		expect(result.status).toBe("waiting");
	});

	it("readAgentState parses pendingQuestion field", () => {
		// Mock disk to return state JSON with pendingQuestion
		// Verify the returned state has pendingQuestion populated
	});
});
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-state.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-state.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-state.test.ts"
git commit -m "feat: add waiting status and pendingQuestion to agent state"
```

---

## Chunk 2: Shell — Notification Queue + Answer Flow

### Task 2: Add types to IAgentShell and MenuOptions

**Files:**
- Modify: `src/infrastructure/types.ts`

- [ ] **Step 1: Add PendingQuestion interface**

After `DispatchHandle`, add:

```typescript
export interface PendingQuestion {
	readonly agentName: string;
	readonly persona?: string;
	readonly question: string;
	readonly agent: import("../domain/agents/agent-types.js").AgentSummary;
	readonly briefPath: string;
	readonly task: string;
	readonly opts?: DispatchOptions;
}
```

- [ ] **Step 2: Add methods to IAgentShell**

```typescript
export interface IAgentShell {
	talk(...): TalkSession;
	dispatch(...): DispatchHandle;
	getActiveDispatch(agentName: string): DispatchHandle | null;
	reconcileStaleAgents(): { recovered: string[] };
	pendingQuestions(): PendingQuestion[];
	answerAgent(agentName: string, answer: string): void;
}
```

- [ ] **Step 3: Add onAgentQuestion to MenuOptions**

Find `MenuOptions` interface and add:

```typescript
export interface MenuOptions {
	defaultChoice?: string;
	onAgentQuestion?: () => Promise<MenuResult | undefined>;
	renderStatusBar?: () => void;
}
```

- [ ] **Step 4: Verify type-check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: FAIL — shell doesn't implement new methods yet.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/types.ts"
git commit -m "feat: add PendingQuestion, pendingQuestions, answerAgent to IAgentShell"
```

### Task 3: Implement notification queue, pendingQuestions, answerAgent in agent-shell.ts

**Files:**
- Modify: `src/infrastructure/agent-shell.ts`
- Modify: `tests/infrastructure/agent-shell.test.ts`

- [ ] **Step 1: Add imports for conversation support**

Add to imports in agent-shell.ts:

```typescript
import { buildConversationPrompt } from "../domain/agents/agent-conversation.js";
import type { AgentCharacter } from "../domain/agents/agent-conversation.js";
import { readSystemPrompt } from "../domain/agents/agent-store.js";
```

Also import `PendingQuestion` from types:

```typescript
import type { IAgentShell, ProviderConfig, TalkSession, TalkResult, TalkOptions, DispatchHandle, DispatchOptions, PendingQuestion } from "./types.js";
```

And import `AgentPendingQuestion` from agent-state:

```typescript
import { readAgentState, writeAgentState, completeFirstTask } from "../domain/agents/agent-state.js";
import type { AgentPendingQuestion } from "../domain/agents/agent-state.js";
```

- [ ] **Step 2: Add notification queue inside createAgentShell**

After the `failureCounts` map declaration:

```typescript
const pendingNotifications = new Map<string, PendingQuestion>();
```

- [ ] **Step 3: Update dispatch completion handler for question awareness**

In the dispatch completion handler (inside `exitPromise.then()`), after parsing the response and writing the inbox note, replace the task-completion logic with status-aware branching:

```typescript
const response = parseAgentResponse(accumulated);

if (response.status === "question") {
	// Agent needs input — enter waiting state
	const pq: AgentPendingQuestion = { question: response.message, briefPath, task, iterDir: opts?.iterDir, iterationNumber: opts?.iterationNumber };
	const state = readAgentState(deps, varDir, agent.name);
	writeAgentState(deps, varDir, agent.name, { ...state, status: "waiting", pendingQuestion: pq });
	pendingNotifications.set(agent.name, { agentName: agent.name, persona: agent.persona, question: response.message, agent, briefPath, task, opts });
	writeSystemInboxNote(deps, vaultRoot, agent.name, `Question: ${response.message}`);
	activeDispatches.delete(agent.name);
	return;
}

// status is "message", "ready", or "error" — complete the task
let state = readAgentState(deps, varDir, agent.name);
state = completeFirstTask(state, task);
// Clear any pending question from a previous cycle
state = { ...state, pendingQuestion: undefined };
writeAgentState(deps, varDir, agent.name, state);
// ... existing auto-dequeue logic continues here
```

Note: integrate this BEFORE the existing auto-dequeue logic. The auto-dequeue only runs when the status is NOT "question".

- [ ] **Step 4: Implement pendingQuestions()**

Add to the shell object:

```typescript
pendingQuestions(): PendingQuestion[] {
	// In-memory queue first
	const result = [...pendingNotifications.values()];
	// Also check state files for questions from previous CLI sessions
	if (deps.disk.existsSync(varDir)) {
		const files = deps.disk.readdirSync(varDir).filter((f) => f.startsWith("data-") && f.endsWith(".json"));
		for (const file of files) {
			try {
				const content = deps.disk.readFileSync(deps.paths.join(varDir, file), "utf-8");
				const raw = JSON.parse(content) as { name?: string; status?: string; pendingQuestion?: AgentPendingQuestion };
				if (raw.status === "waiting" && raw.name && raw.pendingQuestion && !pendingNotifications.has(raw.name)) {
					result.push({
						agentName: raw.name,
						question: raw.pendingQuestion.question,
						briefPath: raw.pendingQuestion.briefPath,
						task: raw.pendingQuestion.task,
						agent: { name: raw.name, agentType: "ai", description: "", skills: [], tools: [], roles: [], file: "" } as import("../domain/agents/agent-types.js").AgentSummary,
						opts: raw.pendingQuestion.iterDir ? { iterDir: raw.pendingQuestion.iterDir, iterationNumber: raw.pendingQuestion.iterationNumber } : undefined,
					});
				}
			} catch { /* corrupt file */ }
		}
	}
	return result;
},
```

Note: for cold-start questions (from previous sessions), we create a minimal `AgentSummary`. The `answerAgent` method will resolve the full agent via `findAgent()` before dispatching.

- [ ] **Step 5: Implement answerAgent()**

Add to the shell object:

```typescript
answerAgent(agentName: string, answer: string): void {
	const pending = pendingNotifications.get(agentName);
	// Also check state for cold-start questions
	const state = readAgentState(deps, varDir, agentName);
	if (state.status !== "waiting") return;

	const question = pending?.question ?? state.pendingQuestion?.question ?? "";
	const briefPath = pending?.briefPath ?? state.pendingQuestion?.briefPath ?? "";
	const task = pending?.task ?? state.pendingQuestion?.task ?? "";
	const dispatchOpts = pending?.opts ?? (state.pendingQuestion?.iterDir ? { iterDir: state.pendingQuestion.iterDir, iterationNumber: state.pendingQuestion.iterationNumber } : undefined);

	// Resolve full agent if we only have a cold-start stub
	let agentSummary = pending?.agent;
	if (!agentSummary || !agentSummary.file) {
		try {
			const { findAgent } = require("../domain/agents/agent-store.js") as typeof import("../domain/agents/agent-store.js");
			const found = findAgent(deps, vaultRoot, agentName);
			if (found) agentSummary = found;
		} catch { /* best-effort */ }
	}
	if (!agentSummary) return;

	// Build respawn prompt with conversation history
	const systemPrompt = readSystemPrompt(deps, vaultRoot, agentName);
	const character: AgentCharacter = {
		description: agentSummary.description, persona: agentSummary.persona,
		mood: agentSummary.mood, personality: agentSummary.personality,
		attributes: agentSummary.attributes, experience: agentSummary.experience,
	};
	const history = [
		{ role: "agent" as const, content: question },
		{ role: "user" as const, content: answer },
	];
	const prompt = buildConversationPrompt(agentName, systemPrompt, history, answer, character);

	// Write prompt to temp file and re-dispatch
	const tempPath = deps.paths.join(deps.paths.resolve("."), `.flowti-answer-${deps.clock.ms()}-${++idCounter}.tmp`);
	deps.disk.writeFileSync(tempPath, prompt, "utf-8");

	// Clear waiting state
	pendingNotifications.delete(agentName);
	const updated = { ...state, status: "busy" as const, pendingQuestion: undefined };
	writeAgentState(deps, varDir, agentName, updated);

	// Re-dispatch
	shell.dispatch(agentSummary, tempPath, task, dispatchOpts);
},
```

Note: uses `require()` for `findAgent` to avoid circular import issues in the synchronous path. This is a best-effort resolution — if it fails, the cold-start answer is silently dropped.

Actually, use dynamic import instead:

```typescript
// Replace the require() block with:
import("../domain/agents/agent-store.js").then(({ findAgent }) => {
```

Wait — `answerAgent` is synchronous. We need a sync resolution. The simplest fix: accept `AgentSummary | undefined` and have the caller (the `!` handler in sitemap-router) resolve the agent before calling `answerAgent`. But the spec says `answerAgent(agentName, answer)`.

Better approach: store the agent file path in `PendingQuestion` so we can load the agent definition synchronously via `readFileSync` + frontmatter parsing. But that's complex.

Simplest approach that works: change `answerAgent` to async:

```typescript
async answerAgent(agentName: string, answer: string): Promise<void> {
```

And update `IAgentShell`:

```typescript
answerAgent(agentName: string, answer: string): Promise<void>;
```

This lets us use `await import(...)` for `findAgent`.

- [ ] **Step 6: Update reconcileStaleAgents to skip "waiting"**

In `reconcileStaleAgents`, add before the stale check:

```typescript
if (raw.status === "waiting") continue;
```

- [ ] **Step 7: Update dispatch to clear existing notification**

At the top of `dispatch()`, after the existing stop-prior-dispatch check:

```typescript
pendingNotifications.delete(agent.name);
```

- [ ] **Step 8: Write tests**

Add to `tests/infrastructure/agent-shell.test.ts`:

```typescript
describe("notification queue", () => {
	it("pendingQuestions returns empty when no waiting agents", () => {
		const shell = createAgentShell(deps, undefined, "/vault");
		expect(shell.pendingQuestions()).toEqual([]);
	});

	it("reconcileStaleAgents skips waiting agents", () => {
		// Write a data-dev.json with status: "waiting"
		// Call reconcileStaleAgents
		// Verify state is still "waiting"
	});
});
```

Note: Full async dispatch-question-notification tests are complex due to process mocking. Write structural tests for the synchronous methods and edge cases.

- [ ] **Step 9: Verify type-check + tests**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/agent-shell.test.ts --config configs/vitest.config.ts`

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/agent-shell.ts" "01 - Projects/Flowti CLI/src/infrastructure/types.ts" "01 - Projects/Flowti CLI/tests/infrastructure/agent-shell.test.ts"
git commit -m "feat: notification queue with pendingQuestions and answerAgent"
```

---

## Chunk 3: UI — Status Bar + `!` Key + Start View

### Task 4: Create status-bar-display.ts

**Files:**
- Create: `src/ui/displays/status-bar-display.ts`
- Create: `tests/ui/displays/status-bar-display.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { renderStatusBar } from "../../../src/ui/displays/status-bar-display.js";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", DIM: "", YELLOW: "", CYAN: "", BOLD: "",
}));

describe("renderStatusBar", () => {
	it("does not render when no questions", () => {
		const log = vi.fn();
		renderStatusBar([], log);
		expect(log).not.toHaveBeenCalled();
	});

	it("renders single agent question", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Bob", persona: "Bobby", question: "What framework?", agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Bobby"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("What framework?"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("!"));
	});

	it("renders count badge for multiple agents", () => {
		const log = vi.fn();
		const questions = [
			{ agentName: "Bob", persona: "Bobby", question: "Q1?", agent: {} as never, briefPath: "", task: "" },
			{ agentName: "Dev", question: "Q2?", agent: {} as never, briefPath: "", task: "" },
		];
		renderStatusBar(questions, log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("2"));
	});

	it("truncates long question text", () => {
		const log = vi.fn();
		const longQ = "A".repeat(100);
		renderStatusBar([{ agentName: "Bob", question: longQ, agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("..."));
	});

	it("uses agentName when no persona", () => {
		const log = vi.fn();
		renderStatusBar([{ agentName: "Dev", question: "Q?", agent: {} as never, briefPath: "", task: "" }], log);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Dev"));
	});
});
```

- [ ] **Step 2: Implement renderStatusBar**

```typescript
import { RESET, DIM, YELLOW, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { PendingQuestion } from "../../infrastructure/types.js";

export function renderStatusBar(questions: PendingQuestion[], log: (msg?: string) => void): void {
	if (questions.length === 0) return;
	const oldest = questions[0];
	const who = oldest.persona ?? oldest.agentName;
	const preview = oldest.question.length > 60 ? oldest.question.slice(0, 57) + "..." : oldest.question;
	const badge = questions.length > 1 ? `${YELLOW}${questions.length} agents waiting${RESET} — ` : "";
	log(`  ${YELLOW}⚡${RESET} ${badge}${CYAN}${BOLD}${who}${RESET}${DIM}: ${preview}  ${YELLOW}[! to respond]${RESET}`);
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/displays/status-bar-display.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/displays/status-bar-display.ts" "01 - Projects/Flowti CLI/tests/ui/displays/status-bar-display.test.ts"
git commit -m "feat: add status bar display for agent notifications"
```

### Task 5: Wire `!` key in menu.ts and onAgentQuestion in sitemap-router.ts

**Files:**
- Modify: `src/infrastructure/menu.ts`
- Modify: `src/infrastructure/sitemap-router.ts`

- [ ] **Step 1: Add `!` key handling to runMenu**

After the `if (choice === "*")` line, add:

```typescript
if (choice === "!" && options.onAgentQuestion) {
	const result = await options.onAgentQuestion();
	if (result) return result;
	continue;
}
```

Also add status bar rendering. In the `beforeMenu` block, after it runs, add:

```typescript
if (options.renderStatusBar) options.renderStatusBar();
```

- [ ] **Step 2: Wire onAgentQuestion in sitemap-router.ts**

Find where `runMenu` is called in the router (both `#runStaticPage` and `#runDynamicPage`). Add the `onAgentQuestion` callback to the options. The router has access to `this.#deps` which contains `agentShell` and `input`.

```typescript
const menuOptions = {
	// ... existing options
	onAgentQuestion: async () => {
		const questions = this.#deps.agentShell.pendingQuestions();
		if (questions.length === 0) return undefined;
		const oldest = questions[0];
		const who = oldest.persona ?? oldest.agentName;
		const { CYAN, BOLD, RESET, DIM } = await import("./ui.js");
		this.#deps.log(`\n  ${CYAN}${BOLD}${who}${RESET} asks:`);
		this.#deps.log(`    ${oldest.question}\n`);
		const answer = await this.#deps.input.ask(`  ${BOLD}Your answer${RESET}`);
		if (answer) await this.#deps.agentShell.answerAgent(oldest.agentName, answer);
		return "refresh" as MenuResult;
	},
	renderStatusBar: () => {
		const { renderStatusBar } = require("../ui/displays/status-bar-display.js") as typeof import("../ui/displays/status-bar-display.js");
		renderStatusBar(this.#deps.agentShell.pendingQuestions(), this.#deps.log);
	},
};
```

Note: Use dynamic import or require for `renderStatusBar` to avoid circular dependencies between infrastructure and UI. Since `sitemap-router.ts` is infrastructure and `status-bar-display.ts` is UI, this follows the existing pattern (the router already dynamically imports UI modules).

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/menu.test.ts tests/infrastructure/sitemap-router.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/menu.ts" "01 - Projects/Flowti CLI/src/infrastructure/sitemap-router.ts"
git commit -m "feat: wire ! key for agent questions and status bar in menu"
```

### Task 6: Update start view to show waiting agents

**Files:**
- Modify: `src/ui/handlers/register-handlers.ts`

- [ ] **Step 1: Update parseAgentStates to include "waiting"**

Change the status filter to include "waiting":

```typescript
if (state.status === "busy" || state.status === "waiting") {
```

- [ ] **Step 2: Update renderBusyAgents to show question for waiting agents**

In the rendering loop, add question display for waiting agents:

```typescript
const statusTag = a.status === "busy" ? `${YELLOW}working${RESET}` : `${CYAN}waiting${RESET}`;
const taskInfo = a.status === "waiting" && a.question
	? ` — ${a.question}`
	: a.task ? ` — ${a.task}` : a.lastType ? ` — last: ${a.lastType}` : "";
```

Update the `WorkingAgent` interface to include `question?`:

```typescript
interface WorkingAgent { name: string; persona?: string; status: string; task?: string; lastType?: string; question?: string; }
```

In `parseAgentStates`, read the pending question:

```typescript
const pq = state.pendingQuestion as { question?: string } | undefined;
working.push({ ..., question: pq?.question });
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/handlers/register-handlers.test.ts --config configs/vitest.config.ts`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/handlers/register-handlers.ts"
git commit -m "feat: show waiting agents with pending questions in start view"
```

### Task 7: Full verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

- [ ] **Step 2: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

- [ ] **Step 5: Manual smoke test**

Run `.\flowti.cmd` and verify:
- Assign a task to an AI agent via roster menu
- Agent dispatches and works
- If agent responds with a question → status bar appears on next menu render
- Type `!` and Enter → question displays, user types answer
- Agent re-dispatches with the answer
- Press `*` to refresh and see updated agent status
- Kill CLI while agent is waiting → restart → question reappears in status bar
