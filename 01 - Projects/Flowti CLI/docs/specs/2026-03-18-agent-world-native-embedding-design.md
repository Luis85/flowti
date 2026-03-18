# Agent World Native Embedding — Design Spec

**Date:** 2026-03-18
**Status:** Draft
**Scope:** Migrate the ExcaliburJS Agent World game from a CLI-hosted HTML/JS artifact into a native TypeScript module inside the Flowti Plugin.

## Problem

The Agent World game currently lives in `01 - Projects/Flowti CLI/agents/` as a standalone browser app. The plugin loads it via blob URL script injection inside an Obsidian ItemView. This causes:

- **Electron protocol blocks** — `file:///` and relative asset paths fail inside blob-origin script contexts. Sprites return `ERR_FILE_NOT_FOUND`.
- **Stale engine leaks** — blob-loaded scripts persist across view open/close cycles, producing dual engine instances and `MotionSystem.update` crashes.
- **Window global coupling** — `window.__flowtiWorldBridge` and `window.__flowtiEngine` create fragile, implicit contracts between the plugin and game.
- **Build chain complexity** — two separate build steps (CLI agents build + plugin build), two package.json files, two TypeScript configs, all to produce one user-facing feature.

## Solution

Make the game a native TypeScript module inside the plugin. Import it, compile it, render it — no blob URLs, no script injection, no window globals. The CLI retains ownership of data generation (agent roster, world state) and optional live event streaming.

## Architecture

### Directory Structure

```
01 - Projects/Flowti Plugin/
├── assets/
│   └── Actor/Characters/           ← sprite PNGs (moved from CLI agents/)
│       ├── Boy/SeparateAnim/{Idle.png, Walk.png}
│       ├── NinjaBlue/SeparateAnim/{Idle.png, Walk.png}
│       └── ... (86+ characters, ~172 files)
├── src/
│   ├── game/
│   │   ├── engine.ts               ← factory entry point
│   │   ├── actors/
│   │   │   ├── agent-actor.ts
│   │   │   ├── bubble-actor.ts
│   │   │   ├── workstation-actor.ts
│   │   │   ├── doorway-actor.ts
│   │   │   └── scene-backgrounds.ts
│   │   ├── brain/
│   │   │   ├── agent-brain.ts
│   │   │   ├── brain-types.ts
│   │   │   └── movement.ts
│   │   ├── config/
│   │   │   ├── settings.ts
│   │   │   ├── domain-map.ts
│   │   │   ├── data-provider.ts    ← DataProvider interface (kept from CLI)
│   │   │   └── plugin-provider.ts  ← replaces ServerProvider + BridgeProvider
│   │   ├── data/
│   │   │   ├── types.ts            ← includes ConnectionStatus (merged from event-stream.ts)
│   │   │   ├── api-client.ts       ← optional server commands
│   │   │   └── message-utils.ts
│   │   ├── scenes/
│   │   │   ├── hub-scene.ts
│   │   │   ├── room-scene.ts
│   │   │   ├── office-scene.ts
│   │   │   ├── village-scene.ts
│   │   │   └── station-scene.ts
│   │   ├── sprites/
│   │   │   ├── character-pool.ts
│   │   │   └── sprite-loader.ts
│   │   ├── store/
│   │   │   └── dashboard-store.ts
│   │   ├── systems/
│   │   │   ├── brain-system.ts
│   │   │   ├── bubble-system.ts
│   │   │   ├── camera-system.ts
│   │   │   ├── emote-system.ts
│   │   │   ├── particle-system.ts
│   │   │   ├── social-system.ts
│   │   │   └── talk/
│   │   │       ├── talk-engine.ts
│   │   │       ├── talk-types.ts
│   │   │       └── templates/      ← 6 domain conversation scripts
│   │   └── ui/
│   │       ├── game-styles.ts      ← dark pixel-art palette (was shared-styles.ts)
│   │       ├── dashboard-overlays.ts
│   │       ├── agent-panel.ts
│   │       ├── panel-info.ts
│   │       ├── panel-talk.ts
│   │       ├── panel-tasks.ts
│   │       ├── panel-permissions.ts
│   │       ├── panel-history.ts
│   │       ├── roster-bar.ts
│   │       ├── camera-hud.ts
│   │       └── ask-bob.ts
│   └── ui/agents/
│       ├── agent-world-view.ts     ← rewritten (no blob URLs)
│       └── types.ts                ← unchanged
└── tests/
    └── game/                       ← mirrors src/game/
```

