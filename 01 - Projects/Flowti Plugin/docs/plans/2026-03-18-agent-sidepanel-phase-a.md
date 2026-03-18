# Agent Sidepanel View — Phase A: Foundation + HTTP Integration

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Agent Sidepanel foundation — domain types, events, real HTTP+SSE service (connected to CLI server at localhost), ItemView shell, handler, bootstrap, and root `<flowti-agent-sidepanel>` Lit component. Delivers: a working sidepanel that opens in Obsidian, connects to the running CLI server, and shows agent roster data.

**Architecture:** Two-layer design. Obsidian `ItemView` shell mounts a Lit component tree. `HttpAgentService` talks to CLI server (`/api/agent/*` endpoints + SSE at `/events`). `AgentEventMap` integrates into the Plugin's composite `FlowtiEventMap`. Bootstrap follows `SessionSetup`/`TrainSetup` pattern.

**Tech Stack:** Lit 3.x (`FlowtiElement` base), TypeScript (strict), Vitest + happy-dom, Obsidian API (`ItemView`, `WorkspaceLeaf`). HTTP via `fetch()`, SSE via `EventSource`. No runtime deps beyond what's already in Plugin.

**Spec:** `docs/specs/2026-03-18-agent-sidepanel-view-design.md`

**CLI Server endpoints (already production-ready):**
- `GET /events` — SSE stream (emits `agent-action`, `entity-update`)
- `GET /api/world-state` — Full world state dump
- `GET /api/agent/:name` — Single agent entity
- `POST /api/agent/send` — `{ agentName, message }` → sends to LLM
- `POST /api/agent/wake` — `{ agentName }` → wakes agent with greeting
- `POST /api/agent/task` — `{ agentName, task }` → assigns task
- `POST /api/agent/permission` — `{ agentName, tool, decision }` → grant/deny

---

## Chunk 1: Domain Types + Events

### Task 1: Agent domain types — `types.ts`

**Files:**
- Create: `src/domain/agents/types.ts`
- Test: `tests/domain/agents/types.test.ts`

- [ ] **Step 1: Write type assertion tests**

```typescript
// tests/domain/agents/types.test.ts
import { describe, it, expectTypeOf } from "vitest";
import type {
	AgentCard, ConversationTurn, ConversationMode,
	ToolCall, AgentServiceEvent, IAgentService,
} from "../../../src/domain/agents/types.js";

describe("agent domain types", () => {
	it("AgentCard has required fields", () => {
		const card: AgentCard = {
			name: "atlas", activity: "idle",
		};
		expectTypeOf(card).toMatchTypeOf<AgentCard>();
	});

	it("ConversationTurn has required fields", () => {
		const turn: ConversationTurn = {
			id: "1", role: "agent", content: "hello", timestamp: "", mode: "conversational",
		};
		expectTypeOf(turn).toMatchTypeOf<ConversationTurn>();
	});

	it("AgentServiceEvent is a discriminated union", () => {
		const events: AgentServiceEvent[] = [
			{ kind: "status-changed", agent: "a", activity: "thinking" },
			{ kind: "message-received", agent: "a", turn: { id: "1", role: "agent", content: "", timestamp: "", mode: "conversational" } },
			{ kind: "thinking", agent: "a", text: "" },
			{ kind: "tool-started", agent: "a", tool: "Bash", id: "1" },
			{ kind: "tool-completed", agent: "a", id: "1" },
		];
		expectTypeOf(events).toMatchTypeOf<AgentServiceEvent[]>();
	});

	it("IAgentService has async sendMessage", () => {
		expectTypeOf<IAgentService>().toHaveProperty("sendMessage");
		expectTypeOf<IAgentService>().toHaveProperty("stopGeneration");
		expectTypeOf<IAgentService>().toHaveProperty("listAgents");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/domain/agents/types.test.ts`

- [ ] **Step 3: Create `src/domain/agents/types.ts`**

```typescript
// src/domain/agents/types.ts
/**
 * Agent domain types for the sidepanel view.
 * Pure types — no I/O, no dependencies.
 */

export type ConversationMode = "document" | "conversational" | "canvas";

export interface AgentCard {
	readonly name: string;
	readonly persona?: string;
	readonly mood?: string;
	readonly intStat?: number;
	readonly chaStat?: number;
	readonly activity: "idle" | "thinking" | "speaking" | "using-tool";
}

export interface ToolCall {
	readonly id: string;
	readonly name: string;
	readonly status: "started" | "completed";
}

export interface ConversationTurn {
	readonly id: string;
	readonly role: "user" | "agent";
	readonly agentName?: string;
	readonly persona?: string;
	readonly content: string;
	readonly thinking?: string;
	readonly toolCalls?: ToolCall[];
	readonly timestamp: string;
	readonly mode: ConversationMode;
}

export type AgentServiceEvent =
	| { readonly kind: "status-changed"; readonly agent: string; readonly activity: AgentCard["activity"] }
	| { readonly kind: "message-received"; readonly agent: string; readonly turn: ConversationTurn }
	| { readonly kind: "thinking"; readonly agent: string; readonly text: string }
	| { readonly kind: "tool-started"; readonly agent: string; readonly tool: string; readonly id: string }
	| { readonly kind: "tool-completed"; readonly agent: string; readonly id: string };

export interface IAgentService {
	listAgents(): AgentCard[];
	getAgent(name: string): AgentCard | undefined;
	sendMessage(agent: string, message: string, mode: ConversationMode, signal?: AbortSignal): Promise<void>;
	stopGeneration(agent: string): Promise<void>;
	getConversation(agent: string): ConversationTurn[];
	getTeamConversation(): ConversationTurn[];
	onEvent(callback: (event: AgentServiceEvent) => void): () => void;
	connect(): Promise<void>;
	disconnect(): void;
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/agents/types.ts" "01 - Projects/Flowti Plugin/tests/domain/agents/types.test.ts"
git commit -m "feat(plugin/agents): add agent domain types"
```

