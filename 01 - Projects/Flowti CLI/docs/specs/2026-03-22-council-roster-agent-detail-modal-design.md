# Council Roster & Agent Detail Modal — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Project:** Flowti Plugin (Agent World)

---

## Overview

Replace the existing right-side agent detail panel with two new systems:

1. **Council Sidebar** — A persistent left-edge vertical bar showing up to 5 selected agents ("The Council") with RPG-style portraits and vital stats.
2. **Agent Detail Modal** — A split-screen overlay (right 60% of viewport) that replaces the current `agent-panel.ts`. Contains all agent internals: profile, LLM chat, behavior tree visualization, tasks, permissions, and debug tools.

A **Roster Picker** modal lets the user compose their Council of 5 from all available agents.

Any agent can be inspected via the detail modal — Council members are quick-access, but clicking any agent in the world opens the same modal.

---

## Architecture: Progressive Replacement

New components are built alongside the existing agent panel. The old panel is retired once the modal is stable. Existing sub-components (`panel-vitals.ts`, `panel-economy.ts`, `panel-talk.ts`, `panel-tasks.ts`, `panel-permissions.ts`, `panel-debug.ts`) are reused inside the modal's tab sections.

---

## 1. Council Sidebar

**Component:** `council-sidebar.ts`

### Layout
- Position: `fixed`, left edge, full height (minus bottom roster bar)
- Width: ~80px
- Z-index: 90 (below camera HUD at 100)
- 5 vertical slots, evenly spaced
- "Manage" button at bottom opens the Roster Picker

### Each Council Slot
- Agent portrait: circular sprite thumbnail from character registry
- Gold border for filled slots; trust tier modulates ring color (supervised=gray, trusted=blue, autonomous=gold)
- Name label: truncated, 10px font
- Dominant need bar: smallest of the 6 needs (energy/hunger/thirst/focus/social/morale) rendered as a tiny HP-style bar
- Status dot: green=idle, amber=busy, gray=unassigned — overlaid on portrait corner
- Empty slots: dashed circle with "+" icon

### Interactions
- Click filled slot → opens Agent Detail Modal
- Click empty slot → opens Roster Picker
- Click "Manage" → opens Roster Picker
- Hover → tooltip with name, status, current action

---

## 2. Roster Picker Modal

**Component:** `council-picker.ts`

### Layout
- Full-screen overlay with darkened backdrop (`rgba(0,0,0,0.6)`, z-index: 400)
- Centered card: ~600px wide x ~500px tall
- Header: "Assemble Your Council" + close button

### Two-Zone Interior

**Top zone — Council Slots (horizontal row of 5):**
- Filled slots: portrait + name + remove "x" button
- Empty slots: dashed border + "+" placeholder
- Drag targets for reordering

**Bottom zone — Available Agents (scrollable grid):**
- All agents not in Council
- Each card: portrait, name, domain badge, level, trust tier
- Click card → fills next empty Council slot
- If Council is full (5/5), shows "Council full" indicator

### Behavior
- Changes are live/immediate (no confirm button)
- Close (x or backdrop click) saves to store + localStorage
- Drag between Council slots to reorder
- Max 5 members, any agent type (ai/npc/human)
- Slot 1 = "leader" position (top of sidebar)

---

## 3. Agent Detail Modal

**Component:** `agent-detail-modal.ts`

### Layout
- Position: `fixed`, right 60% of viewport (`left: 40%`, `right: 0`, `top: 0`, `bottom: 0`)
- Left 40% remains as game world (visible, interactive)
- Subtle backdrop on left 40% (`rgba(0,0,0,0.3)`), clicking it closes modal
- Z-index: 150
- Slide-in animation from right (200ms ease-out)

### Header Bar
- Agent portrait (~64px), name, persona subtitle, type badge (AI/NPC/Human)
- Trust tier badge + level badge
- LLM status indicator with animated pulse (idle/queued/thinking/error)
- Current brain state label ("Working", "Idle", "Walking to CoffeeMachine")
- Close button

### Tab Bar
6 tabs replacing the old 7-tab system:

