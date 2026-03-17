# Lit UI Refactor + Direction Arrow Indicator

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Agent dashboard (`agents/` subproject in the ExcaliburJS worktree)

## Summary

Replace all vanilla DOM UI in the agent dashboard with Lit web components. Add a per-agent direction arrow indicator as a DOM overlay. Introduce a reactive dashboard store as the single source of truth between the ExcaliburJS engine and Lit components.

## Architecture

Three layers with clear boundaries:

```
ExcaliburJS Engine (canvas)
  └─ Agents, scenes, brain/bubble/talk systems — movement & game logic only

Lit UI Layer (DOM overlays on top of canvas)
  └─ <dashboard-overlays>  — direction arrows, per-agent HUD
  └─ <agent-panel>         — tabbed detail panel
  └─ <roster-bar>          — bottom bar with domain agent cards
  └─ <camera-hud>          — follow indicator

Dashboard Store (reactive state)
  └─ Single store object, fed by SyncSystem
  └─ Lit components observe store and re-render automatically
  └─ Store exposes action methods for API calls
```

**Key rule:** Lit components never import ExcaliburJS. They only know about the store and typed data interfaces.

A thin adapter in `main.ts` bridges the engine and UI:
- Reads agent positions from ExcaliburJS each frame, converts via `engine.worldToScreenCoordinates()`, pushes to store
- Forwards agent clicks, panel open/close, and scene changes between layers

## Dashboard Store

A single reactive class extending `EventTarget`:

```
DashboardStore
  ├─ agents: DashboardAgent[]
  ├─ agentPositions: Map<name, {x, y}>       — screen coords, updated per frame
  ├─ agentTargets: Map<name, {x, y} | null>   — walk target screen coords
  ├─ agentStates: Map<name, BrainState>
  ├─ selectedAgent: string | null
  ├─ selectedTab: TabName | null               — externally-driven tab switching
  ├─ followedAgent: string | null              — camera follow target
  ├─ connectionStatus: "connected" | "disconnected" | "reconnecting"
  ├─ activityLog: ActivityEntry[]
  ├─ permissions: Map<name, PermissionEntry[]>
  ├─ conversations: Map<name, ConversationTurn[]> — chat thread per agent
  └─ llmStatus: Map<name, "dormant" | "waking" | "active" | "none">
```

**Change notification:** Store dispatches `"state-changed"` on every mutation. Lit components subscribe in `connectedCallback` and call `this.requestUpdate()`.

**Data sources:**
- SyncSystem callbacks (`onAgentsUpdated`, `onActivityLog`, `onConnectionStatus`, `onAgentAction`) write to the store
- Brain system frame update pushes `agentPositions`, `agentTargets`, and `agentStates`

### Store Action Methods

The store exposes methods for UI-triggered actions. Lit components call these instead of importing API modules directly:

```
store.sendMessage(agentName, text)     → calls api-client.sendMessage, appends user turn to conversations, shows thinking
store.assignTask(agentName, task)      → calls api-client.assignTask
store.grantPermission(agentName, ...)  → calls api-client.grantPermission
store.wakeAgent(agentName)             → calls api-client.wakeAgent, sets llmStatus to "waking"
store.selectAgent(agentName | null)    → sets selectedAgent, triggers panel open/close
store.selectTab(tabName)               → sets selectedTab for external tab switching
store.startFollow(agentName)           → sets followedAgent (main.ts listens and drives camera)
store.stopFollow()                     → clears followedAgent
store.changeScene(targetScene)         → dispatches "scene-change" event (main.ts listens)
```

This keeps all API wiring in the store. Components are pure views that read state and call store methods.

### Pushing SSE Responses Into Components

When an SSE agent action arrives (speaking, asking, etc.):
1. `main.ts` receives the action via SyncSystem
2. Calls `store.pushAgentResponse(agentName, text)` which appends to `conversations` and clears thinking state
3. `<panel-talk>` observes `conversations` and re-renders — no DOM querySelector needed
4. If the action requires tab switching (e.g., `requesting-permission` → Permissions tab): `main.ts` calls `store.selectTab("Permissions")`

The store mediates all push notifications. No code ever reaches into Shadow DOM.

### LLM Status

Per-agent lifecycle tracking:
- `"none"` — NPC agent, no LLM
- `"dormant"` — AI agent, LLM not running
- `"waking"` — wake request sent, waiting for greeting
- `"active"` — LLM process running, responsive

Powers both the badge indicator on the agent and the chat panel status.

## Lit Components

### `<dashboard-overlays>`

Renders all direction arrows in a single component.

