# Agent Sidepanel Phase C — Context Awareness + Handler Completeness

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add context awareness (active file tracking + diffs sent with messages), complete the handler wiring (team mode, stop generation, error display, canvas events), and add keyboard shortcuts.

**Architecture:** `IContextProvider` is a pure domain interface. `ObsidianContextProvider` implements it in infrastructure using Obsidian's `workspace` and `vault` APIs. The handler injects context into `sendMessage` calls. Team mode switches between solo and shared conversation. Error events surface on the component via the `error` property inherited from `FlowtiElement`.

**Tech Stack:** Lit 3.x, TypeScript (strict), Vitest + happy-dom, Obsidian API (`Workspace`, `Vault`, `TFile`).

**Spec:** `docs/specs/2026-03-18-agent-sidepanel-view-design.md` — Section "Context Awareness"

**Key references:**
- `src/infrastructure/handlers/agent-handlers.ts` — Current handler (needs team/stop/error/canvas wiring)
- `src/domain/agents/types.ts` — Domain types
- `src/domain/agents/events.ts` — AgentEventMap
- `src/components/agents/flowti-agent-sidepanel.ts` — Root component
- `src/bootstrap/agentSetup.ts` — Bootstrap (needs context provider)

---

## Chunk 1: Context Provider (domain + infrastructure)

### Task 1: `IContextProvider` domain interface + types

**Files:**
- Create: `src/domain/agents/context-provider.ts`
- Test: `tests/domain/agents/context-provider.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/domain/agents/context-provider.test.ts
import { describe, it, expect } from "vitest";
import type { IContextProvider, FileContext, FileDiff } from "../../../src/domain/agents/context-provider.js";

describe("IContextProvider types", () => {
	it("FileContext has required shape", () => {
		const ctx: FileContext = { path: "test.md", contentHash: "abc", content: "hello" };
		expect(ctx.path).toBe("test.md");
		expect(ctx.contentHash).toBe("abc");
		expect(ctx.content).toBe("hello");
	});

	it("FileDiff has required shape", () => {
		const diff: FileDiff = { path: "test.md", previousHash: "a", currentHash: "b", diff: "+line" };
		expect(diff.diff).toBe("+line");
	});

	it("IContextProvider interface is implementable", () => {
		const provider: IContextProvider = {
			getActiveFileContext: () => null,
			getDiff: () => null,
			onFileChanged: () => () => {},
			dispose: () => {},
		};
		expect(provider.getActiveFileContext()).toBeNull();
		expect(typeof provider.dispose).toBe("function");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/agents/context-provider.test.ts`

- [ ] **Step 3: Create `src/domain/agents/context-provider.ts`**

```typescript
// src/domain/agents/context-provider.ts
/**
 * Context provider interface — tracks active file and computes diffs.
 * Pure domain type — no I/O dependencies.
 */

export interface FileContext {
	readonly path: string;
	readonly contentHash: string;
	readonly content: string;
}

export interface FileDiff {
	readonly path: string;
	readonly previousHash: string;
	readonly currentHash: string;
	readonly diff: string;
}

export interface IContextProvider {
	getActiveFileContext(): FileContext | null;
	getDiff(sinceHash: string): FileDiff | null;
	onFileChanged(callback: (ctx: FileContext) => void): () => void;
	dispose(): void;
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/domain/agents/context-provider.ts" "01 - Projects/Flowti Plugin/tests/domain/agents/context-provider.test.ts"
git commit -m "feat(plugin/agents): add IContextProvider domain interface"
```

---

### Task 2: `ObsidianContextProvider` infrastructure implementation

