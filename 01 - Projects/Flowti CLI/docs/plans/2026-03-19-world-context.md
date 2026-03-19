# WorldContext Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a WorldContext service that aggregates workspace state and injects it into agent prompts — full snapshot on first message, incremental deltas after.

**Architecture:** A domain service at `src/domain/agents/world-context.ts` wraps the existing `IContextProvider`, adds workspace/canvas/project/iteration/roster awareness, and serializes it as compact markdown. Two serialization modes: `serialize()` for full snapshots and `serializeDelta(agentName)` for incremental changes. Version tracking per agent ensures each agent only receives what changed since their last message.

**Tech Stack:** TypeScript, Obsidian API (Workspace, Vault), existing CanvasParser, existing IContextProvider

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-19-world-context-design.md`

---

## Chunk 1: WorldContext Core

### Task 1: Create WorldContext with serialize() and delta tracking

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/domain/agents/world-context.ts`
- Create: `01 - Projects/Flowti Plugin/tests/domain/agents/world-context.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WorldContext, type WorldContextDeps } from "../../../src/domain/agents/world-context.js";

function createMockDeps(overrides: Partial<WorldContextDeps> = {}): WorldContextDeps {
	return {
		contextProvider: {
			getActiveFileContext: vi.fn().mockReturnValue({
				path: "src/game/engine.ts",
				contentHash: "abc123",
				content: "export function createAgentWorld() { /* ... */ }",
			}),
			getDiff: vi.fn().mockReturnValue(null),
			onFileChanged: vi.fn().mockReturnValue(() => {}),
			dispose: vi.fn(),
		},
		workspace: {
			on: vi.fn().mockReturnValue({ unload: vi.fn() }),
			iterateAllLeaves: vi.fn((cb: (leaf: unknown) => void) => {
				cb({ view: { file: { path: "src/game/engine.ts", extension: "ts" } } });
				cb({ view: { file: { path: "src/game/actors/agent-actor.ts", extension: "ts" } } });
			}),
			getActiveFile: vi.fn().mockReturnValue(null),
		} as unknown as WorldContextDeps["workspace"],
		vaultAdapter: {
			exists: vi.fn().mockResolvedValue(false),
			read: vi.fn().mockResolvedValue("{}"),
		},
		eventBus: {
			on: vi.fn().mockReturnValue(() => {}),
		} as unknown as WorldContextDeps["eventBus"],
		...overrides,
	};
}

describe("WorldContext", () => {
	describe("serialize", () => {
		it("includes active file in snapshot", () => {
			const ctx = new WorldContext(createMockDeps());
			const output = ctx.serialize();
			expect(output).toContain("[World Context — Snapshot]");
			expect(output).toContain("Active: src/game/engine.ts");
			expect(output).toContain("TypeScript");
		});

		it("includes open files", () => {
			const ctx = new WorldContext(createMockDeps());
			const output = ctx.serialize();
			expect(output).toContain("Open:");
			expect(output).toContain("engine.ts");
			expect(output).toContain("agent-actor.ts");
		});

		it("omits canvas section when no canvas is open", () => {
			const ctx = new WorldContext(createMockDeps());
			const output = ctx.serialize();
			expect(output).not.toContain("Canvas:");
		});
	});

	describe("getProtocolInstruction", () => {
		it("interpolates agent name and domain", () => {
			const ctx = new WorldContext(createMockDeps());
			const protocol = ctx.getProtocolInstruction("Atlas", "orchestration");
			expect(protocol).toContain("Atlas");
			expect(protocol).toContain("orchestration");
			expect(protocol).toContain("Keep responses short");
		});
	});

	describe("serializeDelta", () => {
		it("returns null when nothing changed", () => {
			const ctx = new WorldContext(createMockDeps());
			ctx.markSeen("Atlas");
			const delta = ctx.serializeDelta("Atlas");
			expect(delta).toBeNull();
		});

		it("returns changes after state update", () => {
			const deps = createMockDeps();
			let fileChangedCb: ((ctx: { path: string; contentHash: string; content: string }) => void) | undefined;
			(deps.contextProvider.onFileChanged as ReturnType<typeof vi.fn>).mockImplementation(
				(cb: (ctx: { path: string; contentHash: string; content: string }) => void) => {
					fileChangedCb = cb;
					return () => {};
				},
			);

			const ctx = new WorldContext(deps);
			ctx.markSeen("Atlas");

			// Simulate file change
			fileChangedCb?.({
				path: "src/game/store/dashboard-store.ts",
				contentHash: "def456",
				content: "export class DashboardStore { }",
			});

			const delta = ctx.serializeDelta("Atlas");
			expect(delta).not.toBeNull();
			expect(delta).toContain("[Context Update]");
			expect(delta).toContain("dashboard-store.ts");
		});
	});

	describe("markSeen", () => {
		it("advances agent version so next delta is null", () => {
			const ctx = new WorldContext(createMockDeps());
			ctx.markSeen("Atlas");
			expect(ctx.serializeDelta("Atlas")).toBeNull();
		});
	});

	describe("onChange", () => {
		it("calls subscriber on state change", () => {
			const deps = createMockDeps();
			let fileChangedCb: ((ctx: { path: string; contentHash: string; content: string }) => void) | undefined;
			(deps.contextProvider.onFileChanged as ReturnType<typeof vi.fn>).mockImplementation(
				(cb: (ctx: { path: string; contentHash: string; content: string }) => void) => {
					fileChangedCb = cb;
					return () => {};
				},
			);

			const ctx = new WorldContext(deps);
			const handler = vi.fn();
			ctx.onChange(handler);

			fileChangedCb?.({
				path: "test.ts",
				contentHash: "xyz",
				content: "test",
			});

			expect(handler).toHaveBeenCalled();
		});

		it("returns unsubscribe function", () => {
			const ctx = new WorldContext(createMockDeps());
			const handler = vi.fn();
			const unsub = ctx.onChange(handler);
			unsub();
			// No error — unsubscribe is clean
		});
	});

	describe("dispose", () => {
		it("cleans up without error", () => {
			const ctx = new WorldContext(createMockDeps());
			ctx.dispose();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/agents/world-context.test.ts -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write WorldContext implementation**

Create `src/domain/agents/world-context.ts`:

```typescript
import type { IContextProvider, FileContext } from "./context-provider.js";
import type { IEventBus } from "../../infrastructure/events/types.js";
import type { Workspace, EventRef } from "obsidian";

