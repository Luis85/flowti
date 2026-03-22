# Sidebar & Slide-Panel Redesign — Design Spec

**Date**: 2026-03-23
**Status**: Draft
**Scope**: Flowti Plugin — Game UI

## Problem

The current game UI has overlapping concerns: the Bob button floats over the council sidebar, each panel (agent detail, bob, merchant, picker, briefing) implements its own modal/overlay with separate positioning, backdrop, animation, and z-index. The roster bar wastes bottom screen space. Portraits use text letters instead of the available Ninja Adventure Faceset images.

## Goals

1. Unified sidebar rail (left, full height) with all navigation buttons
2. Single generic slide panel (right 60%) shared by all content types
3. Camera recenters into visible 40% when panel is open
4. Replace text-letter portraits with Faceset.png images (38x38 single-face PNGs)
5. Absorb roster bar functionality into roster management panel
6. Remove overlapping z-index concerns — one panel at a time

## Non-Goals

- Changing the ExcaliburJS game world rendering beyond camera offset
- Redesigning individual panel content internals (agent detail tabs, merchant categories, etc.)

---

## 1. Sidebar Rail

**Element**: `ft-game-sidebar` (replaces `ft-game-council-sidebar`)

| Property | Value |
|----------|-------|
| Position | `fixed; left: 0; top: 0; bottom: 0` |
| Width | `80px` |
| Z-Index | `90` (unchanged) |
| Background | `var(--bg-primary)` with right border `var(--border)` |
| Layout | `flex-direction: column; align-items: center; padding: 12px 0` |

### Content (top to bottom)

```
┌──────────┐
│ Slot 1   │  ← Council portrait (Faceset.png, 48x48 circle)
│ Slot 2   │     Click → open agent-detail panel
│ Slot 3   │     Empty slot: dashed border, "+" icon
│ Slot 4   │     Status dot overlay (busy/idle)
│ Slot 5   │     Need bar below portrait
├──────────┤
│ (spacer) │  ← flex-grow: 1
├──────────┤
│ 🤖 Bob   │  ← 48x48 button, gold border, pulsing dot when active
│ 👥 Roster│  ← 48x48 button, accent-blue icon
│ 🏪 Shop  │  ← 48x48 button, accent-green icon
└──────────┘
```

### Button Behavior

- Click a button → `store.setActivePanel('bob' | 'roster' | 'merchant')`
- Click the **already-active** button → `store.setActivePanel(null)` (closes panel)
- Click a council slot → `store.selectAgent(name)` which also sets `activePanel: 'agent-detail'`
- Selecting a different agent while agent-detail is open → swaps content in-place
- Active button/slot gets a left-edge highlight bar (`3px solid var(--accent-gold)`)

### Portrait Rendering

Each Faceset.png is a **38x38 single-face PNG** (not a sprite sheet). Render with a plain `<img>`:

```
Before: <div class="portrait">${initial}</div>
After:  <img class="portrait" src="${facePath}" alt="${name}" />
```

Path: `assets/Actor/Characters/${resolveCharacter(name, domain)}/Faceset.png`

Image styling: `48x48, border-radius: 50%, object-fit: cover, border: 2px solid ${trustTierColor}`, `image-rendering: pixelated` (preserve pixel-art sharpness at upscale from 38→48)

---

## 2. Slide Panel (Generic)

**Element**: `ft-game-slide-panel`

A generic container that slides in from the right. It does not know about its content — it receives a slot.

| Property | Value |
|----------|-------|
| Position | `fixed; top: 0; right: 0; bottom: 0` |
| Width | `60%` |
| Z-Index | `150` |
| Background | `var(--bg-panel)` |
| Shadow | `var(--panel-shadow)` |
| Animation | `translateX(100%) → translateX(0)` 200ms ease-out |

### Structure

```html
<ft-game-slide-panel ?open=${!!activePanel} title=${panelTitle}>
  <!-- content swapped based on activePanel -->
  ${this.renderPanelContent()}
</ft-game-slide-panel>
```

### Panel Shell

