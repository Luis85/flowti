# Sidepanel Ambient Dashboard — Design Spec

> **Goal:** Redesign the Agent World left sidebar from a static launcher rail into a collapsible ambient dashboard where agents' status, intent, and needs are visible at a glance without clicking.

## Context

The current sidebar is an 80px fixed rail with council portrait circles and three letter-labeled action buttons (B, R, M). It functions as a panel launcher but communicates nothing about agent state. Users must open the agent-detail slide panel to see vitals, intent, or needs — defeating the "idle game observatory" design goal where the world should be watchable without constant interaction.

## Design Principles

1. **Ambient first** — agent state visible without interaction
2. **Canvas-preserving** — collapsed by default, expands on demand, auto-collapses when panels open
3. **Scannable density** — a 6-point SVG radar conveys all needs in 30x30px
4. **Clean controls** — minimal symbolic icons for action buttons, not RPG-themed

---

## Rail States

### Collapsed (default) — 56px wide

The collapsed rail shows council agents as portrait circles with intent-colored status rings. It provides enough ambient signal to notice problems without expanding.

**Layout (top to bottom):**
- 8px top padding
- Council portrait stack (up to 5 slots, 40px each, 8px gap)
- Flexible spacer
- 3 action icon buttons (32px square, 8px gap)
- 8px bottom padding

