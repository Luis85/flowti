# Autonomy Bridge Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect BT actions to CLI workers so agents can do real work — brain decides execution mode, LLM sessions are acquired on selection or on-demand, and CLI execution events drive brain state.

**Architecture:** Extend the existing JSONL subprocess protocol with 3 new message types (`agent-selected`, `agent-deselected`, `bt-action`). Plugin forwards BT actions via the engine composition layer. CLI dispatches to the worker manager which handles session lifecycle and trust-tier-based execution mode. CLI events flow back via existing stdout JSONL and new `CustomEvent` wiring in the Plugin store/engine.

**Tech Stack:** TypeScript, Node.js (CLI), Lit/ExcaliburJS (Plugin), Vitest

**Spec:** `docs/specs/2026-03-22-autonomy-bridge-design.md`

---

## File Map

### CLI (`01 - Projects/Flowti CLI/`)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/domain/agents/agent-process-loop.ts:185-290` | Add 3 new stdin message types, dispatch handlers |
| Modify | `src/infrastructure/worker-manager.ts:109-138,140-170` | Remove auto-prime from spawn, expose `primeWorker` via IWorkerManager |
| Modify | `src/domain/agents/worker-types.ts:68-77` | Add `prime` method to IWorkerManager |
| Modify | `tests/infrastructure/worker-manager.test.ts` | Update priming tests, add bt-action tests |
| Modify | `tests/domain/agents/agent-process-loop.test.ts` | Add tests for new message types |

### Plugin (`01 - Projects/Flowti Plugin/`)

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/infrastructure/agents/cli-executor-helpers.ts:41-51` | Add `sendRaw` to AgentProcess interface |
| Modify | `src/infrastructure/agents/cli-executor.ts:56-61` | Implement `sendRaw` |
| Modify | `src/game/store/dashboard-store.ts:554-577` | Add `forwardBtAction`, `selectAgent`, `deselectAgent`, dispatch `cli-brain-event` |
| Modify | `src/game/engine-simulation.ts` | Subscribe to `cli-brain-event`, forward BT actions |

---

## Chunk 1: CLI-Side Protocol Extension + Lazy Priming

### Task 1: Add new stdin message types to agent-process-loop

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts:185-290`
- Test: `01 - Projects/Flowti CLI/tests/domain/agents/agent-process-loop.test.ts`

- [ ] **Step 1: Add new message interfaces and update union type**

In `src/domain/agents/agent-process-loop.ts`, after `KillInput` (line 205), add:

```typescript
interface AgentSelectedInput {
	readonly type: "agent-selected";
}

interface AgentDeselectedInput {
	readonly type: "agent-deselected";
}

interface BtActionInput {
	readonly type: "bt-action";
	readonly action: string;
	readonly data: {
		readonly goal?: string;
		readonly goalType?: string;
		readonly context?: string;
		readonly task?: string;
	};
}
```

Update the `StdinMessage` union (line 207):

```typescript
type StdinMessage = MessageInput | StopGenerationInput | GrantPermissionInput | KillInput | AgentSelectedInput | AgentDeselectedInput | BtActionInput;
```

- [ ] **Step 2: Add handler functions**

After `handleGrantPermission` (line 274), add:

```typescript
function handleAgentSelected(deps: AgentProcessLoopDeps): void {
	const worker = deps.workerManager.getWorker(deps.agentName);
	if (worker && worker.state !== "stopped") {
		deps.workerManager.prime(deps.agentName);
	}
}

function handleAgentDeselected(deps: AgentProcessLoopDeps): void {
	deps.workerManager.stop(deps.agentName);
}

function handleBtAction(deps: AgentProcessLoopDeps, msg: BtActionInput): void {
	const { action, data } = msg;
	if (action === "goal-started" || action === "task-started") {
		const goalText = data.goal ?? data.task ?? "";
		const context = data.context ?? "";
		const fullMessage = context ? `${context}\n\n${goalText}` : goalText;
		let lastToolName = "";
		let lastToolEmitted = false;
		deps.workerManager.send(deps.agentName, fullMessage, {
			task: goalText,
			onEvent(event: AgentStreamEvent) {
				if (event.kind === "text") return;
				const type = mapStreamEventToType(event);
				const text = extractText(event);
				const meta = extractToolMeta(event);
				if (event.kind === "tool-start") {
					lastToolName = event.name;
					lastToolEmitted = false;
					return;
				}
				if (event.kind === "tool-input") {
					if (!lastToolEmitted) {
						const summary = summarizeToolInput(lastToolName, event.json);
						if (summary) {
							writeEvent(deps, "using-tool", summary, { tool: lastToolName });
							lastToolEmitted = true;
						}
					}
					return;
				}
				if (event.kind === "tool-end" && !lastToolEmitted) {
					writeEvent(deps, "using-tool", lastToolName, { tool: lastToolName });
				}
				writeEvent(deps, type, text, meta);
			},
			onResponse(response) {
				writeEvent(deps, "response", textFromWorkerResponsePayload(response));
			},
		});
	}
}
```