| Tab | Content | Component Reuse |
|-----|---------|-----------------|
| **Profile** | Hero section, personality traits, D&D stats, economy (level/xp/coin/tokens), vitals bars, skills, relationships, goals, capabilities, process metrics (collapsible) | `panel-vitals.ts`, `panel-economy.ts`, stat/hero rendering from `panel-info.ts` |
| **Talk** | Full conversation thread, input area, thinking indicator. LLM auto-starts on modal open. | `panel-talk.ts` logic |
| **Brain** | Two sub-sections: (1) Live BT tree view, (2) Decision narrative timeline. Needs radar chart. | Radar + timeline from `panel-brain.ts`, new `bt-tree-view.ts` |
| **Tasks** | Task list with status, suggested task assignment, confirmation | `panel-tasks.ts` |
| **Permissions** | Tool permission grants, audit trail | `panel-permissions.ts` |
| **Debug** | Raw LLM prompts/responses, stats override, trust quick-toggle, economy cheats (only when `store.debugMode`) | `panel-debug.ts` |

### On Open
- `store.selectAgent(name)` triggers modal open
- LLM process auto-starts via `getOrStartProcess(agentName)`
- Default tab: Profile
- If another modal is open, swaps to new agent (no stacking)

### On Close
- Backdrop click, close button, or Escape key
- `store.stopFollow()` + `store.selectAgent(null)` clears selection and camera lock
- LLM process stays running (agent continues working in world)

---

## 4. BT Tree Renderer

**Component:** `bt-tree-view.ts`

### Rendering
- Vertical tree layout: root at top, children flow downward
- Styled nested list (like a file tree), not a canvas renderer
- Each node: type icon + label + colored status dot
- Collapsible node groups

### Node Types & Icons
| Type | Icon | Example |
|------|------|---------|
| Selector | `?` | "Choose activity" |
| Sequence | `→` | "Eat sequence" |
| Condition | `◆` | "IsHungry", "HasCoin" |
| Action | `▶` | "SeekFood", "WanderIdle" |

### Status Colors
| Status | Color | Meaning |
|--------|-------|---------|
| Running | `--accent-blue` | Currently executing |
| Success | `--accent-green` | Completed successfully |
| Failure | `--text-muted` | Failed/skipped |
| Idle | no dot | Not evaluated this tick |

### Interaction
- Click node to expand/collapse children
- Hover shows tooltip with full name + last evaluation time
- Auto-expands the active path (root → currently running leaf)

### Data Contract

```typescript
type BTNodeType = "selector" | "sequence" | "condition" | "action";
type BTNodeStatus = "running" | "success" | "failure" | "idle";

interface BTNodeState {
  readonly id: string;           // Dot-path from root, e.g. "root.0.2.1"
  readonly label: string;        // Display name, e.g. "SeekFood"
  readonly type: BTNodeType;     // Mapped from mistreevous node kinds
  readonly status: BTNodeStatus; // Last tick result
  readonly children: BTNodeState[];  // Nested tree (not flat IDs)
}

interface BTTreeSnapshot {
  readonly root: BTNodeState;    // Single root node with nested children
  readonly tick: number;         // Monotonic tick counter
}
```

**Mistreevous mapping:** `Selector`/`Lotto`/`Priority` → `"selector"`, `Sequence` → `"sequence"`, `Condition`/`Wait`/`Guard` → `"condition"`, `Action`/`Flip`/`Succeed`/`Fail` → `"action"`.

**Emit frequency:** Snapshot emits on each BT tick (`BT_TICK_INTERVAL_MS = 3000`), only when the tree state has changed since last emit (dirty check by comparing status values).

### Integration
- Brain tab layout: radar chart + tree view (top), decision narrative timeline (bottom)

---

## 5. Store Changes

### TabName Type Change

Current:
```typescript
type TabName = "info" | "talk" | "tasks" | "permissions" | "brain" | "monitor" | "debug";
```

New:
```typescript
type TabName = "profile" | "talk" | "tasks" | "permissions" | "brain" | "debug";
```

**Migration:** `"info"` → `"profile"`, `"monitor"` removed (process metrics fold into Profile as a collapsible section). Any unrecognised `selectedTab` value falls back to `"profile"`.