- Subscribes to `agentPositions`, `agentTargets`, `agentStates`
- Observes store changes each frame (no separate `requestAnimationFrame` — the store update from the engine's `postframe` hook triggers re-render)
- Arrow rotation: `Math.atan2(target.y - pos.y, target.x - pos.x)`
- Arrow appears with `transition: opacity 0.3s` when walking, hidden when idle
- Arrow visual: ~6px CSS triangle, semi-transparent, positioned ~20px below agent center (at feet)
- Arrow visibility rule: shown when `agentTargets.get(name)` is non-null (covers wandering, walking-to, and on-break moving phase)
- Arrow size and offset are fixed pixel values — they do not scale with zoom

### `<roster-bar>`

Bottom bar with domain-assigned agent cards.

- Subscribes to `agents`
- Each card: status dot, truncated name, location label
- Click calls `store.changeScene(setting)` to navigate to the agent's room scene
- Hover brightens background, pointer cursor

### `<agent-panel>`

Detail panel opened when an agent is selected.

- Subscribes to `selectedAgent` and `selectedTab`
- Contains 5 sub-components as tabs:
  - `<panel-info>` — persona, attributes grid (STR/INT/WIS/CHA/DEX/CON), mood, experience, status, skills list, relationships list, empty state
  - `<panel-talk>` — chat thread, input, thinking indicator, LLM status badge
  - `<panel-tasks>` — task list with status badges, assign button with confirmation dialog for AI agents, suggested tasks
  - `<panel-permissions>` — pending permission requests with allow/deny, grant history
  - `<panel-history>` — timestamped activity log entries
- Shadow DOM with encapsulated styles
- When `selectedTab` changes in store, the panel switches to that tab (enables external tab switching from SSE events)

### `<panel-talk>` (most complex)

- Renders conversation from `store.conversations.get(agentName)`
- Input field: on send, calls `store.sendMessage(agentName, text)`
- Store handles: appending user turn, setting thinking state, calling API, appending agent response when it arrives
- Thinking indicator: single line cycling filler phrases ("Thinking...", "Connecting to LLM...", "Generating response...", "Almost there...")
- LLM status badge reads `store.llmStatus.get(agentName)`: active (green dot), waking (amber dot), dormant (gray dot), none (hidden)
- On send, dispatches `"agent-message-sent"` event on the store so `main.ts` can trigger bubble + silence talk engine

### `<camera-hud>`

- Shows "Following: AgentName [x]" when camera is locked to an agent
- Subscribes to `followedAgent`
- Close button calls `store.stopFollow()`

## Direction Arrow Detail

Data flow:

1. Brain system sets `entry.targetPos` when agent starts walking
2. Frame adapter in `main.ts` pushes each frame via `engine.on("postframe")`:
   - `agentPositions` — screen coords via `engine.worldToScreenCoordinates(actor.pos)`
   - `agentTargets` — screen coords of target (or `null` when idle)
3. Store dispatches `"state-changed"`, `<dashboard-overlays>` re-renders

Arrow spec:
- ~6px CSS triangle, semi-transparent white
- Positioned at agent's feet (~20px below sprite center)
- `transition: opacity 0.3s` for fade in/out
- Only visible while agent has a non-null target

## Styling

- **Shadow DOM** for all components — full style encapsulation
- **`shared-styles.ts`** exports common Lit `css` tagged templates:
  - CSS reset (`box-sizing: border-box`, margin/padding reset) — applied in every component since Shadow DOM does not inherit the global reset from `index.html`
  - Color palette tokens (`--slate-900`, etc.)
  - Font stack
  - Common patterns (buttons, inputs, scrollable areas)
- No global stylesheet injection — `panel-styles.ts` is deleted

## Utilities

**`data/message-utils.ts`** — extracted from the old `talk-tab.ts`:
- `extractAgentMessage(raw: string): string` — strips markdown fences, extracts JSON message field
- Used by the store's `pushAgentResponse` method and by `main.ts` when processing SSE actions for bubble text
- Pure function, no DOM or Lit dependency

## Migration

### Deleted Files (8)

```
ui/panel-manager.ts
ui/panel-styles.ts
ui/agent-panel.ts
ui/talk-tab.ts
ui/tasks-tab.ts
ui/permissions-tab.ts
ui/history-tab.ts
ui/roster-bar.ts
```

### New Files (13)

```
store/dashboard-store.ts
data/message-utils.ts
ui/shared-styles.ts
ui/dashboard-overlays.ts
ui/roster-bar.ts
ui/camera-hud.ts
ui/agent-panel.ts
ui/panel-info.ts
ui/panel-talk.ts
ui/panel-tasks.ts
ui/panel-permissions.ts
ui/panel-history.ts
```

### Modified Files

- **`main.ts`** — remove all DOM creation and callback wiring; add store creation, sync→store bridge, frame adapter, mount Lit components; listen to store events for scene changes, camera follow, bubble triggers
- **`package.json`** — add `lit` dependency
- **`index.html`** — no changes needed (Lit registers custom elements via JS)

### Build

Same esbuild pipeline. Lit's decorators work with standard TypeScript (ES2022 target, no `experimentalDecorators` needed). esbuild bundles Lit as part of the dashboard.js output.

## Testing

Existing UI tests (`agent-panel.test.ts`, `talk-tab.test.ts`, `tasks-tab.test.ts`, `permissions-tab.test.ts`) are deleted with their source files. New tests use vitest + jsdom:
- Store tests: pure unit tests, no DOM needed
- Component tests: register custom elements, render into a container, assert shadow DOM content
- `@lit-labs/testing` is not required — basic `el.shadowRoot.querySelector()` assertions in jsdom are sufficient for the component complexity we have

## Non-Goals

- No animation/direction sprite logic (stripped, will be re-added later)
- No narrator (Bob) system — separate feature
- No new server-side changes