- [ ] **Step 3: Update dispatch switch**

In the `dispatch` function (line 276), add cases before the `"kill"` case:

```typescript
case "agent-selected":
	handleAgentSelected(deps);
	break;
case "agent-deselected":
	handleAgentDeselected(deps);
	break;
case "bt-action":
	handleBtAction(deps, msg as BtActionInput);
	break;
```

- [ ] **Step 4: Write tests for new message types**

In `tests/domain/agents/agent-process-loop.test.ts`, add tests:

```typescript
it("dispatches agent-selected to prime the worker", () => {
	const deps = makeDeps();
	const handle = createAgentProcessLoop(deps);
	handle.start();
	feedLine(deps, JSON.stringify({ type: "agent-selected" }));
	expect(deps.workerManager.prime).toHaveBeenCalledWith("TestAgent");
});

it("dispatches agent-deselected to stop the worker", () => {
	const deps = makeDeps();
	const handle = createAgentProcessLoop(deps);
	handle.start();
	feedLine(deps, JSON.stringify({ type: "agent-deselected" }));
	expect(deps.workerManager.stop).toHaveBeenCalledWith("TestAgent");
});

it("dispatches bt-action goal-started to worker send with task option", () => {
	const deps = makeDeps();
	const handle = createAgentProcessLoop(deps);
	handle.start();
	feedLine(deps, JSON.stringify({ type: "bt-action", action: "goal-started", data: { goal: "Write docs", context: "Project X" } }));
	expect(deps.workerManager.send).toHaveBeenCalledWith(
		"TestAgent",
		"Project X\n\nWrite docs",
		expect.objectContaining({ task: "Write docs" }),
	);
});

it("ignores bt-action with unrecognized action type", () => {
	const deps = makeDeps();
	const handle = createAgentProcessLoop(deps);
	handle.start();
	feedLine(deps, JSON.stringify({ type: "bt-action", action: "seek-food", data: {} }));
	expect(deps.workerManager.send).not.toHaveBeenCalled();
});
```

Note: the `makeDeps` mock must include `workerManager.prime` as a `vi.fn()`. Check the existing test file — if `prime` is not mocked, add it.

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/agent-process-loop.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts" "01 - Projects/Flowti CLI/tests/domain/agents/agent-process-loop.test.ts"
git commit -m "feat(bridge): add agent-selected, agent-deselected, bt-action JSONL message types"
```

---

### Task 2: Add `prime` method to IWorkerManager and make priming lazy

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts:68-77`
- Modify: `01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts:109-138`
- Modify: `01 - Projects/Flowti CLI/tests/infrastructure/worker-manager.test.ts`

- [ ] **Step 1: Add `prime` to IWorkerManager interface**

In `src/domain/agents/worker-types.ts`, add to the `IWorkerManager` interface (after `stop`):

```typescript
/** Acquire LLM session and prime the agent. Called on agent-selected or on-demand by brain. */
prime(agentName: string): void;
```

- [ ] **Step 2: Remove auto-prime from spawnWorker**

In `src/infrastructure/worker-manager.ts`, remove lines 133-135:

```typescript
// REMOVE:
if (agent.agentType === "ai") {
	primeWorker(worker);
}
```

- [ ] **Step 3: Expose `prime` in the returned manager object**

In the `return { ... }` block (after `stopAll`), add:

```typescript
prime(agentName: string): void {
	const worker = workers.get(agentName);
	if (!worker) return;
	if (worker.agent.agentType !== "ai") return;
	if (worker.session?.alive) return; // already primed
	primeWorker(worker);
},
```