### Entry Point: `engine.ts`

The game's entry point changes from a self-executing `main()` to an exported factory:

```typescript
export interface AgentWorldDeps {
  container: HTMLElement;
  provider: DataProvider;
  spriteBasePath: string;
}

export interface AgentWorldHandle {
  start(): Promise<void>;
  pause(): void;             // pause engine + systems (tab hidden)
  resume(): void;            // resume engine + systems (tab visible)
  dispose(): void;           // full teardown (view closed)
}

export function createAgentWorld(deps: AgentWorldDeps): AgentWorldHandle;
```

The factory creates the ExcaliburJS engine, scenes, systems, Lit overlays, and returns a handle for lifecycle control. No window globals. No self-detection of embedding mode.

**Internal to the factory:**
- **ResizeObserver** — watches the container element and updates `engine.screen.viewport` on size changes. Created in `start()`, disconnected in `dispose()`.
- **Keyboard listeners** — scoped to the container element (not `document`) to avoid conflicts with Obsidian hotkeys. Container gets `tabindex="0"` for focus.
- **Silkscreen font** — the `<link>` element for Google Fonts is injected into the container by the factory during `start()`, not by the view.

### AgentWorldView (Rewritten)

The Obsidian ItemView simplifies to:

```typescript
async onOpen(): Promise<void> {
  // 1. Create status bar + container div
  // 2. Create PluginProvider from vault adapter + EventBus
  // 3. Resolve sprite path: vault.adapter.getResourcePath(".obsidian/plugins/flowti-ibde/assets/Actor/Characters")
  // 4. this.handle = createAgentWorld({ container, provider, spriteBasePath })
  // 5. await this.handle.start()
  // 6. Set up IntersectionObserver for pause/resume
}

async onClose(): Promise<void> {
  // 1. this.handle.dispose()
  // 2. observer.disconnect()
  // 3. contentEl.empty()
}
```

Eliminated: blob URL creation/revocation, `window.__flowtiWorldBridge`, `window.__flowtiEngine`, script element injection, status polling interval.

**Sprite path resolution** uses the plugin's manifest directory rather than a hard-coded path:

```typescript
const pluginDir = this.app.vault.configDir + "/plugins/" + this.manifest.id;
const spriteBase = this.app.vault.adapter.getResourcePath(
  pluginDir + "/assets/Actor/Characters"
);
```

This avoids coupling to the output directory name.

### Data Provider: PluginProvider

Single implementation replacing both `ServerProvider` and `BridgeProvider`:

```typescript
export interface PluginProviderDeps {
  vaultAdapter: {
    exists(path: string): Promise<boolean>;
    read(path: string): Promise<string>;
  };
  eventBus: IEventBus;
  sseClient?: SseClient;
  serverBaseUrl?: string;
}
```

**PluginProvider implements the full `DataProvider` interface:**

| Method | Implementation |
|--------|---------------|
| `getWorldState()` | Read + parse `.flowti/var/world-state.json` via vault adapter |
| `getDashboardAgents()` | Read + parse `.flowti/agents/data/agent-dashboard.json` via vault adapter |
| `onAction(cb)` | Subscribe to EventBus events + optional SSE `agent-action` events |
| `onEntityUpdate(cb)` | Subscribe to EventBus events + optional SSE `entity-update` events |
| `onConnectionStatus(cb)` | Emit based on EventBus/SSE state |
| `sendCommand(endpoint, body)` | REST fetch if `serverBaseUrl` provided, else emit via EventBus |
| `assetBasePath` | Not used (sprites loaded via `app://` protocol directly) |
| `start()` | Read vault files, subscribe EventBus, optionally connect SSE |
| `stop()` | Unsubscribe EventBus, disconnect SSE |