// ── File type mapping ───────────────────────────────────────────────

const EXT_TYPE_MAP: Record<string, string> = {
	ts: "TypeScript", js: "JavaScript", tsx: "TypeScript", jsx: "JavaScript",
	md: "Markdown", json: "JSON", css: "CSS", html: "HTML",
	canvas: "Canvas", yaml: "YAML", yml: "YAML", mjs: "JavaScript",
};

function fileType(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase() ?? "";
	return EXT_TYPE_MAP[ext] ?? ext.toUpperCase();
}

function basename(path: string): string {
	return path.split("/").pop() ?? path;
}

function shortenPaths(paths: string[]): string[] {
	const bases = paths.map(basename);
	return paths.map((p, i) => {
		const b = bases[i];
		const dupes = bases.filter((x) => x === b).length;
		if (dupes > 1) {
			const parts = p.split("/");
			return parts.length > 1 ? parts.slice(-2).join("/") : b;
		}
		return b;
	});
}

function timeAgo(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	return `${hours}h ago`;
}

// ── Change log entry ────────────────────────────────────────────────

interface ChangeEntry {
	version: number;
	description: string;
}

// ── Types ───────────────────────────────────────────────────────────

export interface WorldContextDeps {
	readonly contextProvider: IContextProvider;
	readonly workspace: Workspace;
	readonly vaultAdapter: {
		exists(path: string): Promise<boolean>;
		read(path: string): Promise<string>;
	};
	readonly eventBus: IEventBus;
}

// ── WorldContext ─────────────────────────────────────────────────────

export class WorldContext {
	// ── Live state ──────────────────────────────────
	activeFile: { path: string; contentSnippet: string; type: string } | null = null;
	openFiles: { path: string; type: string }[] = [];
	activeCanvas: { path: string; summary: string } | null = null;
	projectInfo: { name: string; path: string; domains: string[] } | null = null;
	currentIteration: { name: string; phase: string; scopeDone: number; scopeTotal: number } | null = null;
	agentRoster: { name: string; domain: string; status: string; currentTask?: string }[] = [];
	recentActivity: { agent: string; action: string; timestamp: number }[] = [];