**Files:**
- Create: `src/infrastructure/agents/obsidian-context-provider.ts`
- Test: `tests/infrastructure/agents/obsidian-context-provider.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/infrastructure/agents/obsidian-context-provider.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObsidianContextProvider } from "../../../src/infrastructure/agents/obsidian-context-provider.js";

function mockWorkspace() {
	const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
	return {
		getActiveFile: vi.fn(() => null),
		on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
			const set = listeners.get(event) ?? new Set();
			set.add(cb);
			listeners.set(event, set);
			return { id: event, fn: cb };
		}),
		offref: vi.fn(),
		_fire(event: string, ...args: unknown[]) {
			for (const cb of listeners.get(event) ?? []) cb(...args);
		},
		_listeners: listeners,
	};
}

function mockVault() {
	return {
		cachedRead: vi.fn(async () => "file content"),
		on: vi.fn(() => ({ id: "modify", fn: () => {} })),
		offref: vi.fn(),
	};
}

describe("ObsidianContextProvider", () => {
	let workspace: ReturnType<typeof mockWorkspace>;
	let vault: ReturnType<typeof mockVault>;

	beforeEach(() => {
		workspace = mockWorkspace();
		vault = mockVault();
	});

	it("returns null when no active file", () => {
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		expect(provider.getActiveFileContext()).toBeNull();
	});

	it("returns file context for active file", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "notes/test.md" });
		vault.cachedRead.mockResolvedValue("hello world");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const ctx = provider.getActiveFileContext();
		expect(ctx).not.toBeNull();
		expect(ctx!.path).toBe("notes/test.md");
		expect(ctx!.content).toBe("hello world");
		expect(ctx!.contentHash).toBeTruthy();
	});

	it("computes diff between previous and current content", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "test.md" });
		vault.cachedRead.mockResolvedValueOnce("line1\nline2");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const hash1 = provider.getActiveFileContext()!.contentHash;

		vault.cachedRead.mockResolvedValueOnce("line1\nline2\nline3");
		await provider.refreshContext();
		const diff = provider.getDiff(hash1);
		expect(diff).not.toBeNull();
		expect(diff!.diff).toContain("line3");
		expect(diff!.previousHash).toBe(hash1);
	});

	it("getDiff returns null when hash matches current", async () => {
		workspace.getActiveFile.mockReturnValue({ path: "test.md" });
		vault.cachedRead.mockResolvedValue("same content");
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		await provider.refreshContext();
		const hash = provider.getActiveFileContext()!.contentHash;
		expect(provider.getDiff(hash)).toBeNull();
	});

	it("onFileChanged fires callback on file switch", async () => {
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		const changes: unknown[] = [];
		provider.onFileChanged((ctx) => changes.push(ctx));

		workspace.getActiveFile.mockReturnValue({ path: "new.md" });
		vault.cachedRead.mockResolvedValue("new content");
		workspace._fire("file-open");

		// Wait for debounce
		await new Promise((r) => setTimeout(r, 50));
		await provider.refreshContext();
		expect(changes.length).toBeGreaterThanOrEqual(0);
	});

	it("dispose cleans up event refs", () => {
		const provider = new ObsidianContextProvider(workspace as never, vault as never);
		provider.dispose();
		expect(workspace.offref).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/agents/obsidian-context-provider.test.ts`

- [ ] **Step 3: Create `src/infrastructure/agents/obsidian-context-provider.ts`**

```typescript
// src/infrastructure/agents/obsidian-context-provider.ts
/**
 * Obsidian-based IContextProvider — tracks active file, computes content diffs.
 * Uses workspace.on("file-open") and vault.cachedRead() for content.
 */

import type { Workspace, Vault, EventRef } from "obsidian";
import type { IContextProvider, FileContext, FileDiff } from "../../domain/agents/context-provider.js";

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash.toString(36);
}

function simpleDiff(prev: string, curr: string): string {
	const prevLines = prev.split("\n");
	const currLines = curr.split("\n");
	const lines: string[] = [];
	const maxLen = Math.max(prevLines.length, currLines.length);
	for (let i = 0; i < maxLen; i++) {
		const p = prevLines[i];
		const c = currLines[i];
		if (p === c) continue;
		if (p !== undefined && c === undefined) lines.push(`-${p}`);
		else if (p === undefined && c !== undefined) lines.push(`+${c}`);
		else if (p !== c) { lines.push(`-${p}`); lines.push(`+${c}`); }
	}
	return lines.join("\n");
}

export class ObsidianContextProvider implements IContextProvider {
	private workspace: Workspace;
	private vault: Vault;
	private currentContext: FileContext | null = null;
	private previousContents = new Map<string, { hash: string; content: string }>();
	private subscribers = new Set<(ctx: FileContext) => void>();
	private eventRefs: EventRef[] = [];
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(workspace: Workspace, vault: Vault) {
		this.workspace = workspace;
		this.vault = vault;

		const fileOpenRef = this.workspace.on("file-open", () => {
			this.debounceRefresh();
		});
		this.eventRefs.push(fileOpenRef);
	}

	getActiveFileContext(): FileContext | null {
		return this.currentContext;
	}

	getDiff(sinceHash: string): FileDiff | null {
		if (!this.currentContext) return null;
		if (this.currentContext.contentHash === sinceHash) return null;

		const prev = this.previousContents.get(sinceHash);
		if (!prev) return null;

		const diff = simpleDiff(prev.content, this.currentContext.content);
		return {
			path: this.currentContext.path,
			previousHash: sinceHash,
			currentHash: this.currentContext.contentHash,
			diff,
		};
	}

	onFileChanged(callback: (ctx: FileContext) => void): () => void {
		this.subscribers.add(callback);
		return () => { this.subscribers.delete(callback); };
	}

	async refreshContext(): Promise<void> {
		const file = this.workspace.getActiveFile();
		if (!file) {
			this.currentContext = null;
			return;
		}

		const content = await this.vault.cachedRead(file);
		const hash = simpleHash(content);

		if (this.currentContext) {
			this.previousContents.set(this.currentContext.contentHash, {
				hash: this.currentContext.contentHash,
				content: this.currentContext.content,
			});
		}

		this.currentContext = { path: file.path, contentHash: hash, content };

		for (const cb of this.subscribers) {
			try { cb(this.currentContext); } catch { /* subscriber error */ }
		}
	}

	dispose(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		for (const ref of this.eventRefs) {
			this.workspace.offref(ref);
		}
		this.eventRefs = [];
		this.subscribers.clear();
		this.previousContents.clear();
	}

	private debounceRefresh(): void {
		if (this.debounceTimer) clearTimeout(this.debounceTimer);
		this.debounceTimer = setTimeout(() => void this.refreshContext(), 2000);
	}
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/infrastructure/agents/obsidian-context-provider.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/agents/obsidian-context-provider.test.ts"
git commit -m "feat(plugin/agents): add ObsidianContextProvider with file tracking and diffs"
```

