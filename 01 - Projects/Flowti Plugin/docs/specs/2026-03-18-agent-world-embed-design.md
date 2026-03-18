# Agent World Embed — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Iteration:** 5 — Agent World
**Project:** Flowti Plugin + Flowti CLI (agents/)

## Problem

The Agent World (ExcaliburJS RPG dashboard) only runs in a browser via `flowti serve`. Users must leave Obsidian to observe their agents. The world should render directly inside the Plugin as a main-area tab — always available, even when the CLI server isn't running.

## Goals

1. **Embedded Agent World** as a main editor tab in Obsidian — full ExcaliburJS canvas with all scenes, overlays, and interactions
2. **Hybrid data strategy** — works offline (vault file), with the Plugin's own EventBus, and with the CLI server when available
3. **Minimal game changes** — scene/actor/system rendering code untouched; startup and DOM mounting adapted for container embedding
4. **Browser mode preserved** — `flowti serve` + browser continues to work exactly as today
5. **EventBus bridge** — sidepanel agent interactions update the world view in real-time without the CLI server
6. **Desktop only** — Obsidian mobile is out of scope (WebGL support varies, ExcaliburJS not tested on mobile webviews)

## Non-Goals

- Modifying ExcaliburJS game logic (scenes, movement, brain system)
- Replacing the browser mode (CLI's `flowti serve` stays independent)
- Building a new game UI (we use the existing Lit overlays)
- Running LLM inference inside the Plugin
- Obsidian mobile support

## Architecture

### Three-Layer Stack

```
┌─────────────────────────────────────────────┐
│  AgentWorldView (Obsidian ItemView)         │  Lifecycle, toolbar, container
│  ┌─────────────────────────────────────────┐│
│  │  Game Container (div#flowti-world)      ││  Scoped DOM boundary
│  │  ┌─────────────────────────────────────┐││
│  │  │  ExcaliburJS canvas                 │││  Targets container via
│  │  │  + Lit overlays (scoped to          │││  canvasElementId or
│  │  │    container, not document.body)    │││  engine.canvas.parentElement
│  │  └─────────────────────────────────────┘││
│  └─────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────┐│
│  │  WorldBridge                            ││  Data injection + event relay
│  │  - Reads world-state.json from vault    ││
│  │  - Bridges Plugin EventBus ↔ game       ││
│  │  - Connects SSE when server available   ││
│  └─────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

### Data Sources (merged by bridge into one feed)

The bridge combines all available sources. The game receives a single stream and doesn't know or care where events originate.

- **SSE live stream** — preferred when CLI server is running, real-time agent actions
- **EventBus bridge** — sidepanel interactions update world directly (no server needed)
- **Vault file** — `.flowti/var/world-state.json` read on open as baseline state

### Startup Sequence

1. View opens → read `world-state.json` from vault via Obsidian API → store as baseline
2. Create game container div with unique ID inside the view's `contentEl`
3. Set `window.__flowtiWorldBridge` with bridge instance (includes `containerElement` reference)
4. Inject `dashboard.js` → game detects bridge → calls `getWorldState()` → gets vault data
5. Bridge subscribes to Plugin EventBus → relays agent events to game callbacks
6. Bridge attempts SSE connection to CLI server (silent, non-blocking)
7. If SSE connects → server events also flow through to game
8. Status indicator updates: green (server), yellow (EventBus only), gray (vault snapshot)

## Game Container Isolation

ExcaliburJS assumes it owns the page — it targets `document.body` for the canvas, appends Lit overlays to `document.body`, and adds global keyboard/wheel listeners. Inside an Obsidian tab, all of these must be scoped to the game container.

### Canvas Targeting

The bridge exposes `containerElement` — the game container div. The game's startup code uses it:

```typescript
// Obsidian mode
const engine = new ex.Engine({
  canvasElement: bridge.containerElement.querySelector('canvas')
    ?? undefined,
  width: 800,
  height: 500,
  displayMode: ex.DisplayMode.FitContainer,
});
bridge.containerElement.appendChild(engine.canvas);
```

In browser mode (no bridge), the existing `DisplayMode.FitScreen` behavior is unchanged.

### Display Mode

Browser mode uses `FitScreen` (full viewport). Embedded mode uses `FitContainer` — the canvas sizes to its parent div. A `ResizeObserver` on the container triggers `engine.screen.resize()` when the Obsidian tab resizes (split panes, sidebar toggle, etc.).

### Lit Overlay Scoping

All Lit overlay components (roster bar, agent panel, camera HUD, chat) must append to the game container, not `document.body`. The game's overlay mounting code changes from:

```typescript
// Before: appends to body
const target = engine.canvas.parentElement ?? document.body;
```

to:

```typescript
// After: appends to bridge container or canvas parent
const target = bridge?.containerElement ?? engine.canvas.parentElement ?? document.body;
```

This is backward-compatible — in browser mode (no bridge), falls back to existing behavior.

### Keyboard & Wheel Scoping

Global `document.addEventListener("keydown"/"keyup"/"wheel")` listeners conflict with Obsidian (arrow keys navigate notes, wheel scrolls views). In embedded mode:

- Keyboard listeners attach to the game container div (which must have `tabindex="0"` for focus)
- Wheel listener attaches to the canvas element with `{ passive: false }`
- Listeners only fire when the game container or its children have focus
- Camera controls are inert when the world tab is not the active leaf

In browser mode, global listeners remain as today (backward-compatible).

### Font Loading

The game uses Google Fonts (Silkscreen) loaded via `<link>` in `index.html`. For embedded mode, the font CSS is injected as a `<style>` with a `@font-face` declaration using a bundled font file (or the font is loaded from the extracted HTML styles). If the font fails to load (offline), ExcaliburJS falls back to system monospace — acceptable degradation.

## WorldBridge Interface

Exposed on `window.__flowtiWorldBridge`. The game checks for it on startup — if present, uses it; if absent, fetches from `localhost:3000` (browser mode unchanged).

```typescript
interface WorldBridge {
  // Container — game renders into this element instead of document.body
  readonly containerElement: HTMLElement;

  // Initial state — async (vault reads are async)
  getWorldState(): Promise<WorldState | null>;

  // Live updates — bridge pushes from EventBus + SSE
  onAction(callback: (action: AgentAction) => void): () => void;
  onEntityUpdate(callback: (entity: WorldEntity) => void): () => void;

  // Commands — game calls instead of POST /api/agent/*
  sendCommand(endpoint: string, body: unknown): Promise<void>;

  // Asset base path — resolved vault path for sprite URLs
  readonly assetBasePath: string;

  // Connection status
  readonly serverOnline: boolean;

  // Teardown — game calls to clean up engine resources
  dispose(): void;
}
```

### Command Routing

The bridge exposes a single `sendCommand(endpoint, body)` method (matching the DataProvider interface). Routing:
- **Server online** → HTTP POST to CLI server
- **Server offline** → emit via Plugin EventBus

### Asset URL Resolution

Sprites use relative paths like `assets/Actor/Characters/Knight/SeparateAnim/Idle.png`. In browser mode, these resolve against `http://localhost:3000`. In embedded mode, the base URL changes.

The bridge exposes `assetBasePath` — the resolved filesystem path to `.flowti/agents/`. The game's sprite loader prefixes this path when the bridge is present:

```typescript
const basePath = bridge?.assetBasePath ?? "";
new ex.ImageSource(`${basePath}assets/Actor/Characters/${name}/SeparateAnim/Idle.png`);
```

The Plugin constructs `assetBasePath` using Obsidian's vault adapter:
```typescript
const vaultBase = (app.vault.adapter as any).basePath;
const assetBasePath = `file:///${vaultBase}/.flowti/agents/`.replace(/\\/g, "/");
```

## Game-Side Changes (CLI repo)

The game gets a pluggable data provider. Scene/actor/system code is untouched.

### New: DataProvider Interface

```typescript
// agents/src/config/data-provider.ts
interface DataProvider {
  getWorldState(): Promise<WorldState | null>;
  onAction(cb: (action: AgentAction) => void): () => void;
  onEntityUpdate(cb: (entity: WorldEntity) => void): () => void;
  sendCommand(endpoint: string, body: unknown): Promise<void>;
  readonly assetBasePath: string;
}
```

### New: Two Provider Implementations

```typescript
// agents/src/config/server-provider.ts — extracted from current main.ts HTTP+SSE code
// agents/src/config/bridge-provider.ts — thin adapter over window.__flowtiWorldBridge
```

### Modified: Startup Detection

```typescript
// agents/src/main.ts — before engine.start()
const bridge = (window as any).__flowtiWorldBridge as WorldBridge | undefined;

if (bridge) {
  // Obsidian mode — use container, FitContainer, scoped listeners
  engine = new ex.Engine({
    width: 800, height: 500,
    displayMode: ex.DisplayMode.FitContainer,
  });
  bridge.containerElement.appendChild(engine.canvas);
  provider = createBridgeProvider(bridge);
} else {
  // Browser mode — unchanged (FitScreen, global listeners)
  engine = new ex.Engine({ width: 800, height: 500, displayMode: ex.DisplayMode.FitScreen });
  provider = createServerProvider(baseUrl);
}
```

### Modified: Overlay Mounting

```typescript
// Scoped to bridge container when embedded
const overlayTarget = bridge?.containerElement ?? engine.canvas.parentElement ?? document.body;
```

### Modified: Event Listeners

```typescript
// Keyboard: scoped to container when embedded
const keyTarget = bridge ? bridge.containerElement : document;
keyTarget.addEventListener("keydown", onKeyDown);

// Wheel: scoped to canvas always (no behavior change needed)
engine.canvas.addEventListener("wheel", onWheel, { passive: false });
```

### What Does NOT Change

- Game scenes, actors, systems, brain logic
- Sprite rendering, animations, particle effects
- UI overlay components (roster bar, agent panel, camera HUD, chat)
- Build pipeline (`agents/build.mjs`)
- Browser mode startup (no bridge → existing code path)

## Teardown Lifecycle

When the Obsidian view closes (`onClose()`):

1. Call `bridge.dispose()` → bridge unsubscribes from EventBus, disconnects SSE
2. Call `engine.stop()` → stops the game loop and animation frames
3. Call `engine.dispose()` → releases WebGL context
4. Remove keyboard/wheel listeners from container
5. Remove Lit overlay elements from container
6. Revoke blob URLs created during loading
7. Delete `window.__flowtiWorldBridge`
8. Empty the container div

This prevents memory leaks across open/close cycles and releases the WebGL context for reuse.

## Pause/Resume on Tab Visibility

Obsidian tabs don't trigger `document.hidden` changes. The view uses an `IntersectionObserver` on the game container:

- **Container not visible** → `engine.stop()`, bridge buffers events (max 50, drop oldest)
- **Container becomes visible** → `engine.start()`, flush buffered events, resume rendering

This prevents the rAF loop from running when the user is on another tab.

## File Structure

### New Files (Plugin)

```
src/ui/agents/agent-world-view.ts            ← Obsidian ItemView, loads game, mounts bridge
src/infrastructure/agents/world-bridge.ts    ← WorldBridge implementation
```

### New Files (CLI agents/)

```
agents/src/config/data-provider.ts           ← Pluggable data interface
agents/src/config/bridge-provider.ts         ← Bridge-backed provider (Obsidian mode)
agents/src/config/server-provider.ts         ← HTTP+SSE provider (browser mode, extracted)
```

### Modified Files

```
src/ui/agents/types.ts                       ← adds VIEW_TYPE_AGENT_WORLD
src/bootstrap/agentSetup.ts                  ← register world view + command + ribbon
src/main.ts                                  ← onunload: detach agent-world leaves
agents/src/main.ts                           ← bridge detection, container targeting, scoped listeners
```

## Registration

- **View type:** `"flowti-agent-world"`
- **Command:** "Open agent world" (command palette)
- **Ribbon:** globe icon (`"globe"`) — opens as main editor tab
- **Singleton:** enforced via `getLeavesOfType()` check — reuses existing leaf if open
- **Persisted:** Obsidian remembers the view across restarts
- **WebGL safety:** singleton enforcement prevents multiple WebGL contexts from the game

## Connection Status Toolbar

Top bar of the world view shows a connection indicator:

| Dot Color | Label | Meaning |
|-----------|-------|---------|
| Green | Connected | SSE live from CLI server |
| Yellow | Local | EventBus only, no server |
| Gray | Snapshot | Static vault data, no live updates |

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Assets not built (`.flowti/agents/` missing) | "Agent world not built" + build button (uses server-launcher infrastructure) |
| `dashboard.js` fails to execute | Error message + reload button |
| Sprites missing | ExcaliburJS shows placeholder (built-in) |
| `world-state.json` missing | Empty world, status message: "No world state yet" |
| `world-state.json` malformed | Empty world, warning logged |
| Server drops mid-session | Status goes yellow, EventBus bridge continues |
| Font fails to load (offline) | Falls back to system monospace |
| WebGL context creation fails | Error message: "WebGL not available" |
| Repeated open/close | Teardown lifecycle prevents resource leaks |

## Testing Strategy

- **WorldBridge unit tests** — mock EventBus + SSE, verify merge logic, command routing, buffer/flush
- **agent-world-view integration test** — mock vault adapter, verify container creation, bridge mount, teardown
- **DataProvider tests (CLI)** — verify bridge-provider and server-provider implement same interface
- **Container isolation test** — verify keyboard/wheel events don't leak to parent DOM
- **Manual smoke test** — open world tab, verify game renders with vault data, resize panes, switch tabs, switch online/offline
