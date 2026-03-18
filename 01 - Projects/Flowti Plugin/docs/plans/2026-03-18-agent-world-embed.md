# Agent World Embed — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the ExcaliburJS Agent World inside the Flowti Plugin as a main editor tab, with hybrid data sourcing (vault file + EventBus + SSE).

**Architecture:** The game loads from pre-built assets in `.flowti/agents/`. A WorldBridge on `window.__flowtiWorldBridge` injects data and relays events. The game detects the bridge on startup and switches between embedded mode (FitContainer, scoped listeners) and browser mode (FitScreen, global listeners). The Plugin's AgentWorldView manages lifecycle, teardown, and pause/resume.

**Tech Stack:** ExcaliburJS (game engine), Lit (overlays), Obsidian ItemView (shell), Plugin EventBus + SSE (data)

**Spec:** `01 - Projects/Flowti Plugin/docs/specs/2026-03-18-agent-world-embed-design.md`

---

## Chunk 1: CLI Game-Side — Data Provider Extraction

These tasks modify the CLI's `agents/` directory to make the game embeddable. Browser mode stays unchanged.

### Task 1: DataProvider Interface

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/config/data-provider.ts`

- [ ] **Step 1: Create the DataProvider interface**

```typescript
// agents/src/config/data-provider.ts

import type { AgentAction, WorldState, WorldEntity } from "../data/types.js";

/**
 * Pluggable data source for the Agent World game.
 * Two implementations: ServerProvider (HTTP+SSE) and BridgeProvider (Obsidian embed).
 *
 * Extended beyond spec's 5-member interface to include:
 * - getDashboardAgents() — initial roster load (from dashboard JSON or world state)
 * - onConnectionStatus() — status changes for UI indicators
 * - start()/stop() — lifecycle management
 */
export interface DataProvider {
	getWorldState(): Promise<WorldState | null>;
	getDashboardAgents(): Promise<unknown[]>;
	onAction(cb: (action: AgentAction) => void): () => void;
	onEntityUpdate(cb: (entity: WorldEntity) => void): () => void;
	onConnectionStatus(cb: (status: string) => void): () => void;
	sendCommand(endpoint: string, body: unknown): Promise<void>;
	readonly assetBasePath: string;
	start(): Promise<void>;
	stop(): void;
}
```

**Important:** Types are in `agents/src/data/types.ts` — verify the exact exported names (`AgentAction`, `WorldState`, `WorldEntity`) match. SyncSystem uses `stop()` not `dispose()` — the DataProvider follows the same convention.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/config/data-provider.ts"
git commit -m "feat(agents): add DataProvider interface for pluggable data sourcing"
```

### Task 2: Server Provider (extract from main.ts)

Extract the existing HTTP+SSE data fetching from `agents/src/main.ts` and `agents/src/systems/sync-system.ts` into a DataProvider implementation.

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/config/server-provider.ts`
- Read: `01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts` (lines 53-160 — data loading, SSE, polling)
- Read: `01 - Projects/Flowti CLI/agents/src/main.ts` (line 70 — DashboardStore, line 634 — syncSystem.start)

- [ ] **Step 1: Create ServerProvider that wraps SyncSystem**

The server provider delegates to the existing `SyncSystem` for data fetching, SSE, and polling. It adapts SyncSystem's callback interface to DataProvider's subscription interface.

```typescript
// agents/src/config/server-provider.ts
import type { DataProvider } from "./data-provider";
import { SyncSystem } from "../systems/sync-system";