**Portrait circles:**
- 40px diameter, clipped portrait sprite
- 2px ring colored by current intent (STATE_COLORS: working=#22c55e, idle=#3b82f6, on-break=#a855f7, talking=#06b6d4, seeking=#6b7280, waiting=#f59e0b). Uses the same 2px border that `renderPortrait()` already produces — no changes to portrait.ts.
- When any need drops below `NEED_CRITICAL_THRESHOLD` (25): a small pulsing dot (4px, red) appears at bottom-right of the portrait
- Empty council slots: dashed border circle at 30% opacity
- Hover: tooltip with agent name + intent label

**Background:**
- `var(--bg-primary)` with `border-right: 1px solid var(--border)`
- Expand chevron at the horizontal center, just below the council slots — a small `>` icon that hints at expandability. Opacity 0.3, appears on rail hover at 0.7.

**Click targets:**
- Portrait click: opens agent-detail panel (same as today)
- Chevron click or double-click rail background: toggles expand/collapse
- Action button click: toggles corresponding slide panel

### Expanded — 200px wide

The expanded rail replaces portrait circles with mini agent cards. Each card shows the agent's portrait, name, current intent, and a needs radar — enough to assess team health without opening any panel.

**Transition:** 200ms ease-out width animation. Content fades in after width settles (100ms delay, 150ms opacity transition).

**Mini agent card layout (per council slot):**
```
┌──────────────────────────┐
│ [32px      ] Name        │
│ [portrait  ] intent ● ── │
│             ◇ radar ◇    │
└──────────────────────────┘
```

- Portrait: 32px, rounded, intent-colored ring (2px)
- Name: 12px, `var(--text-primary)`, truncated with ellipsis
- Intent: 10px, `var(--text-secondary)`, badge-style with left dot colored by STATE_COLORS
- Radar: 30x30px SVG hexagonal needs radar (see Radar section below)
- Card background: `var(--bg-secondary)`, 4px border-radius, 1px `var(--border)` border
- Card padding: 8px
- Card gap: 6px
- Hover: border-color transitions to `var(--accent-gold)` at 0.4 opacity
- Click: opens agent-detail panel, rail auto-collapses

**Empty council slots in expanded state:** Same dashed border card outline, 30% opacity, no content.

**Collapse chevron:** Moves to top-right of the rail, becomes a `<` icon.

### Auto-Collapse Behavior

`GameSidebar` maintains two private properties (not in DashboardStore):
- `expanded: boolean` (default `false`) — current rail state
- `expandedBeforePanel: boolean | null` (default `null`) — saved state for restore

When a slide panel opens (detected by `store.activePanel` changing from `null` to a value during render):
1. Save `expanded` to `expandedBeforePanel`
2. Set `expanded = false`, rail collapses to 56px (200ms)

When a slide panel closes (`store.activePanel` returns to `null`):
1. Restore `expanded = expandedBeforePanel ?? false`
2. Clear `expandedBeforePanel = null`

This ensures the slide panel's 60% width doesn't fight with an expanded rail. The DashboardStore API is unchanged — the sidebar reacts to `activePanel` transitions in its render cycle via the existing `StoreController`.

---

## Needs Radar

A 30x30px SVG that plots 6 needs (energy, hunger, thirst, focus, social, morale) as a filled polygon on a regular hexagon grid.

**Geometry:**
- 6 axes at 60-degree intervals, centered in the 30x30 viewBox
- Each axis extends from center to a maximum radius of 13px
- Need value (0-100) maps linearly to distance from center
- A faint reference hexagon at 100% marks the outer boundary

**Rendering:**
- Outer hexagon: stroke only, `var(--border)` at 0.3 opacity, 0.5px stroke
- Filled polygon: connects the 6 need values, filled with a color based on overall health
- Health color: determined by the lowest need value, using named threshold constants:
  - `NEED_WARN_THRESHOLD = 60` — all needs >= 60: `var(--accent-green)` at 0.35 fill, 0.8 stroke
  - `NEED_CRITICAL_THRESHOLD = 25` — any need 25-59: `var(--accent-gold)` at 0.35 fill, 0.8 stroke (warning)
  - Any need < 25: `var(--accent-red)` at 0.4 fill, 0.9 stroke (critical)
- The pulsing dot on portraits uses the same `NEED_CRITICAL_THRESHOLD` constant
- No labels, no axis lines, no numbers — pure shape recognition

**Helper function:** `renderNeedsRadar(needs: AgentNeeds, size: number): TemplateResult` — returns an `html` template wrapping an inline `<svg>` element. Placed in a new file `src/game/ui/needs-radar.ts` (follows the same pattern as `portrait.ts` — a dedicated rendering helper). The threshold constants (`NEED_WARN_THRESHOLD`, `NEED_CRITICAL_THRESHOLD`) are exported from `game-ui-constants.ts` since they are pure data.

---

## Action Buttons

Replace letter placeholders with inline SVG path icons. Keep the existing button styles and active-state behavior (gold left border + glow).

| Button | Current | New Icon | SVG Description |
|--------|---------|----------|-----------------|
| Bob | "B" | Speech bubble | Rounded rectangle with tail at bottom-left |
| Roster | "R" | People group | Two overlapping person silhouettes |
| Merchant | "M" | Storefront | Simple shop facade with awning |

Icon size: 18px within 32px button. Stroke-based, 1.5px stroke, `currentColor` so they inherit the text color transitions.

---

## Slide Panel Polish

The slide panel overlay gets minor visual improvements. No structural changes.

**Changes to `slide-panel.ts`:**
- Backdrop: add `backdrop-filter: blur(4px)` for a frosted glass effect over the game canvas
- Panel top-border: 2px accent color at the very top of the panel, color varies by panel type:
  - agent-detail: `var(--text-primary)` (warm cream — distinct from merchant's gold)
  - bob: `var(--accent-blue)`
  - roster: `var(--accent-green)`
  - merchant: `var(--accent-gold)`
  - briefing: `var(--accent-purple)`
- The accent color is passed as a CSS custom property `--panel-accent` from the sidebar when rendering panel content

---

## Files Changed

| File | Change |
|------|--------|
| `src/game/ui/sidebar.ts` | Rewrite: collapsible rail, mini cards, SVG icons, auto-collapse logic (private `expanded`/`expandedBeforePanel` state) |
| `src/game/ui/needs-radar.ts` | New: `renderNeedsRadar()` helper — inline SVG hexagonal radar |
| `src/game/ui/slide-panel.ts` | Add frosted backdrop, accent top-border via `--panel-accent` |
| `src/game/ui/game-styles.ts` | Add `--rail-width-collapsed: 56px`, `--rail-width-expanded: 200px` |
| `src/game/ui/game-ui-constants.ts` | Add `NEED_WARN_THRESHOLD`, `NEED_CRITICAL_THRESHOLD` constants |
| `tests/game/ui/sidebar.test.ts` | New: test collapsed/expanded rendering, auto-collapse, click handlers |
| `tests/game/ui/needs-radar.test.ts` | New: radar helper tests (healthy/warning/critical shapes, 0-100 scale) |

**No changes to:** DashboardStore, agent-detail-modal, ask-bob, roster-panel, merchant-panel, briefing-panel, portrait.ts, store-controller.ts.

**Note:** The rail width changes from 80px to 56px (collapsed). The camera offset in `engine.ts` uses a percentage-based calculation (`ENGINE_WIDTH * 0.3`) that does not reference the rail width, so the 24px difference is negligible and no camera adjustment is needed.

---

## Interaction Summary

| Action | Result |
|--------|--------|
| Hover collapsed rail | Chevron appears at 0.7 opacity |
| Click chevron (collapsed) | Rail expands to 200px |
| Click chevron (expanded) | Rail collapses to 56px |
| Click council portrait (collapsed) | Opens agent-detail slide panel |
| Click agent card (expanded) | Opens agent-detail slide panel, rail auto-collapses |
| Slide panel opens | Rail auto-collapses, stores previous state |
| Slide panel closes | Rail restores to previous state |
| Click action button | Toggles corresponding slide panel |
| Hover portrait (collapsed) | Tooltip: "AgentName — working" |
| Need drops below 25% | Red pulsing dot on portrait (both states) |

---

## Non-Goals

- Redesigning any slide panel content (agent-detail tabs, Bob, roster, merchant, briefing)
- Changing the DashboardStore API
- Adding new panel types
- Animating the radar (static snapshot, updates on store change)
- Showing non-council agents in the rail
- Keyboard navigation for the rail (game canvas overlay — mouse-driven)
- Responsive behavior for narrow containers (game requires minimum 800px canvas)