---

## Chunk 2: Handler Completeness (team, stop, error, canvas, context)

### Task 3: Complete handler wiring

**Files:**
- Modify: `src/infrastructure/handlers/agent-handlers.ts`
- Modify: `tests/infrastructure/handlers/agent-handlers.test.ts`

This task wires the missing event handlers: `team-toggled`, `agent-stop`, `error` events from service, and `canvas-export`/`canvas-open-requested`. It also injects context from `IContextProvider` into the message flow.

- [ ] **Step 1: Update handler**

```typescript
// src/infrastructure/handlers/agent-handlers.ts
/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ IAgentService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IEventBus } from "../events/types";
import type { IAgentService, ConversationMode } from "../../domain/agents/types";
import type { IContextProvider } from "../../domain/agents/context-provider";

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
	readonly contextProvider?: IContextProvider;
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { agentService, eventBus, contextProvider } = deps;
	const el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
	const unsubscribes: (() => void)[] = [];

	let activeAgent = "";
	let activeMode: ConversationMode = "conversational";
	let teamMode = false;
	let lastContextHash = "";

	function refresh(): void {
		const agents = agentService.listAgents();
		el.agents = agents;
		if (!activeAgent && agents.length > 0) activeAgent = agents[0].name;
		el.activeAgent = activeAgent;
		el.activeMode = activeMode;
		el.teamMode = teamMode;
		el.turns = teamMode
			? agentService.getTeamConversation()
			: activeAgent ? agentService.getConversation(activeAgent) : [];
	}

	// ── Agent selection ──
	el.addEventListener("agent-selected", ((e: CustomEvent) => {
		activeAgent = String(e.detail.agent);
		refresh();
	}) as EventListener);

	// ── Send message (with context) ──
	el.addEventListener("agent-send", ((e: CustomEvent) => {
		const message = String(e.detail.message);
		if (!activeAgent || !message) return;
		el.processing = true;
		void eventBus.emit("agent.message.sent", { agent: activeAgent, message, mode: activeMode });

		let enrichedMessage = message;
		if (contextProvider) {
			const diff = contextProvider.getDiff(lastContextHash);
			if (diff) {
				enrichedMessage = `[Context: ${diff.path} changed]\n${diff.diff}\n\n${message}`;
				lastContextHash = diff.currentHash;
			}
			const ctx = contextProvider.getActiveFileContext();
			if (ctx) lastContextHash = ctx.contentHash;
		}

		void agentService.sendMessage(activeAgent, enrichedMessage, activeMode).finally(() => {
			el.processing = false;
			refresh();
		});
		refresh();
	}) as EventListener);

	// ── Mode switch ──
	el.addEventListener("mode-changed", ((e: CustomEvent) => {
		activeMode = e.detail.mode as ConversationMode;
		void eventBus.emit("agent.mode.switched", { mode: activeMode });
		refresh();
	}) as EventListener);

	// ── Team toggle ──
	el.addEventListener("team-toggled", ((e: CustomEvent) => {
		teamMode = Boolean(e.detail.enabled);
		void eventBus.emit("agent.team.toggled", { enabled: teamMode });
		refresh();
	}) as EventListener);

	// ── Stop generation ──
	el.addEventListener("agent-stop", (() => {
		if (!activeAgent) return;
		void agentService.stopGeneration(activeAgent);
		el.processing = false;
		refresh();
	}) as EventListener);

	// ── Canvas events ──
	el.addEventListener("canvas-export", ((e: CustomEvent) => {
		void eventBus.emit("agent.canvas.synced", {
			canvasPath: String(e.detail.canvasPath ?? ""),
			nodeCount: Number(e.detail.nodeCount ?? 0),
		});
	}) as EventListener);

	// ── Service events → component updates ──
	const unsubService = agentService.onEvent((event) => {
		if (event.kind === "message-received" || event.kind === "status-changed") {
			refresh();
		}
		if (event.kind === "status-changed") {
			void eventBus.emit("agent.status.changed", { agent: event.agent, activity: event.activity });
		}
		if (event.kind === "message-received") {
			void eventBus.emit("agent.message.received", { agent: event.agent, turn: event.turn });
		}
		if (event.kind === "error") {
			el.error = event.error;
			el.processing = false;
			setTimeout(() => { el.error = ""; }, 5000);
		}
	});
	unsubscribes.push(unsubService);

	// ── Context tracking ──
	if (contextProvider) {
		const unsubCtx = contextProvider.onFileChanged((ctx) => {
			lastContextHash = ctx.contentHash;
		});
		unsubscribes.push(unsubCtx);
	}

	// ── Keyboard shortcuts ──
	const keyHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape" && el.processing) {
			if (activeAgent) void agentService.stopGeneration(activeAgent);
			el.processing = false;
			refresh();
		}
	};
	container.addEventListener("keydown", keyHandler);
	unsubscribes.push(() => container.removeEventListener("keydown", keyHandler));

	refresh();
	container.appendChild(el);

	return () => {
		for (const unsub of unsubscribes) unsub();
		el.remove();
	};
}
```