---

### Task 2: Agent events — `events.ts`

**Files:**
- Create: `src/domain/agents/events.ts`
- Modify: `src/infrastructure/events/events.ts:111` (add AgentEventMap to FlowtiEventMap)

- [ ] **Step 1: Create `src/domain/agents/events.ts`**

```typescript
// src/domain/agents/events.ts
/**
 * Agent domain events for the sidepanel view.
 */

import type { ConversationTurn, ConversationMode } from "./types.js";

export interface AgentEventMap {
	"agent.status.changed": { agent: string; activity: string };
	"agent.message.received": { agent: string; turn: ConversationTurn };
	"agent.message.sent": { agent: string; turn: ConversationTurn };
	"agent.thinking": { agent: string; text: string };
	"agent.tool.started": { agent: string; tool: string; id: string };
	"agent.tool.completed": { agent: string; id: string };
	"agent.mode.switched": { mode: ConversationMode };
	"agent.team.toggled": { enabled: boolean };
	"agent.canvas.synced": { canvasPath: string; nodeCount: number };
}
```

- [ ] **Step 2: Add AgentEventMap to FlowtiEventMap**

In `src/infrastructure/events/events.ts`, add import at top:
```typescript
import type { AgentEventMap } from "../../domain/agents/events";
```

Add `AgentEventMap` to the `extends` list on line 111:
```typescript
export interface FlowtiEventMap extends UserEventMap, /* ...existing... */, ProcessEventMap, AgentEventMap {
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/domain/agents/events.ts" "01 - Projects/Flowti Plugin/src/infrastructure/events/events.ts"
git commit -m "feat(plugin/agents): add AgentEventMap to composite event system"
```

---

## Chunk 2: HTTP Agent Service

### Task 3: SseClient — `sse-client.ts`

**Files:**
- Create: `src/infrastructure/agents/sse-client.ts`
- Test: `tests/infrastructure/agents/sse-client.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/agents/sse-client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SseClient } from "../../../src/infrastructure/agents/sse-client.js";

// Mock global EventSource
class MockEventSource {
	url: string;
	onmessage: ((event: MessageEvent) => void) | null = null;
	onerror: ((event: Event) => void) | null = null;
	onopen: (() => void) | null = null;
	listeners = new Map<string, ((event: MessageEvent) => void)[]>();
	closed = false;

	constructor(url: string) { this.url = url; }
	addEventListener(type: string, cb: (event: MessageEvent) => void) {
		const list = this.listeners.get(type) ?? [];
		list.push(cb);
		this.listeners.set(type, list);
	}
	close() { this.closed = true; }
	simulateEvent(type: string, data: string) {
		const event = { data } as MessageEvent;
		for (const cb of this.listeners.get(type) ?? []) cb(event);
	}
}

let mockEs: MockEventSource;
vi.stubGlobal("EventSource", class { constructor(url: string) { mockEs = new MockEventSource(url); return mockEs; } });

describe("SseClient", () => {
	beforeEach(() => { mockEs = undefined as unknown as MockEventSource; });

	it("connects to the given URL", () => {
		const client = new SseClient("http://localhost:3000/events");
		client.connect();
		expect(mockEs.url).toBe("http://localhost:3000/events");
	});

	it("emits parsed events to subscribers", () => {
		const client = new SseClient("http://localhost:3000/events");
		const events: unknown[] = [];
		client.on("agent-action", (data) => events.push(data));
		client.connect();
		mockEs.simulateEvent("agent-action", JSON.stringify({ agentName: "atlas", type: "thinking" }));
		expect(events).toHaveLength(1);
	});

	it("disconnect closes EventSource", () => {
		const client = new SseClient("http://localhost:3000/events");
		client.connect();
		client.disconnect();
		expect(mockEs.closed).toBe(true);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Create `src/infrastructure/agents/sse-client.ts`**

```typescript
// src/infrastructure/agents/sse-client.ts
/**
 * SSE client for streaming events from the Flowti CLI server.
 * Wraps browser EventSource with typed event handling.
 */

type SseCallback = (data: Record<string, unknown>) => void;

export class SseClient {
	private url: string;
	private source: EventSource | null = null;
	private listeners = new Map<string, Set<SseCallback>>();

	constructor(url: string) {
		this.url = url;
	}

	connect(): void {
		this.source = new EventSource(this.url);
	}

	disconnect(): void {
		if (this.source) {
			this.source.close();
			this.source = null;
		}
	}