- [ ] **Step 4: Update existing tests**

In `tests/infrastructure/worker-manager.test.ts`:

Replace "spawn primes AI agent with startup prompt via session":
```typescript
it("spawn does NOT prime AI agent automatically", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	// Give async a chance to run
	await new Promise((r) => setTimeout(r, 50));
	expect(session.send).not.toHaveBeenCalled();
});
```

Replace "reuses session for subsequent messages":
```typescript
it("prime then send reuses session", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession("Hi");
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.prime("Bob");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(1)); // priming
	mgr.send("Bob", "Hello");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(2));
	expect(runner.spawn).not.toHaveBeenCalled();
});
```

Add new test:
```typescript
it("prime acquires session and sends startup prompt", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.prime("Bob");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalled());
	const prompt = session.send.mock.calls[0][0] as string;
	expect(prompt).toContain("Bob");
});

it("prime is no-op when session already alive", async () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent()]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.prime("Bob");
	await vi.waitFor(() => expect(session.send).toHaveBeenCalledTimes(1));
	mgr.prime("Bob"); // second prime — should no-op
	await new Promise((r) => setTimeout(r, 50));
	expect(session.send).toHaveBeenCalledTimes(1); // still 1
});

it("prime is no-op for NPC agents", () => {
	vi.mocked(agentStore.list).mockReturnValue([makeAgent({ agentType: "human" })]);
	const session = makeMockSession();
	const runner = makeProcessRunner(undefined, session);
	const mgr = createWorkerManager(makeDeps(), makeWorldState(), runner, "/vault", undefined);
	mgr.spawnAll();
	mgr.prime("Bob");
	expect(runner.acquireSession).not.toHaveBeenCalled();
});
```

Update the decay tests that depend on priming (they need `mgr.prime("Bob")` before `mgr.stop("Bob")`).

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`

- [ ] **Step 6: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5`

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/worker-types.ts" "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts" "01 - Projects/Flowti CLI/tests/infrastructure/worker-manager.test.ts"
git commit -m "feat(bridge): lazy priming — move session acquisition from spawn to prime()"
```

---

## Chunk 2: Plugin-Side Wiring

### Task 3: Add `sendRaw` to AgentProcess and implement in CLI executor

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor-helpers.ts:41-51`
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor.ts:56-61`

- [ ] **Step 1: Add `sendRaw` to AgentProcess interface**

In `cli-executor-helpers.ts`, add to the `AgentProcess` interface (after `send`):

```typescript
/** Send a raw JSONL payload to the CLI subprocess stdin. */
sendRaw(payload: Record<string, unknown>): void;
```

- [ ] **Step 2: Implement `sendRaw` in AgentProcessImpl**

In `cli-executor.ts`, add to `AgentProcessImpl` class (after the `send` method):

```typescript
sendRaw(payload: Record<string, unknown>): void {
	this.writeStdin(JSON.stringify(payload));
}
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor-helpers.ts" "01 - Projects/Flowti Plugin/src/infrastructure/agents/cli-executor.ts"
git commit -m "feat(plugin): add sendRaw to AgentProcess for arbitrary JSONL messages"
```

---

### Task 4: Add selectAgent, deselectAgent, forwardBtAction to dashboard store

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

- [ ] **Step 1: Add `selectAgent` and `deselectAgent` methods**

Add as public methods (near the existing `sendMessage` method):

```typescript
selectAgent(agentName: string): void {
	const prev = this.selectedAgent;
	if (prev && prev !== agentName) {
		this.deselectAgent(prev);
	}
	this.selectedAgent = agentName;
	const proc = this.getOrStartProcess(agentName);
	if (proc) {
		proc.sendRaw({ type: "agent-selected" });
	}
	this.notify();
}