	// ── Version tracking ───────────────────────────
	private version = 0;
	private agentVersions = new Map<string, number>();
	private changeLog: ChangeEntry[] = [];
	private subscribers = new Set<() => void>();

	// ── Cleanup ────────────────────────────────────
	private unsubs: Array<() => void> = [];
	private eventRefs: EventRef[] = [];
	private layoutDebounce: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly deps: WorldContextDeps) {
		// Active file
		const fileCtx = deps.contextProvider.getActiveFileContext();
		if (fileCtx) this.applyFileContext(fileCtx);

		const fileUnsub = deps.contextProvider.onFileChanged((ctx) => {
			this.applyFileContext(ctx);
			this.bump(`Active changed: ${basename(ctx.path)}`);
		});
		this.unsubs.push(fileUnsub);

		// Open files (debounced)
		const layoutRef = deps.workspace.on("layout-change", () => {
			if (this.layoutDebounce) clearTimeout(this.layoutDebounce);
			this.layoutDebounce = setTimeout(() => this.refreshOpenFiles(), 500);
		});
		this.eventRefs.push(layoutRef);
		this.refreshOpenFiles();
	}

	// ── Serialization ──────────────────────────────

	serialize(): string {
		const lines: string[] = ["[World Context — Snapshot]"];

		if (this.activeFile) {
			lines.push(`Active: ${this.activeFile.path} (${this.activeFile.type})`);
		}

		if (this.openFiles.length > 0) {
			const shortened = shortenPaths(this.openFiles.map((f) => f.path));
			lines.push(`Open: ${shortened.join(", ")}`);
		}

		if (this.activeCanvas) {
			lines.push(`Canvas: ${this.activeCanvas.summary}`);
		}

		if (this.projectInfo) {
			lines.push(`Project: ${this.projectInfo.name} — domains: ${this.projectInfo.domains.join(", ")}`);
		}

		if (this.currentIteration) {
			const it = this.currentIteration;
			lines.push(`Iteration: "${it.name}" ${it.phase} — ${it.scopeDone}/${it.scopeTotal} done`);
		}

		if (this.agentRoster.length > 0) {
			const agents = this.agentRoster.map((a) => {
				const task = a.currentTask ? `, busy: "${a.currentTask}"` : `, ${a.status}`;
				return `${a.name} (${a.domain}${task})`;
			});
			lines.push(`Team: ${agents.join(", ")}`);
		}

		if (this.recentActivity.length > 0) {
			const recent = this.recentActivity.slice(0, 5).map(
				(a) => `${a.agent} ${a.action} ${timeAgo(a.timestamp)}`,
			);
			lines.push(`Recent: ${recent.join(", ")}`);
		}

		return lines.join("\n");
	}

	serializeDelta(agentName: string): string | null {
		const lastSeen = this.agentVersions.get(agentName) ?? 0;
		if (lastSeen >= this.version) return null;

		const changes = this.changeLog.filter((c) => c.version > lastSeen);
		if (changes.length === 0) return null;

		// If too many changes, fall back to full snapshot
		if (changes.length > 10) return this.serialize();

		const lines = ["[Context Update]"];
		for (const c of changes) {
			lines.push(c.description);
		}
		return lines.join("\n");
	}

	markSeen(agentName: string): void {
		this.agentVersions.set(agentName, this.version);
	}

	getProtocolInstruction(agentName: string, domain: string): string {
		return `[Agent Protocol]
You are ${agentName}, a ${domain} specialist on the Flowti team.
You receive live context updates about the user's workspace between messages.
Keep responses short and conversational (1-3 sentences).
If a question requires deep analysis, ask the user: "Want me to think deeper on this?"
Do not explain your reasoning unless asked. Act, don't narrate.
Context updates look like [Context Update] blocks — absorb them silently, don't acknowledge them.`;
	}

	onChange(cb: () => void): () => void {
		this.subscribers.add(cb);
		return () => { this.subscribers.delete(cb); };
	}

	// ── Mutators (called by external wiring) ───────

	setAgentRoster(roster: { name: string; domain: string; status: string; currentTask?: string }[]): void {
		this.agentRoster = roster;
		this.bump("Team roster updated");
	}

	pushActivity(agent: string, action: string): void {
		this.recentActivity.unshift({ agent, action, timestamp: Date.now() });
		if (this.recentActivity.length > 20) this.recentActivity.pop();
		this.bump(`${agent} ${action}`);
	}

	setProjectInfo(info: { name: string; path: string; domains: string[] }): void {
		this.projectInfo = info;
		this.bump("Project info loaded");
	}

	setIteration(iteration: { name: string; phase: string; scopeDone: number; scopeTotal: number }): void {
		this.currentIteration = iteration;
		this.bump(`Iteration: "${iteration.name}" ${iteration.phase}`);
	}

	setActiveCanvas(path: string, summary: string): void {
		this.activeCanvas = { path, summary };
		this.bump(`Canvas: ${basename(path)}`);
	}

	clearActiveCanvas(): void {
		if (this.activeCanvas) {
			this.activeCanvas = null;
			this.bump("Canvas closed");
		}
	}

	dispose(): void {
		for (const unsub of this.unsubs) unsub();
		this.unsubs = [];
		for (const ref of this.eventRefs) {
			this.deps.workspace.offref(ref);
		}
		this.eventRefs = [];
		if (this.layoutDebounce) clearTimeout(this.layoutDebounce);
		this.subscribers.clear();
		this.changeLog = [];
	}

	// ── Private ────────────────────────────────────

	private applyFileContext(ctx: FileContext): void {
		this.activeFile = {
			path: ctx.path,
			contentSnippet: ctx.content.slice(0, 500),
			type: fileType(ctx.path),
		};
	}

	private refreshOpenFiles(): void {
		const files: { path: string; type: string }[] = [];
		this.deps.workspace.iterateAllLeaves((leaf) => {
			const file = (leaf as { view?: { file?: { path?: string } } }).view?.file;
			if (file?.path) {
				files.push({ path: file.path, type: fileType(file.path) });
			}
		});
		const prev = this.openFiles.map((f) => f.path).join(",");
		this.openFiles = files;
		const curr = files.map((f) => f.path).join(",");
		if (prev !== curr) {
			this.bump("Open files changed");
		}
	}

	private bump(description: string): void {
		this.version++;
		this.changeLog.push({ version: this.version, description });
		// Keep change log bounded
		if (this.changeLog.length > 50) {
			this.changeLog = this.changeLog.slice(-30);
		}
		for (const cb of this.subscribers) {
			try { cb(); } catch { /* subscriber error */ }
		}
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/agents/world-context.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/agents/world-context.ts" "01 - Projects/Flowti Plugin/tests/domain/agents/world-context.test.ts"
git commit -m "feat(agents): add WorldContext — workspace state aggregation + delta serialization"
```

---

## Chunk 2: Wire into Agent Setup and Game Engine

### Task 2: Wire WorldContext into agent-setup.ts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts`

- [ ] **Step 1: Import WorldContext**

Add at top of file:
```typescript
import { WorldContext } from "../domain/agents/world-context.js";
```

- [ ] **Step 2: Create WorldContext instance after contextProvider**

After `const contextProvider = new ObsidianContextProvider(...)` (around line 46), add:

```typescript
const worldContext = new WorldContext({
	contextProvider,
	workspace: deps.app.workspace,
	vaultAdapter: deps.app.vault.adapter as { exists(p: string): Promise<boolean>; read(p: string): Promise<string> },
	eventBus: deps.eventBus,
});
```

- [ ] **Step 3: Add worldContext to AgentSetupResult**

Change the interface (around line 29):
```typescript
export interface AgentSetupResult {
	readonly agentService: HttpAgentService;
	readonly sseClient: SseClient;
	readonly contextProvider: ObsidianContextProvider;
	readonly worldContext: WorldContext;
	readonly connectWhenReady: () => void;
}
```

Update the return statement (around line 154):
```typescript
return { agentService, sseClient, contextProvider, worldContext, connectWhenReady };
```

- [ ] **Step 4: Pass worldContext to worldDeps**

Change the worldDeps construction (around line 102):
```typescript
const worldDeps: AgentWorldViewDeps = {
	plugin: deps.plugin,
	eventBus: deps.eventBus,
	serverBaseUrl: baseUrl,
	worldContext,
	agentService,
};
```

Remove the `contextProvider` field from worldDeps — WorldContext wraps it.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts"
git commit -m "feat(agents): wire WorldContext into agent-setup — create + pass to views"
```

### Task 3: Update AgentWorldView and engine to use WorldContext

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`

- [ ] **Step 1: Update AgentWorldViewDeps**

In `agent-world-view.ts`, replace the `contextProvider` field with `worldContext`:

```typescript
import type { WorldContext } from "../../domain/agents/world-context.js";

export interface AgentWorldViewDeps {
	readonly plugin: Plugin;
	readonly eventBus: IEventBus;
	readonly serverBaseUrl?: string;
	readonly worldContext?: WorldContext;
	readonly agentService?: { /* ... existing shape ... */ };
}
```

- [ ] **Step 2: Pass worldContext to createAgentWorld**

In `onOpen()`, replace the contextProvider pass-through:

```typescript
this.handle = createAgentWorld({
	container,
	provider,
	spriteBasePath,
	serverBaseUrl: this.deps.serverBaseUrl,
	worldContext: this.deps.worldContext,
});
```

- [ ] **Step 3: Update AgentWorldDeps in engine.ts**

Replace the `contextProvider?` field:

```typescript
import type { WorldContext } from "../domain/agents/world-context.js";

// Note: engine.ts is in src/game/, world-context.ts is in src/domain/agents/
// The import path needs to go up to src/ then into domain/

export interface AgentWorldDeps {
	container: HTMLElement;
	provider: DataProvider;
	spriteBasePath: string;
	serverBaseUrl?: string;
	worldContext?: WorldContext;
}
```

- [ ] **Step 4: Replace contextProvider wiring in engine start()**

Find the `contextProvider` wiring block (around line 717) and replace:

```typescript
// Wire WorldContext onChange into store (replaces old contextProvider → userContext wiring)
if (deps.worldContext) {
	deps.worldContext.onChange(() => {
		// WorldContext updates are consumed during sendMessage serialization,
		// not pushed to the store. The onChange is for future UI use.
	});
}
```

Remove the old `store.setUserContext()` calls.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts" "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(agents): update view + engine to use WorldContext instead of contextProvider"
```

---

## Chunk 3: Prompt Injection

### Task 4: Update DashboardStore.sendMessage() to use WorldContext

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

- [ ] **Step 1: Add WorldContext to DashboardStore constructor**

Import and accept WorldContext:

```typescript
import type { WorldContext } from "../../domain/agents/world-context.js";
```

Change constructor to accept it:
```typescript
constructor(baseUrl: string, worldContext?: WorldContext) {
	super();
	this.baseUrl = baseUrl;
	this.worldContext = worldContext ?? null;
}

private worldContext: WorldContext | null;
```

- [ ] **Step 2: Replace sendMessage context enrichment**

Replace the entire `sendMessage` method body (lines ~233-257):

```typescript
async sendMessage(agentName: string, message: string): Promise<{ ok: boolean; error?: string }> {
	this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName } }));

	// Build context block from WorldContext
	let contextBlock = "";
	if (this.worldContext) {
		const isFirstMessage = !this.conversations.has(agentName) || this.conversations.get(agentName)!.length === 0;
		if (isFirstMessage) {
			const agent = this.agents.find((a) => a.name === agentName);
			const protocol = this.worldContext.getProtocolInstruction(agentName, agent?.domain ?? "general");
			const snapshot = this.worldContext.serialize();
			contextBlock = `${protocol}\n\n${snapshot}`;
		} else {
			contextBlock = this.worldContext.serializeDelta(agentName) ?? "";
		}
		this.worldContext.markSeen(agentName);
	}

	// Log full enriched prompt to debug console
	const fullPrompt = contextBlock ? `${contextBlock}\n\n${message}` : message;
	this.pushDebugEntry(agentName, fullPrompt);

	// Send with context as a single string (server prepends to LLM prompt)
	const result = await api.sendMessage(this.baseUrl, agentName, message, contextBlock ? { worldContext: contextBlock } : undefined);
	if (result.ok && result.response) {
		this.pushAgentResponse(agentName, result.response);
		this.dispatchEvent(new CustomEvent("agent-response-received", {
			detail: { agentName, text: result.response, type: result.type ?? "speaking" },
		}));
	} else if (!result.ok) {
		this.pushAgentResponse(agentName, `[offline] ${result.error ?? "Cannot reach server."}`);
	}
	return result;
}
```

- [ ] **Step 3: Remove userContext field and setUserContext()**

Delete these lines (around lines 48-53):
```typescript
// DELETE: userContext field, setUserContext() method
```

- [ ] **Step 4: Update DashboardStore construction in engine.ts**

In `engine.ts`, update the store constructor call (around line 95):

```typescript
const store = new DashboardStore(deps.serverBaseUrl ?? "", deps.worldContext);
```

- [ ] **Step 5: Update api-client sendMessage signature**

In `src/game/data/api-client.ts`, update the `context` parameter to accept the new shape:

```typescript
export async function sendMessage(
	baseUrl: string,
	agentName: string,
	message: string,
	context?: { worldContext: string } | { path: string; contentSnippet: string },
): Promise<ApiResult> {
	// ... existing fetch logic, but serialize context appropriately
	const body: Record<string, unknown> = { agentName, message };
	if (context && "worldContext" in context) {
		body.context = context.worldContext;
	} else if (context) {
		body.context = context;
	}
	// ... rest of fetch
}
```

- [ ] **Step 6: Update server to handle worldContext string**

In `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`, update the context handling (around line 183):

```typescript
// Context can be a worldContext string or legacy { path, contentSnippet } object
let contextPrefix = "";
if (typeof body.context === "string") {
	contextPrefix = body.context + "\n\n";
} else if (body.context?.path) {
	const ctx = body.context as { path?: string; contentSnippet?: string };
	contextPrefix = `[User is currently viewing: ${ctx.path}]\n${ctx.contentSnippet ? `[File content]:\n${ctx.contentSnippet}\n\n` : ""}`;
}
const fullMessage = contextPrefix + message;
```

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/src/game/data/api-client.ts" "01 - Projects/Flowti Plugin/src/game/engine.ts" "01 - Projects/Flowti CLI/src/domain/serve/static-server.ts"
git commit -m "feat(agents): inject WorldContext into agent prompts — snapshot + delta"
```