	on(eventType: string, callback: SseCallback): () => void {
		let set = this.listeners.get(eventType);
		if (!set) {
			set = new Set();
			this.listeners.set(eventType, set);
		}
		set.add(callback);

		// Register on EventSource if connected
		if (this.source) {
			this.source.addEventListener(eventType, (event: MessageEvent) => {
				try {
					const data = JSON.parse(event.data) as Record<string, unknown>;
					callback(data);
				} catch { /* invalid JSON */ }
			});
		}

		return () => { set?.delete(callback); };
	}

	get connected(): boolean {
		return this.source !== null;
	}
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/sse-client.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/agents/sse-client.test.ts"
git commit -m "feat(plugin/agents): add SseClient for CLI server events"
```

---

### Task 4: HttpAgentService — `http-agent-service.ts`

**Files:**
- Create: `src/infrastructure/agents/http-agent-service.ts`
- Test: `tests/infrastructure/agents/http-agent-service.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/infrastructure/agents/http-agent-service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpAgentService } from "../../../src/infrastructure/agents/http-agent-service.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(data: unknown, status = 200) {
	return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) };
}

describe("HttpAgentService", () => {
	beforeEach(() => { mockFetch.mockReset(); });

	it("connect fetches world-state and populates agents", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: {
				atlas: { id: "atlas", type: "agent", components: {
					identity: { name: "atlas", persona: "Alice", mood: "cheerful" },
					stats: { int: 16, cha: 14 },
					status: { currentAction: "idle" },
				}},
			},
		}));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const agents = service.listAgents();
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("atlas");
		expect(agents[0].persona).toBe("Alice");
		expect(agents[0].activity).toBe("idle");
	});

	it("getAgent returns single agent", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({
			entities: { atlas: { id: "atlas", type: "agent", components: {
				identity: { name: "atlas" }, status: { currentAction: "idle" },
			}}},
		}));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		expect(service.getAgent("atlas")?.name).toBe("atlas");
		expect(service.getAgent("unknown")).toBeUndefined();
	});

	it("sendMessage posts to /api/agent/send", async () => {
		mockFetch
			.mockResolvedValueOnce(jsonResponse({ entities: {} }))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		await service.sendMessage("atlas", "hello", "conversational");
		expect(mockFetch).toHaveBeenCalledWith(
			"http://localhost:3000/api/agent/send",
			expect.objectContaining({
				method: "POST",
				body: JSON.stringify({ agentName: "atlas", message: "hello" }),
			}),
		);
	});

	it("onEvent registers callbacks", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ entities: {} }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		const events: unknown[] = [];
		const unsub = service.onEvent((e) => events.push(e));
		expect(typeof unsub).toBe("function");
	});

	it("disconnect clears agents", async () => {
		mockFetch.mockResolvedValueOnce(jsonResponse({ entities: {} }));
		const service = new HttpAgentService("http://localhost:3000");
		await service.connect();
		service.disconnect();
		expect(service.listAgents()).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Create `src/infrastructure/agents/http-agent-service.ts`**

```typescript
// src/infrastructure/agents/http-agent-service.ts
/**
 * HTTP-based IAgentService that talks to the Flowti CLI server.
 *
 * Endpoints:
 * - GET  /api/world-state → agent roster
 * - POST /api/agent/send  → send message to LLM
 * - POST /api/agent/wake  → wake agent
 * - GET  /events          → SSE stream for real-time updates
 */

import type {
	IAgentService, AgentCard, ConversationTurn,
	ConversationMode, AgentServiceEvent,
} from "../../domain/agents/types.js";

interface WorldEntity {
	id: string;
	type: string;
	components: Record<string, Record<string, unknown>>;
}

function entityToCard(entity: WorldEntity): AgentCard {
	const identity = entity.components.identity ?? {};
	const stats = entity.components.stats ?? {};
	const status = entity.components.status ?? {};
	const action = String(status.currentAction ?? "idle");
	const activityMap: Record<string, AgentCard["activity"]> = {
		idle: "idle", thinking: "thinking", speaking: "speaking",
		"using-tool": "using-tool", asking: "speaking",
	};
	return {
		name: String(identity.name ?? entity.id),
		persona: identity.persona ? String(identity.persona) : undefined,
		mood: identity.mood ? String(identity.mood) : undefined,
		intStat: typeof stats.int === "number" ? stats.int : undefined,
		chaStat: typeof stats.cha === "number" ? stats.cha : undefined,
		activity: activityMap[action] ?? "idle",
	};
}

export class HttpAgentService implements IAgentService {
	private baseUrl: string;
	private agents = new Map<string, AgentCard>();
	private conversations = new Map<string, ConversationTurn[]>();
	private teamConversation: ConversationTurn[] = [];
	private subscribers = new Set<(event: AgentServiceEvent) => void>();
	private abortControllers = new Map<string, AbortController>();
	private turnCounter = 0;

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	async connect(): Promise<void> {
		const res = await fetch(`${this.baseUrl}/api/world-state`);
		if (!res.ok) return;
		const state = await res.json() as { entities: Record<string, WorldEntity> };
		for (const [id, entity] of Object.entries(state.entities ?? {})) {
			if (entity.type === "agent") {
				this.agents.set(id, entityToCard(entity));
			}
		}
	}

	disconnect(): void {
		for (const controller of this.abortControllers.values()) controller.abort();
		this.abortControllers.clear();
		this.agents.clear();
		this.conversations.clear();
		this.teamConversation = [];
	}

	listAgents(): AgentCard[] {
		return [...this.agents.values()];
	}

	getAgent(name: string): AgentCard | undefined {
		return this.agents.get(name);
	}

	async sendMessage(agent: string, message: string, mode: ConversationMode, signal?: AbortSignal): Promise<void> {
		const turn: ConversationTurn = {
			id: `turn-${++this.turnCounter}`,
			role: "user",
			content: message,
			timestamp: new Date().toISOString(),
			mode,
		};

		// Store locally
		const conv = this.conversations.get(agent) ?? [];
		conv.push(turn);
		this.conversations.set(agent, conv);
		this.teamConversation.push({ ...turn, agentName: agent });

		// Emit sent event
		this.emit({ kind: "status-changed", agent, activity: "thinking" });
		this.updateAgentActivity(agent, "thinking");

		// POST to CLI server
		await fetch(`${this.baseUrl}/api/agent/send`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ agentName: agent, message }),
			signal,
		});
	}

	async stopGeneration(agent: string): Promise<void> {
		const controller = this.abortControllers.get(agent);
		if (controller) {
			controller.abort();
			this.abortControllers.delete(agent);
		}
		this.updateAgentActivity(agent, "idle");
	}

	getConversation(agent: string): ConversationTurn[] {
		return this.conversations.get(agent) ?? [];
	}

	getTeamConversation(): ConversationTurn[] {
		return this.teamConversation;
	}

	onEvent(callback: (event: AgentServiceEvent) => void): () => void {
		this.subscribers.add(callback);
		return () => { this.subscribers.delete(callback); };
	}

	/** Called by SSE handler or polling to process server events. */
	handleServerEvent(type: string, data: Record<string, unknown>): void {
		const agent = String(data.agentName ?? "");
		if (!agent) return;

		if (type === "agent-action") {
			const actionType = String(data.type ?? "");
			if (actionType === "thinking") {
				this.emit({ kind: "thinking", agent, text: String(data.text ?? "") });
				this.updateAgentActivity(agent, "thinking");
			} else if (actionType === "speaking" || actionType === "asking") {
				const text = String(data.text ?? "");
				const turn: ConversationTurn = {
					id: `turn-${++this.turnCounter}`,
					role: "agent",
					agentName: agent,
					persona: this.agents.get(agent)?.persona,
					content: text,
					timestamp: new Date().toISOString(),
					mode: "conversational",
				};
				const conv = this.conversations.get(agent) ?? [];
				conv.push(turn);
				this.conversations.set(agent, conv);
				this.teamConversation.push(turn);
				this.emit({ kind: "message-received", agent, turn });
				this.updateAgentActivity(agent, "idle");
			} else if (actionType === "using-tool") {
				this.emit({ kind: "tool-started", agent, tool: String(data.tool ?? ""), id: String(data.id ?? "") });
				this.updateAgentActivity(agent, "using-tool");
			} else if (actionType === "tool-complete") {
				this.emit({ kind: "tool-completed", agent, id: String(data.id ?? "") });
			}
		}
	}

	private emit(event: AgentServiceEvent): void {
		for (const cb of this.subscribers) {
			try { cb(event); } catch { /* subscriber error */ }
		}
	}

	private updateAgentActivity(name: string, activity: AgentCard["activity"]): void {
		const current = this.agents.get(name);
		if (current) {
			this.agents.set(name, { ...current, activity });
			this.emit({ kind: "status-changed", agent: name, activity });
		}
	}
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/http-agent-service.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/agents/http-agent-service.test.ts"
git commit -m "feat(plugin/agents): add HttpAgentService with real CLI server integration"
```

---

## Chunk 3: ItemView Shell + Root Component + Handler + Bootstrap

### Task 5: Root Lit component — `flowti-agent-sidepanel.ts`

**Files:**
- Create: `src/components/agents/flowti-agent-sidepanel.ts`
- Test: `tests/components/agents/flowti-agent-sidepanel.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/components/agents/flowti-agent-sidepanel.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";

describe("flowti-agent-sidepanel", () => {
	let el: HTMLElement & Record<string, unknown>;

	beforeEach(() => {
		el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
		document.body.appendChild(el);
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("flowti-agent-sidepanel")).toBeDefined();
	});

	it("renders empty state when no agents", async () => {
		el.agents = [];
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("No agents");
	});

	it("renders agent count when agents provided", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("atlas");
	});

	it("dispatches agent-selected event on agent click", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-selected", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const shadow = el.shadowRoot!;
		const card = shadow.querySelector("[data-agent='atlas']") as HTMLElement;
		if (card) card.click();
		expect(detail).toEqual({ agent: "atlas" });
	});

	it("dispatches agent-send event from input", async () => {
		el.agents = [{ name: "atlas", activity: "idle" }];
		el.activeAgent = "atlas";
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		let detail: unknown = null;
		el.addEventListener("agent-send", ((e: CustomEvent) => { detail = e.detail; }) as EventListener);
		const shadow = el.shadowRoot!;
		const input = shadow.querySelector("textarea") as HTMLTextAreaElement;
		const sendBtn = shadow.querySelector("[data-action='send']") as HTMLElement;
		if (input && sendBtn) {
			input.value = "hello";
			input.dispatchEvent(new Event("input"));
			sendBtn.click();
		}
		expect(detail).toEqual({ message: "hello" });
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Create `src/components/agents/flowti-agent-sidepanel.ts`**

```typescript
// src/components/agents/flowti-agent-sidepanel.ts
/**
 * Root Lit component for the Agent Sidepanel.
 * Orchestrates layout: roster → mode bar → active mode → input bar.
 * Phase A: inline roster + input. Phase B replaces with child components.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { statusBadge } from "../shared-styles.js";
import type { AgentCard, ConversationTurn, ConversationMode } from "../../domain/agents/types.js";

export class FlowtiAgentSidepanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		agents: { type: Array },
		activeAgent: { type: String },
		activeMode: { type: String },
		turns: { type: Array },
		teamMode: { type: Boolean },
		processing: { type: Boolean },
	};

	static styles = [
		...FlowtiElement.styles,
		statusBadge,
		css`
			:host {
				display: flex;
				flex-direction: column;
				height: 100%;
				overflow: hidden;
			}

			/* ── Roster ─────────────────────────── */
			.roster {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				overflow-x: auto;
				border-bottom: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}
			.agent-card {
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				min-width: 64px;
				text-align: center;
				transition: background 0.15s;
			}
			.agent-card:hover { background: var(--background-modifier-hover); }
			.agent-card--active { background: var(--background-modifier-active-hover); }
			.agent-avatar {
				width: 32px; height: 32px;
				border-radius: 50%;
				display: flex; align-items: center; justify-content: center;
				font-weight: 700;
				font-size: var(--flowti-font-sm);
				background: var(--background-secondary);
				border: 2px solid var(--flowti-border);
			}
			.agent-avatar--thinking { border-color: var(--flowti-color-warning); animation: pulse 1.5s infinite; }
			.agent-avatar--speaking { border-color: var(--flowti-color-success); }
			.agent-avatar--using-tool { border-color: var(--flowti-color-info); }
			.agent-name { font-size: 0.75em; margin-top: 2px; }
			.agent-mood { font-size: 0.65em; color: var(--flowti-color-muted); }
			@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }

			/* ── Mode bar ───────────────────────── */
			.mode-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-bottom: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}
			.mode-btn {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				background: none; border: none;
				color: var(--flowti-color-muted);
			}
			.mode-btn:hover { background: var(--background-modifier-hover); }
			.mode-btn--active { color: var(--text-normal); background: var(--background-modifier-active-hover); }

			/* ── Conversation ────────────────────── */
			.conversation {
				flex: 1;
				overflow-y: auto;
				padding: var(--flowti-space-sm);
			}
			.turn { margin-bottom: var(--flowti-space-sm); }
			.turn--user { text-align: right; }
			.turn--agent { text-align: left; }
			.turn__bubble {
				display: inline-block;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				max-width: 85%;
				text-align: left;
				font-size: var(--flowti-font-sm);
			}
			.turn--user .turn__bubble { background: var(--interactive-accent); color: var(--text-on-accent); }
			.turn--agent .turn__bubble { background: var(--background-secondary); }
			.turn__name { font-size: 0.7em; color: var(--flowti-color-muted); margin-bottom: 2px; }

			/* ── Input bar ───────────────────────── */
			.input-bar {
				display: flex;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-sm);
				border-top: 1px solid var(--flowti-border);
				flex-shrink: 0;
			}
			.input-bar textarea {
				flex: 1;
				resize: none;
				min-height: 36px;
				max-height: 120px;
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-family: inherit;
				font-size: var(--flowti-font-sm);
			}
			.input-bar button {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border-radius: var(--flowti-radius);
				border: none;
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
				align-self: flex-end;
			}
			.input-bar button:disabled { opacity: 0.5; cursor: default; }
			.agent-label { font-size: 0.7em; color: var(--flowti-color-muted); padding: 0 var(--flowti-space-sm); }
		`,
	];

	agents: AgentCard[] = [];
	activeAgent = "";
	activeMode: ConversationMode = "conversational";
	turns: ConversationTurn[] = [];
	teamMode = false;
	processing = false;
	private inputText = "";

	protected renderContent() {
		if (this.agents.length === 0) {
			this.isEmpty = true;
			this.emptyMessage = "No agents available. Start the CLI server with 'flowti serve'.";
			return html`<div class="flowti-empty">${this.emptyMessage}</div>`;
		}
		this.isEmpty = false;

		const activeCard = this.agents.find((a) => a.name === this.activeAgent);
		const label = this.teamMode ? "Talking to team" : `Talking to ${activeCard?.persona ?? this.activeAgent}`;

		return html`
			${this.renderRoster()}
			${this.renderModeBar()}
			<div class="conversation">
				${this.turns.map((t) => this.renderTurn(t))}
			</div>
			<div class="agent-label">${label}</div>
			${this.renderInputBar()}
		`;
	}

	private renderRoster() {
		return html`
			<div class="roster">
				${this.agents.map((a) => html`
					<div
						class="agent-card ${a.name === this.activeAgent ? "agent-card--active" : ""}"
						data-agent="${a.name}"
						@click="${() => this.selectAgent(a.name)}"
					>
						<div class="agent-avatar agent-avatar--${a.activity}">
							${(a.persona ?? a.name).charAt(0).toUpperCase()}
						</div>
						<div class="agent-name">${a.persona ?? a.name}</div>
						${a.mood ? html`<div class="agent-mood">${a.mood}</div>` : nothing}
					</div>
				`)}
			</div>
		`;
	}

	private renderModeBar() {
		const modes: { id: ConversationMode; label: string }[] = [
			{ id: "document", label: "Doc" },
			{ id: "conversational", label: "Chat" },
			{ id: "canvas", label: "Canvas" },
		];
		return html`
			<div class="mode-bar">
				${modes.map((m) => html`
					<button
						class="mode-btn ${m.id === this.activeMode ? "mode-btn--active" : ""}"
						@click="${() => this.switchMode(m.id)}"
					>${m.label}</button>
				`)}
			</div>
		`;
	}

	private renderTurn(turn: ConversationTurn) {
		return html`
			<div class="turn turn--${turn.role}">
				${turn.role === "agent" ? html`<div class="turn__name">${turn.persona ?? turn.agentName ?? "Agent"}</div>` : nothing}
				<div class="turn__bubble">${turn.content}</div>
			</div>
		`;
	}

	private renderInputBar() {
		return html`
			<div class="input-bar">
				<textarea
					placeholder="Type a message..."
					.value="${this.inputText}"
					@input="${(e: Event) => { this.inputText = (e.target as HTMLTextAreaElement).value; }}"
					@keydown="${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.send(); } }}"
				></textarea>
				<button
					data-action="send"
					?disabled="${!this.inputText.trim() || this.processing}"
					@click="${() => this.send()}"
				>${this.processing ? "Stop" : "Send"}</button>
			</div>
		`;
	}

	private selectAgent(name: string) {
		this.dispatchEvent(new CustomEvent("agent-selected", { detail: { agent: name }, bubbles: true, composed: true }));
	}

	private switchMode(mode: ConversationMode) {
		this.dispatchEvent(new CustomEvent("mode-changed", { detail: { mode }, bubbles: true, composed: true }));
	}

	private send() {
		const message = this.inputText.trim();
		if (!message) return;
		this.dispatchEvent(new CustomEvent("agent-send", { detail: { message }, bubbles: true, composed: true }));
		this.inputText = "";
		this.requestUpdate();
	}
}

customElements.define("flowti-agent-sidepanel", FlowtiAgentSidepanel);
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/components/agents/flowti-agent-sidepanel.ts" "01 - Projects/Flowti Plugin/tests/components/agents/flowti-agent-sidepanel.test.ts"
git commit -m "feat(plugin/agents): add root flowti-agent-sidepanel Lit component"
```