```
┌─────────────────────────────────────────────┐
│ .panel-header                               │
│  ├─ .panel-title  ("Agent Detail" / "Ask Bob" / etc.)
│  └─ .close-btn    (× button, right-aligned) │
├─────────────────────────────────────────────┤
│ .panel-body  (overflow-y: auto, flex: 1)    │
│                                             │
│  [content rendered by parent based on mode] │
│                                             │
└─────────────────────────────────────────────┘
```

### Backdrop

Left 40% of the screen — semi-transparent `rgba(0, 0, 0, 0.4)`. Click backdrop → `store.setActivePanel(null)`.

### Panel Modes

The sidebar rail (parent) decides which content to render inside the panel:

| `activePanel` value | Title | Content |
|---------------------|-------|---------|
| `'agent-detail'` | Agent name | Current agent-detail-modal internals (header + 6 tabs) |
| `'bob'` | `"Ask Bob"` | Current ask-bob internals (5 tabs) |
| `'roster'` | `"Council Roster"` | Merged council-picker + roster-bar (see §3) |
| `'merchant'` | `"Merchant Shop"` | Current merchant-panel internals |
| `'briefing'` | `"Welcome Back"` | Current briefing-panel internals |

Content swap is instant (no close-then-open animation). Panel stays open, only the body content changes.

### Content Lifecycle

Content components are **destroyed and recreated** on each swap (not hidden/shown). This is the simplest approach and matches Lit's conditional rendering (`${when(mode === 'bob', () => html`...`)}`). Persistent state (conversation history, selected tab, etc.) already lives in `DashboardStore`, so no local state is lost on swap.

Exception: `selectedTab` in agent-detail is preserved across swaps because it is stored in `DashboardStore.selectedTab`.

### Close Triggers

- Click close button
- Click backdrop
- Press Escape (handled **only** by the slide panel — content renderers must not register their own Escape handlers)
- Click active sidebar button again

---

## 3. Roster Management Panel

**Content mode**: `'roster'` inside the slide panel.

Merges the current council-picker (drag-reorder 5 slots) and roster-bar (all agents by domain) into one scrollable view.

### Layout

```
┌─────────────────────────────────────────────┐
│ COUNCIL (5 slots, horizontal, drag-reorder) │
│ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐             │
│ │ A │ │ B │ │ C │ │ + │ │ + │             │
│ └───┘ └───┘ └───┘ └───┘ └───┘             │
├─────────────────────────────────────────────┤
│ ALL AGENTS                                  │
│ ┌─────────────────────────────────────────┐ │
│ │ Search / filter input                   │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ── Engineering ──                           │
│ [NinjaBlue portrait] Agent Alpha  → idle    │
│ [NinjaGreen portrait] Agent Beta  → busy    │
│                                             │
│ ── Design ──                                │
│ [Princess portrait] Agent Gamma   → idle    │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Behavior

- **Council zone**: Same drag-reorder as current picker. Click "+" → scroll to available agents.
- **Agent list**: Grouped by domain, each row shows Faceset portrait + name + status + domain badge.
- **Click agent row** → `store.changeScene(resolveSettingForDomain(agent.domain))` + `store.selectAgent(name)` → camera follows agent in game world, panel swaps to agent-detail. This preserves the roster bar's scene-navigation (via domain-based setting resolution) + the detail view.
- **Add to council**: Drag from agent list to council zone, or click a "+" button on the agent row if council has empty slots.
- **Remove from council**: Click "×" on council slot, or drag out.

---

## 4. Camera Offset

When the slide panel opens, the visible game area shrinks from 100% to 40% (left side). The camera must recenter so the selected agent (or world center) stays visible in that 40%.

### Problem

The camera system uses `LockCameraToActorStrategy` which continuously centers the camera on the followed actor. A one-time `camera.x += offset` is overridden on the next frame. Direct camera moves fight with the strategy.

### Solution: Offset-aware follow in camera-system.ts

Add a persistent `panelOffset` property to `CameraSystem`:

```typescript
// camera-system.ts additions
private panelOffset = 0;