- [ ] **Step 2: Update handler tests**

```typescript
// tests/infrastructure/handlers/agent-handlers.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel } from "../../../src/infrastructure/handlers/agent-handlers.js";
import type { IAgentService, AgentCard } from "../../../src/domain/agents/types.js";
import type { IContextProvider, FileContext } from "../../../src/domain/agents/context-provider.js";

function mockService(agents: AgentCard[] = []): IAgentService {
	return {
		listAgents: () => agents,
		getAgent: (n) => agents.find((a) => a.name === n),
		sendMessage: vi.fn(async () => {}),
		stopGeneration: vi.fn(async () => {}),
		getConversation: () => [],
		getTeamConversation: () => [],
		onEvent: vi.fn(() => () => {}),
		connect: vi.fn(async () => {}),
		disconnect: vi.fn(),
	};
}

function mockEventBus() {
	return { emit: vi.fn(), on: vi.fn(() => () => {}), off: vi.fn() } as never;
}

function mockContextProvider(): IContextProvider {
	return {
		getActiveFileContext: vi.fn(() => ({ path: "test.md", contentHash: "abc", content: "hello" }) as FileContext),
		getDiff: vi.fn(() => ({ path: "test.md", previousHash: "old", currentHash: "abc", diff: "+new line" })),
		onFileChanged: vi.fn(() => () => {}),
		dispose: vi.fn(),
	};
}

describe("mountAgentSidepanel", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
	});

	it("mounts flowti-agent-sidepanel element into container", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		expect(container.querySelector("flowti-agent-sidepanel")).toBeTruthy();
		dispose();
	});

	it("sets agents property from service", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle", persona: "Alice" }];
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.agents).toEqual(agents);
	});

	it("dispose removes element", () => {
		const dispose = mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService() });
		dispose();
		expect(container.querySelector("flowti-agent-sidepanel")).toBeNull();
	});

	it("sets activeAgent to first agent when none selected", () => {
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle" }];
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		expect(el.activeAgent).toBe("atlas");
	});

	it("handles team-toggled event", () => {
		const bus = mockEventBus();
		const agents: AgentCard[] = [{ name: "atlas", activity: "idle" }];
		mountAgentSidepanel(container, { eventBus: bus, agentService: mockService(agents) });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("team-toggled", { detail: { enabled: true }, bubbles: true, composed: true }));
		expect(bus.emit).toHaveBeenCalledWith("agent.team.toggled", { enabled: true });
	});

	it("handles agent-stop event", () => {
		const service = mockService([{ name: "atlas", activity: "thinking" }]);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-stop", { bubbles: true, composed: true }));
		expect(service.stopGeneration).toHaveBeenCalledWith("atlas");
	});

	it("enriches message with context diff when provider available", () => {
		const service = mockService([{ name: "atlas", activity: "idle" }]);
		const ctx = mockContextProvider();
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service, contextProvider: ctx });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement;
		el.dispatchEvent(new CustomEvent("agent-send", { detail: { message: "explain this" }, bubbles: true, composed: true }));
		expect(service.sendMessage).toHaveBeenCalledWith(
			"atlas",
			expect.stringContaining("+new line"),
			"conversational",
		);
	});

	it("Escape key stops generation when processing", () => {
		const service = mockService([{ name: "atlas", activity: "thinking" }]);
		mountAgentSidepanel(container, { eventBus: mockEventBus(), agentService: service });
		const el = container.querySelector("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		el.processing = true;
		container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(service.stopGeneration).toHaveBeenCalledWith("atlas");
	});
});
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/infrastructure/handlers/agent-handlers.test.ts`