---

### Task 6: ItemView shell — `AgentSidepanelView.ts`

**Files:**
- Create: `src/ui/agents/AgentSidepanelView.ts`
- Create: `src/ui/agents/types.ts`

- [ ] **Step 1: Create view type constant**

```typescript
// src/ui/agents/types.ts
export const VIEW_TYPE_AGENT_SIDEBAR = "flowti-agent-sidebar";
```

- [ ] **Step 2: Create the ItemView shell**

```typescript
// src/ui/agents/AgentSidepanelView.ts
/**
 * Obsidian ItemView shell for the Agent Sidepanel.
 * Mounts the root <flowti-agent-sidepanel> Lit component.
 * Handler wires data and events.
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { IAgentService } from "../../domain/agents/types";
import { VIEW_TYPE_AGENT_SIDEBAR } from "./types";

export interface AgentSidepanelDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
}

export class AgentSidepanelView extends ItemView {
	private deps: AgentSidepanelDeps;
	private dispose: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentSidepanelDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return VIEW_TYPE_AGENT_SIDEBAR;
	}

	getDisplayText(): string {
		return "Agent Panel";
	}

	getIcon(): string {
		return "bot";
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ft-agent-sidebar");
		this.contentEl.empty();

		// Dynamic import to avoid loading Lit at plugin startup
		const { mountAgentSidepanel } = await import("../../infrastructure/handlers/agent-handlers.js");
		this.dispose = mountAgentSidepanel(this.contentEl, this.deps);
	}

	async onClose(): Promise<void> {
		if (this.dispose) {
			this.dispose();
			this.dispose = null;
		}
	}
}
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/agents/AgentSidepanelView.ts" "01 - Projects/Flowti Plugin/src/ui/agents/types.ts"
git commit -m "feat(plugin/agents): add AgentSidepanelView ItemView shell"
```