setPanelOffset(offset: number): void {
  this.panelOffset = offset;
}
```

Override the follow behavior to apply the offset. When `panelOffset !== 0`, replace `LockCameraToActorStrategy` with a custom strategy that centers on `actor.pos.x - panelOffset`:

```typescript
class OffsetFollowStrategy implements ex.CameraStrategy<ex.Actor> {
  constructor(public target: ex.Actor, public offset: number) {}
  action = (target: ex.Actor, cam: ex.Camera, engine: ex.Engine, elapsed: number): ex.Vector => {
    const center = target.center;  // accounts for actor dimensions
    return new ex.Vector(center.x - this.offset, center.y);
  };
}
```

When `setPanelOffset()` is called, remove the current strategy and add the offset variant (or the plain `LockCameraToActorStrategy` if offset is 0). The camera smoothly transitions because ExcaliburJS interpolates strategy targets.

**Important**: `startFollow(actor)` must be offset-aware. When `panelOffset !== 0`, `startFollow` uses `OffsetFollowStrategy` instead of `LockCameraToActorStrategy`. This avoids a race where `startFollow` (called from `createAgentSelectHandler` via `afterNextPaint`) replaces the offset strategy with a plain follow.

### Integration Point

The `DashboardStore` emits `"panel-changed"` when `activePanel` changes. The engine subscribes and adjusts the camera:

```typescript
store.addEventListener("panel-changed", (e) => {
  const panelOpen = (e as CustomEvent<{ activePanel: PanelMode | null }>).detail.activePanel !== null;
  const offset = panelOpen ? engine.halfDrawWidth * 0.5 : 0;  // ENGINE_WIDTH / 2 * 0.5
  cameraSystem.setPanelOffset(offset);
});
```

If `activePanel` changes from one mode to another (swap), no camera movement — offset is already applied. Only null↔non-null transitions trigger a strategy swap.

---

## 5. Faceset Portrait Integration

Each Faceset.png is a **38x38 single-face PNG** (verified). No sprite-sheet clipping needed.

### Where Portraits Appear

1. **Sidebar council slots** — 48x48 circle (upscaled from 38, `image-rendering: pixelated`)
2. **Agent detail panel header** — 64x64 circle
3. **Roster management agent list** — 32x32 circle (downscaled)
4. **Council zone in roster panel** — 48x48 circle

### Resolution

Existing `resolveCharacter(agentName, domain)` returns a character folder name. Portrait path:

```
assets/Actor/Characters/${characterName}/Faceset.png
```

### Fallback

If image fails to load (missing character mapping), fall back to the current text-letter circle. Use `<img onerror="this.style.display='none'" />` with a text-letter sibling that becomes visible. Validate the full character pool mapping against actual asset folders during implementation to minimize fallback usage.

---

## 6. Store Changes

Add to `DashboardStore`:

```typescript
type PanelMode = 'agent-detail' | 'bob' | 'roster' | 'merchant' | 'briefing';

// New state fields
activePanel: PanelMode | null = null;
briefingData: { results: OfflineResults; narrativeText: string } | null = null;