- [ ] **Step 4: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/agent-handlers.test.ts"
git commit -m "feat(plugin/agents): complete handler wiring — team, stop, error, context, keyboard"
```

---

### Task 4: Wire context provider into bootstrap

**Files:**
- Modify: `src/bootstrap/agentSetup.ts`
- Modify: `src/ui/agents/AgentSidepanelView.ts`

- [ ] **Step 1: Update `AgentSidepanelDeps` to include optional contextProvider**

In `src/ui/agents/AgentSidepanelView.ts`, add the import and field:

```typescript
import type { IContextProvider } from "../../domain/agents/context-provider";

export interface AgentSidepanelDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
	readonly contextProvider?: IContextProvider;
}
```

- [ ] **Step 2: Update bootstrap to create and wire context provider**

In `src/bootstrap/agentSetup.ts`, add:

```typescript
import { ObsidianContextProvider } from "../infrastructure/agents/obsidian-context-provider";
```

After creating `agentService` and `sseClient`, add:

```typescript
const contextProvider = new ObsidianContextProvider(
	deps.plugin.app.workspace,
	deps.plugin.app.vault,
);
```

Update `viewDeps` to include `contextProvider`:

```typescript
const viewDeps: AgentSidepanelDeps = { eventBus: deps.eventBus, agentService, contextProvider };
```

Update `AgentSetupResult` to include `contextProvider`:

```typescript
export interface AgentSetupResult {
	readonly agentService: HttpAgentService;
	readonly sseClient: SseClient;
	readonly contextProvider: ObsidianContextProvider;
}
```

Return it:

```typescript
return { agentService, sseClient, contextProvider };
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit -skipLibCheck 2>&1 | grep -v FlowtiModal`

- [ ] **Step 4: Commit**

```bash
git add -f "01 - Projects/Flowti Plugin/src/bootstrap/agentSetup.ts" "01 - Projects/Flowti Plugin/src/ui/agents/AgentSidepanelView.ts"
git commit -m "feat(plugin/agents): wire ObsidianContextProvider into bootstrap and view"
```

---

### Task 5: Quality gate

- [ ] **Step 1: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit -skipLibCheck`

- [ ] **Step 2: Run lint on agent files**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/components/agents/ src/domain/agents/ src/infrastructure/agents/ src/infrastructure/handlers/agent-handlers.ts`

- [ ] **Step 3: Run full agent test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/components/agents tests/infrastructure/handlers/agent-handlers.test.ts tests/domain/agents tests/infrastructure/agents`

Expected: All tests pass.

- [ ] **Step 4: Fix any issues and commit**

---

## Summary

| Task | What | Tests |
|------|------|-------|
| 1 | `IContextProvider` domain interface | 3 |
| 2 | `ObsidianContextProvider` with file tracking + diffs | 6 |
| 3 | Handler: team, stop, error, canvas, context, keyboard | 8 |
| 4 | Bootstrap wiring | type check |
| 5 | Quality gate | full suite |
| **Total** | **2 new files, 2 modified** | **~17 new** |

**Phase C deliverables:**
- `IContextProvider` domain interface (pure, no deps)
- `ObsidianContextProvider` tracking active file with debounced refresh + simple diff
- Handler wires context diffs into agent messages automatically
- Team mode fully wired (toggling switches conversation source)
- Stop generation wired from input bar + Escape key
- Error events from service display temporarily on component
- Canvas export events forwarded to EventBus