---

### Task 7: Agent handler — `agent-handlers.ts`

**Files:**
- Create: `src/infrastructure/handlers/agent-handlers.ts`
- Test: `tests/infrastructure/handlers/agent-handlers.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/infrastructure/handlers/agent-handlers.test.ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../../src/components/agents/flowti-agent-sidepanel.js";
import { mountAgentSidepanel } from "../../../src/infrastructure/handlers/agent-handlers.js";
import type { IAgentService, AgentCard } from "../../../src/domain/agents/types.js";

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
});
```

- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Create `src/infrastructure/handlers/agent-handlers.ts`**

```typescript
// src/infrastructure/handlers/agent-handlers.ts
/**
 * Agent sidepanel handler — bridges Lit component ↔ EventBus ↔ IAgentService.
 *
 * Returns a dispose function for cleanup on view close.
 */

import type { IEventBus } from "../events/types";
import type { IAgentService, ConversationMode } from "../../domain/agents/types";

export interface AgentHandlerDeps {
	readonly eventBus: IEventBus;
	readonly agentService: IAgentService;
}

export function mountAgentSidepanel(container: HTMLElement, deps: AgentHandlerDeps): () => void {
	const { agentService, eventBus } = deps;
	const el = document.createElement("flowti-agent-sidepanel") as HTMLElement & Record<string, unknown>;
	const unsubscribes: (() => void)[] = [];

	// Initial state
	let activeAgent = "";
	let activeMode: ConversationMode = "conversational";

	function refresh(): void {
		const agents = agentService.listAgents();
		el.agents = agents;
		el.activeAgent = activeAgent || (agents[0]?.name ?? "");
		el.activeMode = activeMode;
		el.turns = activeAgent ? agentService.getConversation(activeAgent) : [];
	}

	// Wire custom events from component → service
	el.addEventListener("agent-selected", ((e: CustomEvent) => {
		activeAgent = String(e.detail.agent);
		void eventBus.emit("agent.status.changed", { agent: activeAgent, activity: "idle" });
		refresh();
	}) as EventListener);

	el.addEventListener("agent-send", ((e: CustomEvent) => {
		const message = String(e.detail.message);
		if (!activeAgent || !message) return;
		el.processing = true;
		void agentService.sendMessage(activeAgent, message, activeMode).finally(() => {
			el.processing = false;
			refresh();
		});
		refresh();
	}) as EventListener);

	el.addEventListener("mode-changed", ((e: CustomEvent) => {
		activeMode = e.detail.mode as ConversationMode;
		void eventBus.emit("agent.mode.switched", { mode: activeMode });
		refresh();
	}) as EventListener);

	// Wire service events → component updates
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
	});
	unsubscribes.push(unsubService);

	refresh();
	container.appendChild(el);

	return () => {
		for (const unsub of unsubscribes) unsub();
		el.remove();
	};
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/handlers/agent-handlers.ts" "01 - Projects/Flowti Plugin/tests/infrastructure/handlers/agent-handlers.test.ts"
git commit -m "feat(plugin/agents): add agent handler bridging Lit ↔ EventBus ↔ service"
```