### Task 5: Update sidepanel agent-handlers.ts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts`

- [ ] **Step 1: Add worldContext to AgentHandlerDeps**

```typescript
import type { WorldContext } from "../../domain/agents/world-context.js";

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
	readonly contextProvider?: IContextProvider;
	readonly worldContext?: WorldContext;
	// ... rest of existing fields
}
```

- [ ] **Step 2: Replace context enrichment in send handler**

Find the `agent-send` event listener (around line 68). Replace the context enrichment block:

```typescript
el.addEventListener("agent-send", ((e: CustomEvent) => {
	const message = String(e.detail.message);
	if (!activeAgent || !message) return;
	el.processing = true;
	void eventBus.emit("agent.message.sent", { agent: activeAgent, message, mode: activeMode });

	let enrichedMessage = message;
	if (worldContext) {
		const isFirst = !agentService.getConversation(activeAgent).length;
		let contextBlock: string;
		if (isFirst) {
			const domain = "general"; // sidepanel doesn't have domain info readily available
			contextBlock = worldContext.getProtocolInstruction(activeAgent, domain)
				+ "\n\n" + worldContext.serialize();
		} else {
			contextBlock = worldContext.serializeDelta(activeAgent) ?? "";
		}
		worldContext.markSeen(activeAgent);
		if (contextBlock) {
			enrichedMessage = contextBlock + "\n\n" + message;
		}
	} else if (contextProvider) {
		// Fallback to legacy context enrichment
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
```

- [ ] **Step 3: Wire worldContext from sidepanel deps**

In `agent-setup.ts`, add `worldContext` to the sidepanel viewDeps:

```typescript
const viewDeps: AgentSidepanelDeps = {
	eventBus: deps.eventBus,
	agentService,
	contextProvider,
	worldContext,
	// ... rest of existing fields
};
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts" "01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts"
git commit -m "feat(agents): inject WorldContext into sidepanel agent messaging"
```

---

## Chunk 4: Build + Verify

### Task 6: Build and run full test suite

- [ ] **Step 1: Build plugin**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Build succeeds.

- [ ] **Step 2: Build CLI**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

Expected: Build succeeds.

- [ ] **Step 3: Run WorldContext tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/agents/world-context.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 4: Run full plugin test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

Expected: No new failures from our changes.

- [ ] **Step 5: Type check**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: No new type errors.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(agents): WorldContext complete — verified"
```