// New method
setActivePanel(mode: PanelMode | null): void {
  const wasOpen = this.activePanel !== null;
  const isOpen = mode !== null;
  this.activePanel = mode;
  // Only emit panel-changed on open↔close transitions (not swap)
  if (wasOpen !== isOpen) {
    this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: mode } }));
  }
  this.dispatchEvent(new Event("state-changed"));
}
```

### Modifications to existing methods

**`selectAgent(name)`**: Add `this.setActivePanel('agent-detail')` after existing side effects (process spawn, IPC messages). All existing side effects (deselectAgent on previous, getOrStartProcess, agent-selected IPC message) are preserved unchanged.

**`deselectAgent(agentName)`**: If `this.activePanel === 'agent-detail'`, also call `this.setActivePanel(null)`. This ensures closing agent-detail via any code path (backdrop click, Escape, direct deselectAgent call) clears the panel.

### Briefing data

The briefing panel receives transient `results: OfflineResults` and `narrativeText: string` that are not derived from store state. These are stored in `store.briefingData` so the panel content renderer can access them. Set by the engine lifecycle on startup:

```typescript
// engine-lifecycle.ts — on offline return
store.briefingData = { results, narrativeText };
store.setActivePanel('briefing');
```

### Briefing auto-open priority

If a briefing fires on startup while no other panel is open (the normal case), it simply opens. If somehow another panel is already active, briefing takes priority — `setActivePanel('briefing')` overwrites it. On briefing dismiss:

- Clear `store.briefingData = null`
- Call `store.setActivePanel(null)` (close panel)

The 30-second auto-dismiss timer and interaction-clears-timer behavior are preserved in the briefing content renderer, calling `store.setActivePanel(null)` instead of `panel.remove()`.

### Event ordering

`"panel-changed"` fires **before** `"state-changed"` within `setActivePanel()`. This ensures the camera system processes the offset before UI components re-render.

---

## 7. Component Lifecycle

### New Components

| Component | Replaces |
|-----------|----------|
| `ft-game-sidebar` | `ft-game-council-sidebar` |
| `ft-game-slide-panel` | (new generic shell) |
| `ft-game-roster-panel` | `ft-game-council-picker` + `ft-game-roster-bar` |

### Retired Components

| Component | Reason |
|-----------|--------|
| `ft-game-council-sidebar` | Replaced by `ft-game-sidebar` |
| `ft-game-council-picker` | Absorbed into `ft-game-roster-panel` |
| `ft-game-roster-bar` | Absorbed into `ft-game-roster-panel` |
| `ft-game-agent-detail-modal` | Content extracted into panel content renderer |
| `ft-game-merchant-panel` | Content extracted into panel content renderer |
| `ft-game-ask-bob` | Content extracted into panel content renderer |
| `ft-game-briefing-panel` | Content extracted into panel content renderer |

The internal rendering logic of each retired component moves into content renderer functions/methods, not deleted. Only the shell (positioning, backdrop, animation) is replaced by the generic slide panel.

### Engine Wiring Changes

```typescript
// Before: 7 separate component creations with individual store/eventBus/perfDashboard wiring
// After:
const sidebar = document.createElement("ft-game-sidebar");
sidebar.store = store;
sidebar.eventBus = deps.eventBus;           // Plumbed through for Bob's Systems tab
sidebar.getPerfDashboard = deps.getPerfDashboard;  // Plumbed through for Bob's perf monitoring
container.appendChild(sidebar);
// Sidebar internally creates ft-game-slide-panel and manages content
// Sidebar passes eventBus/getPerfDashboard to Bob content renderer
```

The sidebar acts as the single wiring point. Individual content renderers receive their dependencies from the sidebar, not from the engine directly.

---

## 8. Z-Index Simplification

| Layer | Z-Index | Component |
|-------|---------|-----------|
| Sidebar rail | 90 | `ft-game-sidebar` |
| Slide panel backdrop | 140 | `.panel-backdrop` |
| Slide panel | 150 | `ft-game-slide-panel` |
| Briefing (auto-open uses same panel) | 150 | Same slide panel |

All other z-index layers (200, 299, 300, 400, 500) are eliminated.

Dashboard overlays (arrows, HUD) remain at z-index 10.

---

## 9. Migration Path

Order adjusted so store changes come first (all new components depend on `activePanel`):

1. Update `DashboardStore` with `activePanel`, `briefingData`, `setActivePanel()`, and modified `selectAgent()`/`deselectAgent()`
2. Add `OffsetFollowStrategy` + `setPanelOffset()` to `camera-system.ts`; update `startFollow()` to be offset-aware
3. Create `ft-game-slide-panel` (generic shell with header, body, backdrop, Escape handler)
4. Create `ft-game-sidebar` (rail with council slots + 3 buttons, orchestrates panel content)
5. Extract content renderers from existing components into methods/functions (agent-detail, bob, merchant, briefing)
6. Create `ft-game-roster-panel` (merged council-picker + roster-bar with scene-change on agent click)
7. Add Faceset portrait loading (sidebar slots, agent-detail header, roster panel rows)
8. Wire camera offset subscription in engine (`panel-changed` → `cameraSystem.setPanelOffset()`)
9. Update engine wiring: single sidebar creation replaces 7 component creations; plumb `eventBus`/`getPerfDashboard`; **remove roster-bar from the component loop simultaneously** (do not leave both old and new coexisting)
10. Update engine-lifecycle: briefing creates `store.briefingData` + `store.setActivePanel('briefing')` instead of creating a DOM element
11. Retire old components (`council-sidebar`, `council-picker`, `roster-bar`, `agent-detail-modal`, `merchant-panel`, `ask-bob`, `briefing-panel`) and their tests
12. Update/create tests for all new and modified components