---

### Task 8: Bootstrap + Registration

**Files:**
- Create: `src/bootstrap/agentSetup.ts`
- Modify: `src/main.ts` (add agent setup call + import)

- [ ] **Step 1: Create `src/bootstrap/agentSetup.ts`**

```typescript
// src/bootstrap/agentSetup.ts
/**
 * Agent domain bootstrap — creates HttpAgentService, registers view.
 */

import type { IEventBus } from "../infrastructure/events/types";
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { HttpAgentService } from "../infrastructure/agents/http-agent-service";
import { SseClient } from "../infrastructure/agents/sse-client";
import { AgentSidepanelView, type AgentSidepanelDeps } from "../ui/agents/AgentSidepanelView";
import { VIEW_TYPE_AGENT_SIDEBAR } from "../ui/agents/types";

export interface AgentSetupDeps {
	readonly plugin: Plugin;
	readonly eventBus: IEventBus;
	readonly cliServerUrl?: string;
}

export interface AgentSetupResult {
	readonly agentService: HttpAgentService;
	readonly sseClient: SseClient;
}

export function setupAgentDomain(deps: AgentSetupDeps): AgentSetupResult {
	const baseUrl = deps.cliServerUrl ?? "http://localhost:3000";
	const agentService = new HttpAgentService(baseUrl);
	const sseClient = new SseClient(`${baseUrl}/events`);

	// Wire SSE events → agent service
	sseClient.on("agent-action", (data) => {
		agentService.handleServerEvent("agent-action", data);
	});

	// Register view
	const viewDeps: AgentSidepanelDeps = { eventBus: deps.eventBus, agentService };
	try {
		deps.plugin.registerView(VIEW_TYPE_AGENT_SIDEBAR, (leaf: WorkspaceLeaf) =>
			new AgentSidepanelView(leaf, viewDeps),
		);
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	// Register command to open the panel
	deps.plugin.addCommand({
		id: "open-agent-panel",
		name: "Open Agent Panel",
		callback: () => {
			const leaf = deps.plugin.app.workspace.getRightLeaf(false);
			if (leaf) void leaf.setViewState({ type: VIEW_TYPE_AGENT_SIDEBAR, active: true });
		},
	});

	// Connect to CLI server (non-blocking — retries on failure)
	void agentService.connect().catch(() => { /* CLI server not running — will retry on view open */ });
	sseClient.connect();

	return { agentService, sseClient };
}
```