### New Fields
```
council: string[]     — ordered list of up to 5 agent names
btTreeState: Map<string, BTTreeSnapshot>   — per-agent BT tree snapshots
```

### New Methods
- `setCouncil(names: string[])` — validates max 5, persists to localStorage, notifies
- `addToCouncil(name: string)` — appends if under 5, not already present
- `removeFromCouncil(name: string)` — removes by name, preserves order
- `reorderCouncil(names: string[])` — full replacement for drag reorder
- `updateBtTree(agentName: string, snapshot: BTTreeSnapshot)` — update BT visualization state

### Persistence
- Council stored in localStorage key `flowti-council` as JSON array
- On load, silently drop names that no longer exist in `store.agents`
- Agent rename is out of scope — renamed agents are treated as "no longer exists" and dropped from Council. User re-adds them.
- Immediate-persist on picker close is intentional — no dirty-state warning needed, changes are trivially reversible via the picker.

### Selection Flow
- `store.selectAgent(name)` — unchanged API, but now consumed by the detail modal instead of the old panel
- `store.selectTab(tab)` — reused with updated `TabName` union

### LLM Auto-Start
- On modal open, call `getOrStartProcess(agentName)` if not running
- Existing `store.llmStatus` map tracks state reactively

---

## 6. Component Retirement & Migration

### Retired
- `agent-panel.ts` — entire right-side panel, deleted once modal is stable

### Reused As-Is
- `panel-vitals.ts` → Profile tab
- `panel-economy.ts` → Profile tab
- `panel-talk.ts` → Talk tab
- `panel-tasks.ts` → Tasks tab
- `panel-permissions.ts` → Permissions tab
- `panel-debug.ts` → Debug tab

### Reworked
- `panel-brain.ts` — keeps needs radar + decision log (renamed "Decision Narrative" for consistency), gains `bt-tree-view.ts` integration
- `panel-info.ts` — **deleted**. Its hero section, personality traits, D&D stat grid, skills list, relationships, goals, and behaviors rendering are inlined into `agent-detail-modal.ts`'s Profile tab. The sub-components it imported (`panel-vitals.ts`, `panel-economy.ts`) are imported directly by the modal instead.

### New Components (4)
| Component | File | Purpose |
|-----------|------|---------|
| Council Sidebar | `council-sidebar.ts` | Left-edge 5-slot party bar |
| Council Picker | `council-picker.ts` | Full-screen team composition overlay |
| Agent Detail Modal | `agent-detail-modal.ts` | Split-screen right 60% character sheet |
| BT Tree Renderer | `bt-tree-view.ts` | Visual node tree with live state colors |

### Unchanged
- `roster-bar.ts` — stays as-is (scene navigation, different purpose from Council sidebar)

---

## 7. Z-Index Map (Updated)

| Layer | Z-Index | Component |
|-------|---------|-----------|
| Canvas background | 0 | ExcaliburJS |
| Dashboard overlays | 10 | Movement arrows |
| Roster bar | 50 | Bottom scene nav |
| Council sidebar | 90 | Left party bar |
| Agent panel (legacy, during transition) | 100 | Right-side panel (retired post-migration) |
| Camera HUD | 100 | Top-center follow indicator |
| Agent detail modal | 150 | Right 60% split |
| Ask Bob panel | 200 | Top-left launcher |
| Merchant panel | 299-300 | Shop overlay |
| Council picker | 400 | Team composition |
| Briefing modal | 500 | Session briefing |

---

## Non-Goals

- **World filtering** — All agents stay in the world regardless of Council membership
- **Council gameplay effects** — Council is UX-only (quick access), no stat bonuses or mechanical impact
- **Multi-agent chat** — Each modal shows one agent's conversation, no group chat
- **Persistent BT tree recording** — Tree snapshots are live-only, not stored to disk
- **Custom portrait uploads** — Portraits use existing sprite registry thumbnails
- **Full accessibility/ARIA** — Deferred. Escape key closes modals (implemented), but full keyboard navigation (arrow keys for Council reorder, tab focus management) is follow-on work
- **Agent rename handling** — Renamed agents are dropped from Council on next load; user re-adds them