**Primary data source: vault files (no server required).**

| Data | Source | Vault Path |
|------|--------|------------|
| Agent roster | Vault file | `.flowti/agents/data/agent-dashboard.json` |
| World state | Vault file | `.flowti/var/world-state.json` |
| Agent actions | EventBus | `agent.status.changed`, `agent.message.*` |
| Send commands | REST fetch | Optional, only if `serverBaseUrl` provided |

**Optional live enhancement:** When the CLI server is running, `sseClient` connects to `/events` for real-time `agent-action` and `entity-update` events. These supplement EventBus events. Connection failure is silent — the game functions fully from vault files alone.

**Connection status:** Exposed as a property — `offline` (no EventBus listeners), `local` (EventBus only), `server` (SSE connected).

### Sprite Bundling

**Source of truth:** `01 - Projects/Flowti Plugin/assets/Actor/Characters/`

Sprite PNGs move from the CLI's `agents/assets/` to the plugin's source tree. Only `Idle.png` and `Walk.png` per character are included (~172 files, ~200-400KB total).

**Build-time copy:** The plugin's `esbuild.config.mjs` copies sprites to the output directory:

```
Source: assets/Actor/Characters/*/SeparateAnim/{Idle.png, Walk.png}
Target: .obsidian/plugins/flowti-ibde/assets/Actor/Characters/*/SeparateAnim/{Idle.png, Walk.png}
```

**Runtime loading:** `AgentWorldView` resolves the sprite path dynamically using the plugin's manifest directory (see AgentWorldView section above). ExcaliburJS `ImageSource` loads sprites via the resulting `app://` URL — no CORS issues, no Electron CSP blocks, no server dependency.

### File Disposition (CLI agents/ → Plugin)

Files that are **not** in the directory structure above are explicitly dropped or merged:

| CLI File | Disposition | Reason |
|----------|-------------|--------|
| `config/data-provider.ts` | **Migrated** to `src/game/config/data-provider.ts` | Interface kept, consumed by engine.ts |
| `config/server-provider.ts` | **Deleted** | Replaced by PluginProvider |
| `config/bridge-provider.ts` | **Deleted** | Replaced by PluginProvider |
| `data/event-stream.ts` | **Deleted** — `ConnectionStatus` type merged into `data/types.ts` | Plugin uses its own SSE client; only the type is needed |
| `data/state-store.ts` | **Deleted** | Vault adapter reads state directly; no in-memory diff store needed |
| `systems/sync-system.ts` | **Deleted** | Orchestration logic absorbed by PluginProvider |

### Lit Components

The 11 game UI components migrate to the plugin's `FlowtiElement` base class:

- **Prerequisite:** The plugin already has a `FlowtiElement` base class at `src/components/flowti-element.ts`. All existing plugin components extend it.
- `extends LitElement` → `extends FlowtiElement`
- Game-specific dark-theme CSS stays scoped in each component's `static styles`
- The CLI's `shared-styles.ts` becomes `src/game/ui/game-styles.ts` — a composable Lit CSS module with the dark pixel-art palette
- Components use plugin design tokens where appropriate, game-specific colors where not

Shadow DOM encapsulation ensures the game's dark aesthetic doesn't leak into Obsidian's UI. Custom element tag names are prefixed with `ft-game-` (e.g., `ft-game-roster-bar`, `ft-game-agent-panel`) to follow the plugin's `ft-` prefix convention and avoid collision with other Obsidian plugins.

### Build Pipeline

**Plugin `package.json`** — one new dependency:

```json
"excalibur": "^0.32.0"
```

**Plugin `esbuild.config.mjs`** — two additions:

1. ExcaliburJS is bundled into `main.js` (not externalized). Adds ~500-700KB to the output. **CJS bundling note:** The plugin builds with `format: "cjs"`, `platform: "node"`. ExcaliburJS expects browser globals (`document`, `window`, `canvas`, `WebGL`). This works because Obsidian runs in Electron where both Node.js and DOM APIs are available. If tree-shaking issues arise, `platform: "neutral"` or targeted `define` entries may be needed — validate during implementation.
2. Sprite copy step after `syncAssets()` — copies `assets/Actor/Characters/*/SeparateAnim/{Idle.png,Walk.png}` to the output directory. Runs in both production and watch mode.