- [ ] **Step 2: Add agent setup to `main.ts`**

Add import near other bootstrap imports (around line 65):
```typescript
import { setupAgentDomain } from "./bootstrap/agentSetup";
```

Add to the plugin class fields (around line 158):
```typescript
private agentSetupResult?: import("./bootstrap/agentSetup").AgentSetupResult;
```

In the `onload()` method, after Phase 5 (UI) wiring (find where other setups like TrainSetup are called), add:
```typescript
// Phase 5.5 — Agent domain
this.agentSetupResult = setupAgentDomain({
	plugin: this,
	eventBus: this.eventBus,
});
```

In `onunload()`, add cleanup:
```typescript
this.agentSetupResult?.sseClient.disconnect();
this.agentSetupResult?.agentService.disconnect();
```

- [ ] **Step 3: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/bootstrap/agentSetup.ts" "01 - Projects/Flowti Plugin/src/main.ts"
git commit -m "feat(plugin/agents): bootstrap agent domain — view registration + CLI connection"
```

---

### Task 9: Quality gate

- [ ] **Step 1: Run lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/ --config configs/eslint.config.mjs`

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`

- [ ] **Step 4: Run build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`

- [ ] **Step 5: Fix any issues and commit**

---

## Phase B Context — Roster + Mode Components (Next Plan)