export function createServerProvider(baseUrl: string): DataProvider {
	const actionCallbacks = new Set<(action: any) => void>();
	const entityCallbacks = new Set<(entity: any) => void>();
	const statusCallbacks = new Set<(status: string) => void>();

	const syncSystem = new SyncSystem(baseUrl, {
		onAgentAction: (action) => { for (const cb of actionCallbacks) cb(action); },
		onAgentsUpdated: (agents) => { /* handled via world state */ },
		onActivityLog: () => {},
		onConnectionStatus: (status) => { for (const cb of statusCallbacks) cb(status); },
		onStateDiff: (entities) => { for (const cb of entityCallbacks) cb(entities); },
	});

	return {
		assetBasePath: baseUrl ? `${baseUrl}/` : "",
		async getWorldState() { /* fetch /api/world-state */ },
		async getDashboardAgents() { return syncSystem.start(); },
		onAction(cb) { actionCallbacks.add(cb); return () => actionCallbacks.delete(cb); },
		onEntityUpdate(cb) { entityCallbacks.add(cb); return () => entityCallbacks.delete(cb); },
		onConnectionStatus(cb) { statusCallbacks.add(cb); return () => statusCallbacks.delete(cb); },
		async sendCommand(endpoint, body) {
			await fetch(`${baseUrl}${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		},
		async start() { await syncSystem.start(); },
		stop() { syncSystem.stop(); },
	};
}
```

Adapt the exact method signatures and callback shapes by reading `sync-system.ts` carefully. The SyncSystem constructor callback names and shapes are the source of truth.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/config/server-provider.ts"
git commit -m "feat(agents): extract ServerProvider from SyncSystem"
```

### Task 3: Bridge Provider

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/config/bridge-provider.ts`

- [ ] **Step 1: Create BridgeProvider that adapts WorldBridge**

```typescript
// agents/src/config/bridge-provider.ts
import type { DataProvider } from "./data-provider";

interface WorldBridge {
	readonly containerElement: HTMLElement;
	getWorldState(): Promise<any>;
	onAction(cb: (action: any) => void): () => void;
	onEntityUpdate(cb: (entity: any) => void): () => void;
	sendCommand(endpoint: string, body: unknown): Promise<void>;
	readonly assetBasePath: string;
	readonly serverOnline: boolean;
	dispose(): void;
}

export function createBridgeProvider(bridge: WorldBridge): DataProvider {
	return {
		assetBasePath: bridge.assetBasePath,
		getWorldState: () => bridge.getWorldState(),
		getDashboardAgents: async () => {
			const state = await bridge.getWorldState();
			if (!state?.entities) return [];
			return Object.values(state.entities).filter((e: any) => e.type === "agent");
		},
		onAction: (cb) => bridge.onAction(cb),
		onEntityUpdate: (cb) => bridge.onEntityUpdate(cb),
		onConnectionStatus: () => () => {},
		sendCommand: (ep, body) => bridge.sendCommand(ep, body),
		start: async () => {},
		stop: () => bridge.dispose(),
	};
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/config/bridge-provider.ts"
git commit -m "feat(agents): add BridgeProvider for Obsidian embedding"
```

### Task 4: Refactor main.ts for Provider Detection

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`

This is the most delicate change. Read the full file before editing. The key modifications are:

- [ ] **Step 1: Add bridge detection at the top of the startup function**

Before the engine is created (before line 57), add:

```typescript
const bridge = (window as any).__flowtiWorldBridge as WorldBridge | undefined;
const embedded = !!bridge;
```

- [ ] **Step 2: Change engine creation to use FitContainer when embedded**

At lines 57-64, wrap the engine constructor:

```typescript
const engine = new ex.Engine({
	width: 800,
	height: 500,
	backgroundColor: ex.Color.fromHex("#0a0a0f"),
	displayMode: embedded ? ex.DisplayMode.FitContainer : ex.DisplayMode.FitScreen,
	antialiasing: true,
	suppressPlayButton: true,
});

if (embedded) {
	bridge!.containerElement.appendChild(engine.canvas);
}
```

- [ ] **Step 3: Scope overlay mounting to bridge container**

At line 67 (canvas parent resolution), change to:

```typescript
const canvasParent = embedded
	? bridge!.containerElement
	: engine.canvas.parentElement ?? document.body;
```

All overlay `appendChild` calls (lines 73-91) already use `canvasParent` — no further changes needed.

- [ ] **Step 4: Scope keyboard/wheel listeners**

At lines 605-631, scope to container when embedded:

```typescript
const keyTarget = embedded ? bridge!.containerElement : document;
const wheelTarget = engine.canvas;

if (embedded) {
	bridge!.containerElement.setAttribute("tabindex", "0");
	bridge!.containerElement.focus();
}

wheelTarget.addEventListener("wheel", (e) => { /* existing handler */ }, { passive: false });
keyTarget.addEventListener("keydown", (e) => { /* existing handler */ });
keyTarget.addEventListener("keyup", (e) => { /* existing handler */ });
```

- [ ] **Step 5: Use DataProvider instead of direct SyncSystem**

Replace the `syncSystem.start()` call (line 634) with:

```typescript
import { createServerProvider } from "./config/server-provider";
import { createBridgeProvider } from "./config/bridge-provider";

const provider = embedded
	? createBridgeProvider(bridge!)
	: createServerProvider(BASE_URL);

await provider.start();
```

Wire the provider's callbacks to the same systems that SyncSystem previously called directly.

**Important:** Also preserve the `syncSystem.setRoomScenes(roomScenes)` call — the provider needs to receive room scene references for domain→scene routing.

After engine creation, expose it for the Plugin view to manage lifecycle:
```typescript
if (embedded) {
	(window as any).__flowtiEngine = engine;
}
```

- [ ] **Step 6: Add ResizeObserver for embedded mode**

After engine.start(), if embedded:

```typescript
if (embedded) {
	const ro = new ResizeObserver(() => {
		engine.screen.viewport = {
			width: bridge!.containerElement.clientWidth,
			height: bridge!.containerElement.clientHeight,
		};
	});
	ro.observe(bridge!.containerElement);
}
```

- [ ] **Step 7: Verify browser mode unchanged**

```bash
cd "01 - Projects/Flowti CLI"
node configs/esbuild.config.mjs
cd agents && node build.mjs
```

Manually test: `flowti serve` should open in browser with identical behavior.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "refactor(agents): pluggable DataProvider with bridge detection for Obsidian embedding"
```

---

## Chunk 2: Plugin-Side — WorldBridge + AgentWorldView

### Task 5: VIEW_TYPE_AGENT_WORLD Constant

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/ui/agents/types.ts`

- [ ] **Step 1: Read current file and add the constant**

```typescript
export const VIEW_TYPE_AGENT_WORLD = "flowti-agent-world";
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/agents/types.ts"
git commit -m "feat(agents): add VIEW_TYPE_AGENT_WORLD constant"
```

### Task 6: WorldBridge Implementation

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/infrastructure/agents/world-bridge.ts`
- Test: `01 - Projects/Flowti Plugin/tests/infrastructure/agents/world-bridge.test.ts`

- [ ] **Step 1: Write failing tests**

Test the bridge's core behaviors:
- `getWorldState()` returns vault data when provided
- `onAction()` relays EventBus agent events to subscribers
- `onAction()` relays SSE events to subscribers (when server connected)
- `sendCommand()` routes to HTTP POST when server online
- `sendCommand()` emits via EventBus when server offline
- `dispose()` unsubscribes all listeners
- Event buffer: stores up to 50 events when paused, flushes on resume

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd "01 - Projects/Flowti Plugin"
npx vitest run tests/infrastructure/agents/world-bridge.test.ts
```

- [ ] **Step 3: Implement WorldBridge**

```typescript
// src/infrastructure/agents/world-bridge.ts

import type { IEventBus } from "../events/types";
import { SseClient } from "./sse-client";

export interface WorldBridgeConfig {
	containerElement: HTMLElement;
	eventBus: IEventBus;
	vaultBasePath: string;
	baseUrl: string;
	initialWorldState: unknown | null;
}

export class WorldBridge {
	readonly containerElement: HTMLElement;
	readonly assetBasePath: string;
	private eventBus: IEventBus;
	private baseUrl: string;
	private sseClient: SseClient;
	private worldState: unknown | null;
	private actionCallbacks = new Set<(action: unknown) => void>();
	private entityCallbacks = new Set<(entity: unknown) => void>();
	private unsubscribes: (() => void)[] = [];
	private paused = false;
	private buffer: unknown[] = [];
	private static readonly MAX_BUFFER = 50;
	serverOnline = false;

	constructor(config: WorldBridgeConfig) {
		this.containerElement = config.containerElement;
		this.eventBus = config.eventBus;
		this.baseUrl = config.baseUrl;
		this.worldState = config.initialWorldState;
		this.assetBasePath = `file:///${config.vaultBasePath}/.flowti/agents/`.replace(/\\/g, "/");

		// SSE connection (silent)
		this.sseClient = new SseClient(`${config.baseUrl}/events`);
		this.sseClient.on("agent-action", (data) => this.pushAction(data));
		this.sseClient.on("entity-update", (data) => this.pushEntity(data));

		// EventBus subscriptions — relay agent events from sidepanel
		this.subscribeEventBus();
	}

	async getWorldState(): Promise<unknown | null> {
		return this.worldState;
	}

	onAction(cb: (action: unknown) => void): () => void {
		this.actionCallbacks.add(cb);
		return () => this.actionCallbacks.delete(cb);
	}

	onEntityUpdate(cb: (entity: unknown) => void): () => void {
		this.entityCallbacks.add(cb);
		return () => this.entityCallbacks.delete(cb);
	}

	async sendCommand(endpoint: string, body: unknown): Promise<void> {
		if (this.serverOnline) {
			await fetch(`${this.baseUrl}${endpoint}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
		} else {
			// Route through EventBus for local handling
			void this.eventBus.emit("agent.command.request" as never, { endpoint, body } as never);
		}
	}

	connectServer(): void {
		this.sseClient.connect();
		// Probe server
		void fetch(`${this.baseUrl}/api/world-state`)
			.then((res) => { this.serverOnline = res.ok; })
			.catch(() => { this.serverOnline = false; });
	}

	pause(): void {
		this.paused = true;
	}

	resume(): void {
		this.paused = false;
		// Flush buffered events
		for (const event of this.buffer) {
			for (const cb of this.actionCallbacks) cb(event);
		}
		this.buffer = [];
	}

	dispose(): void {
		this.sseClient.disconnect();
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
		this.actionCallbacks.clear();
		this.entityCallbacks.clear();
		this.buffer = [];
	}

	private pushAction(data: unknown): void {
		if (this.paused) {
			this.buffer.push(data);
			if (this.buffer.length > WorldBridge.MAX_BUFFER) this.buffer.shift();
			return;
		}
		for (const cb of this.actionCallbacks) cb(data);
	}

	private pushEntity(data: unknown): void {
		for (const cb of this.entityCallbacks) cb(data);
	}

	private subscribeEventBus(): void {
		// Relay relevant agent events from Plugin EventBus to game
		const agentEvents = [
			"agent.status.changed",
			"agent.message.received",
			"agent.message.sent",
		] as const;

		for (const eventType of agentEvents) {
			this.unsubscribes.push(
				this.eventBus.on(eventType as never, (event: { payload: unknown }) => {
					this.pushAction({ type: eventType, ...event.payload as object });
				}),
			);
		}
	}
}
```

Adapt the exact EventBus event types by reading `src/domain/agents/events.ts` and `src/infrastructure/events/events.ts`.

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/infrastructure/agents/world-bridge.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/infrastructure/agents/world-bridge.ts" \
       "01 - Projects/Flowti Plugin/tests/infrastructure/agents/world-bridge.test.ts"
git commit -m "feat(agents): WorldBridge — hybrid data layer for embedded Agent World"
```

### Task 7: AgentWorldView

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts`
- Test: `01 - Projects/Flowti Plugin/tests/ui/agents/agent-world-view.test.ts`

- [ ] **Step 1: Write failing tests**

Test:
- View returns correct type/text/icon
- `onOpen()` creates game container div with `tabindex="0"`
- `onOpen()` shows error when `.flowti/agents/dashboard.js` doesn't exist
- `onOpen()` sets `window.__flowtiWorldBridge` before loading game script
- `onClose()` calls bridge.dispose(), cleans `window.__flowtiWorldBridge`, empties container
- Connection status bar renders with correct dot color

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/ui/agents/agent-world-view.test.ts
```

- [ ] **Step 3: Implement AgentWorldView**

```typescript
// src/ui/agents/agent-world-view.ts

import { ItemView } from "obsidian";
import type { WorkspaceLeaf, App } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import { WorldBridge } from "../../infrastructure/agents/world-bridge";
import { VIEW_TYPE_AGENT_WORLD } from "./types";

export interface AgentWorldViewDeps {
	readonly app: App;
	readonly eventBus: IEventBus;
	readonly baseUrl: string;
}

export class AgentWorldView extends ItemView {
	private deps: AgentWorldViewDeps;
	private bridge: WorldBridge | null = null;
	private blobUrls: string[] = [];
	private observer: IntersectionObserver | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentWorldViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string { return VIEW_TYPE_AGENT_WORLD; }
	getDisplayText(): string { return "Agent world"; }
	getIcon(): string { return "globe"; }

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		// Status bar
		const statusBar = container.createDiv({ cls: "ft-world-status" });
		statusBar.createSpan({ cls: "ft-world-dot ft-world-dot--gray" });
		statusBar.createSpan({ text: "Loading...", cls: "ft-world-status-label" });

		// Game container
		const gameEl = container.createDiv({ cls: "ft-world-container" });
		gameEl.id = "flowti-world";
		gameEl.setAttribute("tabindex", "0");

		// Read world state from vault
		const vaultBase = (this.app.vault.adapter as unknown as { basePath: string }).basePath;
		const statePath = ".flowti/var/world-state.json";
		let worldState: unknown = null;
		try {
			const raw = await this.app.vault.adapter.read(statePath);
			worldState = JSON.parse(raw);
		} catch { /* no state yet */ }

		// Check for game assets
		const dashboardPath = ".flowti/agents/dashboard.js";
		const exists = await this.app.vault.adapter.exists(dashboardPath);
		if (!exists) {
			gameEl.empty();
			const msg = gameEl.createDiv({ cls: "ft-world-empty" });
			msg.createEl("p", { text: "Agent world not built." });
			msg.createEl("p", { text: "Run the Flowti CLI build, or use flowti serve." });
			return;
		}

		// Create bridge
		this.bridge = new WorldBridge({
			containerElement: gameEl,
			eventBus: this.deps.eventBus,
			vaultBasePath: vaultBase,
			baseUrl: this.deps.baseUrl,
			initialWorldState: worldState,
		});
		(window as any).__flowtiWorldBridge = this.bridge;

		// Attempt server connection (silent)
		this.bridge.connectServer();

		// Inject Silkscreen font (offline-safe fallback for Google Fonts)
		const fontStyle = document.createElement("style");
		fontStyle.textContent = `@import url('https://fonts.googleapis.com/css2?family=Silkscreen&display=swap');`;
		gameEl.appendChild(fontStyle);

		// Load game script via blob URL
		const scriptContent = await this.app.vault.adapter.read(dashboardPath);
		const blob = new Blob([scriptContent], { type: "application/javascript" });
		const blobUrl = URL.createObjectURL(blob);
		this.blobUrls.push(blobUrl);

		const script = document.createElement("script");
		script.type = "module";
		script.src = blobUrl;
		script.onerror = () => {
			gameEl.empty();
			const msg = gameEl.createDiv({ cls: "ft-world-empty" });
			msg.createEl("p", { text: "Failed to load agent world." });
			const btn = msg.createEl("button", { text: "Reload", cls: "mod-cta" });
			btn.addEventListener("click", () => void this.onOpen());
		};
		gameEl.appendChild(script);

		// IntersectionObserver for pause/resume (engine + bridge)
		this.observer = new IntersectionObserver((entries) => {
			const engine = (window as any).__flowtiEngine;
			for (const entry of entries) {
				if (entry.isIntersecting) {
					this.bridge?.resume();
					if (engine && !engine.isRunning) engine.start();
				} else {
					this.bridge?.pause();
					if (engine?.isRunning) engine.stop();
				}
			}
		});
		this.observer.observe(gameEl);

		// Update status bar based on bridge state
		this.updateStatus(statusBar);
	}

	async onClose(): Promise<void> {
		// Stop engine (releases WebGL context + rAF loop)
		const engine = (window as any).__flowtiEngine;
		if (engine) {
			try { engine.stop(); engine.dispose(); } catch { /* best-effort */ }
			delete (window as any).__flowtiEngine;
		}

		// Teardown bridge (unsubscribes EventBus, disconnects SSE)
		if (this.bridge) {
			this.bridge.dispose();
			this.bridge = null;
		}
		delete (window as any).__flowtiWorldBridge;

		// Stop observer
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}

		// Clear status interval
		if (this.statusInterval) {
			clearInterval(this.statusInterval);
			this.statusInterval = null;
		}

		// Revoke blob URLs
		for (const url of this.blobUrls) URL.revokeObjectURL(url);
		this.blobUrls = [];

		// Empty container (removes Lit overlays + canvas)
		this.contentEl.empty();
	}

	private statusInterval: ReturnType<typeof setInterval> | null = null;

	private updateStatus(bar: HTMLElement): void {
		const update = () => {
			if (!this.bridge) return;
			const dot = bar.querySelector(".ft-world-dot");
			const label = bar.querySelector(".ft-world-status-label");
			if (!dot || !label) return;

			if (this.bridge.serverOnline) {
				dot.className = "ft-world-dot ft-world-dot--green";
				label.textContent = "Connected";
			} else if (this.bridge.hasEventBusListeners) {
				dot.className = "ft-world-dot ft-world-dot--yellow";
				label.textContent = "Local";
			} else {
				dot.className = "ft-world-dot ft-world-dot--gray";
				label.textContent = "Snapshot";
			}
		};
		update();
		this.statusInterval = setInterval(update, 5000);
	}
}
```

Note: The exact CSS classes (`ft-world-*`) should follow existing patterns. Check `css/` directory for conventions. The blob URL approach for loading the game script needs testing in Obsidian's Electron context — if it fails, fall back to injecting the script content via `new Function()` or writing to a temp file.

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/ui/agents/agent-world-view.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts" \
       "01 - Projects/Flowti Plugin/tests/ui/agents/agent-world-view.test.ts"
git commit -m "feat(agents): AgentWorldView — Obsidian ItemView shell for embedded game"
```

### Task 8: Wire into Plugin Startup

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts`
- Modify: `01 - Projects/Flowti Plugin/src/main.ts`

- [ ] **Step 1: Read current `agent-setup.ts` and add AgentWorldView registration**

Import `AgentWorldView` and `VIEW_TYPE_AGENT_WORLD`. Register the view, add a command, and export a method for opening it:

```typescript
import { AgentWorldView, type AgentWorldViewDeps } from "../ui/agents/agent-world-view.js";
import { VIEW_TYPE_AGENT_WORLD } from "../ui/agents/types.js";

// Inside setupAgentDomain():

// Register world view
const worldDeps: AgentWorldViewDeps = {
	app: deps.app,
	eventBus: deps.eventBus,
	baseUrl,
};
try {
	deps.plugin.registerView(VIEW_TYPE_AGENT_WORLD, (leaf) =>
		new AgentWorldView(leaf, worldDeps),
	);
} catch (err) {
	if (err instanceof Error && !err.message.includes("existing view type")) throw err;
}

deps.plugin.addCommand({
	id: "open-agent-world",
	name: "Open agent world",
	callback: () => openAgentWorld(deps.plugin.app),
});
```

Add the singleton open helper:

```typescript
function openAgentWorld(app: App): void {
	const existing = app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_WORLD);
	if (existing.length > 0) {
		void app.workspace.revealLeaf(existing[0]);
		return;
	}
	const leaf = app.workspace.getLeaf(true);
	void leaf.setViewState({ type: VIEW_TYPE_AGENT_WORLD, active: true });
}
```

- [ ] **Step 2: Add ribbon icon in `main.ts`**

After the existing agent panel ribbon icon:

```typescript
this.addRibbonIcon("globe", "Open agent world", () => {
	// Import openAgentWorld or inline the singleton logic
	const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_AGENT_WORLD);
	if (existing.length > 0) {
		void this.app.workspace.revealLeaf(existing[0]);
	} else {
		const leaf = this.app.workspace.getLeaf(true);
		void leaf.setViewState({ type: VIEW_TYPE_AGENT_WORLD, active: true });
	}
});
```

- [ ] **Step 3: Add VIEW_TYPE_AGENT_WORLD to onunload detach list**

In the `onunload()` method, add to the viewTypes array:

```typescript
VIEW_TYPE_AGENT_WORLD,
```

- [ ] **Step 4: Verify full build**

```bash
cd "01 - Projects/Flowti Plugin"
npm test
node esbuild.config.mjs --production --no-reports
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts" \
       "01 - Projects/Flowti Plugin/src/main.ts"
git commit -m "feat(agents): wire AgentWorldView into plugin startup — globe ribbon + command"
```

### Task 9: Integration Test & Manual Smoke Test

- [ ] **Step 1: Run full Plugin test suite**

```bash
cd "01 - Projects/Flowti Plugin"
npm test
```

Expected: 0 errors, all tests pass.

- [ ] **Step 2: Build both projects**

```bash
cd "01 - Projects/Flowti CLI"
node configs/esbuild.config.mjs
cd agents && node build.mjs

cd "01 - Projects/Flowti Plugin"
node esbuild.config.mjs --production --no-reports
```

- [ ] **Step 3: Manual smoke test in Obsidian**

1. Reload Plugin
2. Click globe ribbon icon → Agent World tab opens
3. Verify game canvas renders with vault world state
4. Verify status indicator shows yellow (local) or gray (snapshot)
5. Start CLI server (`flowti serve`) → verify status goes green
6. Open Agent Sidepanel → send a message → verify world view updates
7. Close world tab → reopen → verify no resource leaks
8. Switch between tabs → verify game pauses/resumes

- [ ] **Step 4: Final commit with test results**

Commit any remaining test fixes or adjustments with specific file paths.