**Plugin `tsconfig.json`** — no changes. The `src/game/` directory is covered by the existing include pattern.

## Deletions

### From CLI

| Item | Lines | Reason |
|------|-------|--------|
| `agents/` entire directory | 7,369 | Game code moved to plugin |
| `agents/assets/` | N/A | Sprites moved to plugin |
| `agents/build.mjs` | 66 | No standalone build |
| `agents/index.html` | ~30 | No standalone entry |
| `agents/package.json`, `tsconfig.json` | ~30 | No separate project |
| Dashboard build logic in `dashboard-service.ts` | ~100 | No more dashboard artifact build |
| Static file serving for sprites/HTML in `static-server.ts` | ~50 | Server only needs API + SSE |

**Kept in CLI:**
- `regenerateDashboardData()` — writes `agent-dashboard.json`
- World state manager — writes `world-state.json`
- SSE `/events` endpoint — optional live enhancement
- REST API — optional agent commands

### From Plugin

| Item | Lines | Reason |
|------|-------|--------|
| `src/infrastructure/agents/world-bridge.ts` | 179 | No more bridge indirection |
| `tests/infrastructure/agents/world-bridge.test.ts` | 270 | WorldBridge deleted |
| Blob URL machinery in `agent-world-view.ts` | ~100 | Rewritten |

## Testing

Test files mirror `src/game/` under `tests/game/`:

| Area | Approach |
|------|----------|
| Brain, movement, character-pool, store, talk templates | Direct testing, no mocks — pure domain logic |
| ExcaliburJS actors/scenes | Mock `ex.Engine`, `ex.Actor`. Test config (collisionType, position, sprites), not engine internals |
| PluginProvider | Mock vault adapter, EventBus, fetch. Test vault reads, event relay, graceful degradation |
| Lit components | happy-dom environment. Test rendering, event dispatch, store binding |
| `engine.ts` | Integration test with mocked engine. Verify wiring: systems created, provider started, sprites loaded |
| `agent-world-view.ts` | Test `createAgentWorld()` called with correct deps, `handle.dispose()` called on close |

**Note:** The CLI `agents/` has zero existing tests. All game test files are net-new authoring, not migration of existing tests.

**Coverage target:** 80% statements, 80% lines (plugin convention).

## Size Impact

| Metric | Change |
|--------|--------|
| Plugin source | +~7,400 lines (54 files in `src/game/`) |
| Plugin `main.js` | +~700-900KB (ExcaliburJS + game code) |
| Plugin assets | +~172 sprite PNGs (~200-400KB) |
| Plugin test files | +~54 new test files |
| CLI source | -~7,600 lines (agents/ directory + dashboard build logic) |

## Data Flow Summary

```
┌─ Vault Files (primary) ──────────┐
│  .flowti/agents/data/            │
│    agent-dashboard.json          │
│  .flowti/var/                    │
│    world-state.json              │
└──────────────┬───────────────────┘
               │ read on start()
               ▼
        ┌──────────────┐     ┌─ EventBus ─────────┐
        │ PluginProvider│◄────│ agent.status.changed│
        │              │     │ agent.message.*     │
        │              │     └─────────────────────┘
        │              │
        │              │◄──── SSE (optional, if server running)
        └──────┬───────┘
               │
    ┌──────────▼──────────────────────┐
    │  createAgentWorld()             │
    │  ├── ExcaliburJS Engine         │
    │  ├── Scenes (hub, rooms)        │
    │  ├── Systems (brain, bubble...) │
    │  ├── Lit Overlays               │
    │  └── DashboardStore             │
    └──────────┬──────────────────────┘
               │ canvas + overlays
               ▼
    ┌─────────────────────┐
    │ AgentWorldView      │
    │ (Obsidian ItemView) │
    │ .ft-world-container │
    └─────────────────────┘
```