**Goal:** Replace the inline rendering in `flowti-agent-sidepanel` with 6 dedicated child Lit components. Each component is independently testable.

**Components to create (all in `src/components/agents/`):**

| Component | Replaces | Key behavior |
|-----------|----------|-------------|
| `flowti-agent-roster.ts` | Inline `.roster` section | Horizontal card strip, team toggle, `agent-selected`/`team-toggled` events |
| `flowti-mode-bar.ts` | Inline `.mode-bar` section | Three-button tab strip, `mode-changed` event |
| `flowti-document-mode.ts` | N/A (new) | Rich markdown rendering, `<details>` for tools, expand toggle for thinking |
| `flowti-conversational-mode.ts` | Inline `.conversation` section | Chat bubbles, auto-scroll, thinking thought bubbles |
| `flowti-canvas-mode.ts` | N/A (new) | Creates `.canvas` file per session, syncs turns as nodes, uses Obsidian vault API |
| `flowti-input-bar.ts` | Inline `.input-bar` section | Auto-growing textarea, send/stop button, agent label |

**Pattern:** Each component extends `FlowtiElement`, uses `static properties` (no decorators), overrides `renderContent()`, dispatches `CustomEvent` with `{ bubbles: true, composed: true }`.

**Refactoring approach:** The root component (`flowti-agent-sidepanel.ts`) is modified to compose child elements via `html\`<flowti-agent-roster .agents=\${this.agents}></flowti-agent-roster>\`` instead of inline rendering. The handler doesn't change — it still talks to the root component only.

**Key reference files:**
- `src/components/flowti-element.ts` — Base class (loading/error/empty states)
- `src/components/tokens.ts` — Design tokens
- `src/components/shared-styles.ts` — Shared CSS (`statusBadge`, `emptyState`)
- `src/components/analytics/flowti-analytics-dashboard.ts` — Complex component reference
- `tests/components/analytics/flowti-analytics-dashboard.test.ts` — Test pattern reference

**Canvas mode specifics:**
- Uses Obsidian's native canvas (`.canvas` JSON files)
- Canvas JSON format: `{ nodes: [...], edges: [...] }`
- Node format: `{ id, type: "text", x, y, width, height, text, color }`
- Edge format: `{ id, fromNode, toNode, fromSide, toSide }`
- File created at `.flowti/canvas/agent-{name}-{sessionId}.canvas`
- Open canvas via `app.workspace.openLinkText(canvasPath, "", true)`
- Watch for changes via `app.vault.on("modify", callback)` filtered by canvas path

**Spec:** `docs/specs/2026-03-18-agent-sidepanel-view-design.md` — Sections 2 (Roster), 3 (Modes), 4 (Input Bar)

---

## Phase C Context — Polish + Context Awareness (Final Plan)

**Goal:** Add context awareness (file tracking + diffs), multiple refinement passes for UX polish, integration testing.

**IContextProvider interface (from spec):**
```typescript
interface IContextProvider {
  getActiveFileContext(): FileContext | null;
  getDiff(sinceHash: string): FileDiff | null;
  onFileChanged(callback: (ctx: FileContext) => void): () => void;
}
interface FileContext { path: string; contentHash: string; content: string; }
interface FileDiff { path: string; previousHash: string; currentHash: string; diff: string; }
```

**Implementation approach:**
- `ObsidianContextProvider` in `src/infrastructure/agents/` — uses Obsidian's `app.workspace` active file + `app.vault.read()` for content
- Debounce file changes at 2-3 seconds using `workspace.on("file-open")` + `vault.on("modify")`
- Content hash via simple string hash (no crypto needed — just change detection)
- Diff generation: store previous content, compute simple line diff
- Wire into handler: on each `sendMessage`, include `contextProvider.getDiff()` as part of the prompt

**Polish items:**
- Markdown rendering in document mode (use Obsidian's `MarkdownRenderer.render()`)
- Syntax highlighting for code blocks
- Auto-scroll behavior in conversational mode
- Smooth activity indicator animations
- Keyboard shortcuts (Ctrl+Enter to send, Escape to stop)
- Team mode UI polish (shared thread display, agent attribution)
- SSE reconnection logic with exponential backoff

**Testing:**
- Integration test: open sidepanel → connect to mock server → send message → verify response appears
- Canvas sync test: create canvas file → add nodes → verify JSON structure
- Context awareness test: mock active file → change content → verify diff sent

**Key reference:** CLI server SSE format from `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts:124-136` (event types: `agent-action`, `entity-update`)