deselectAgent(agentName: string): void {
	const proc = this.agentProcesses.get(this.slugify(agentName));
	if (proc?.running) {
		proc.sendRaw({ type: "agent-deselected" });
	}
	if (this.selectedAgent === agentName) {
		this.selectedAgent = null;
	}
	this.notify();
}
```

Add `selectedAgent: string | null = null;` as a private field if not already present.

- [ ] **Step 2: Add `forwardBtAction` method**

```typescript
forwardBtAction(agentName: string, action: string, data: Record<string, unknown>): void {
	const agent = this.agents.find((a) => a.name === agentName);
	if (!agent || agent.agentType !== "ai") return;
	const proc = this.getOrStartProcess(agentName);
	if (proc) {
		proc.sendRaw({ type: "bt-action", action, data });
	}
}
```

- [ ] **Step 3: Add `cli-brain-event` dispatch to handleCliEvent**

In `handleCliEvent` (line 554), add at the end of the switch (before the closing `}`):

```typescript
// Dispatch brain-relevant events for engine wiring
const brainEvents = ["thinking", "using-tool", "idle", "error", "done", "speaking", "queued", "response"];
if (brainEvents.includes(event.type)) {
	this.dispatchEvent(new CustomEvent("cli-brain-event", {
		detail: { agent: agentName, action: event.type },
	}));
}
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts"
git commit -m "feat(plugin): add selectAgent, deselectAgent, forwardBtAction, cli-brain-event dispatch"
```

---

### Task 5: Wire engine-simulation — BT action forwarding + brain event subscription

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts`

- [ ] **Step 1: Add BT action forwarding after bt.update()**

Find the line where `sys.bt.update()` is called (the return value is the collected BT actions). After that call, add:

```typescript
// Forward CLI-relevant BT actions for AI agents
if (btActions) {
	for (const action of btActions) {
		if (["goal-started", "task-started"].includes(action.type)) {
			const agent = ctx.store.getAgentByName?.(action.agentName);
			if (agent?.agentType === "ai") {
				ctx.store.forwardBtAction(action.agentName, action.type, action.data ?? {});
			}
		}
	}
}
```

Note: check how `btActions` is structured — it may be an array of `AgentAction` or a different shape. Read the return type of `sys.bt.update()` and adapt.

- [ ] **Step 2: Subscribe to `cli-brain-event` for brain state transitions**

In the engine setup (where the store is available and brain system is initialized), add:

```typescript
ctx.store.addEventListener("cli-brain-event", ((e: CustomEvent) => {
	const { agent, action } = e.detail as { agent: string; action: string };
	sys.brain.applyEvent(agent, action);

	// When CLI finishes work, emit goal-completed so BT knows the work cycle is done
	if (action === "done") {
		const entry = sys.brain.getEntry(agent);
		if (entry && entry.state === "working") {
			sys.brain.applyEvent(agent, "task-completed");
		}
	}
}) as EventListener);
```

- [ ] **Step 3: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): wire BT action forwarding and CLI→brain event bridge in engine"
```

---

## Chunk 3: Integration + Panel Wiring

### Task 6: Wire agent panel to selectAgent/deselectAgent

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-talk.ts` (or wherever agent selection triggers)

- [ ] **Step 1: Find where agent selection happens**

Search the Plugin codebase for where the user clicks on an agent and the panel opens. This is likely in the agent panel open/close lifecycle, or in a click handler on the agent actor.

- [ ] **Step 2: Call `store.selectAgent(agentName)` on panel open**

In the panel open handler (or agent click handler), add:

```typescript
store.selectAgent(agentName);
```

This replaces any existing logic that manually calls `getOrStartProcess` — `selectAgent` handles both the process lifecycle AND the `agent-selected` JSONL message.

- [ ] **Step 3: Call `store.deselectAgent(agentName)` on panel close**

In the panel close/unmount handler:

```typescript
store.deselectAgent(agentName);
```

- [ ] **Step 4: Verify the existing `sendMessage` still works**

The existing `sendMessage` flow in `panel-talk.ts` should continue to work unchanged — it calls `store.sendMessage()` which calls `proc.send()` (the `type: "message"` path). The `selectAgent` call ensures the session is primed before the user types.

- [ ] **Step 5: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/"
git commit -m "feat(plugin): wire agent panel to selectAgent/deselectAgent lifecycle"
```

---

### Task 7: Final integration verification

- [ ] **Step 1: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5`

Expected: All tests pass (401 suites, 6766+ tests)

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All tests pass

- [ ] **Step 3: Build both projects**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
cd "01 - Projects/Flowti Plugin" && npm run build
```

- [ ] **Step 4: Lint CLI**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

Expected: 0 errors

- [ ] **Step 5: Commit any fix-ups**

```bash
git add "01 - Projects/"
git commit -m "fix: address lint and type issues from autonomy bridge"
```
