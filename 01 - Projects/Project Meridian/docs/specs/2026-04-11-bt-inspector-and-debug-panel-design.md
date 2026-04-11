# BT Inspector & Debug Panel Fixes Design

**Status:** Approved
**Date:** 2026-04-11
**Scope:** 4 new files, 3 modified files, 3 new test files

## Problem

Two related issues block effective agent debugging:

1. **No way to inspect behavior tree execution.** Investigations rely on snapshot diffs to infer which BT branches fired. After the equipment gate change, we still can't answer "why did Aldric go to market instead of working?" without guessing. The mistreevous visualiser demo at https://nikkorn.github.io/mistreevous-visualiser shows what's possible — a visual tree with live state.

2. **Debug panel is broken in practice.** The panel is 320px wide, so the `⏺ Record` button overflows and is unreachable. Clicking Snapshot or Record causes a visible UI lag (~100-300ms) because `buildDiagnosticSnapshot()` runs synchronously on the main thread. When recording starts, there's no visible indication it's active — the button text changes briefly but reverts, leaving the user unsure.

## Design

### Part 1: Debug Panel Fixes

**Widen the overlay:** 320px → 480px. Header has room for tabs + action menu.

**Kebab menu for actions:** Replace inline `📋 Snapshot` + `⏺ Record` spans with a single `⋮` button. Clicking opens a dropdown with two items: "📋 Copy snapshot" and "⏺ Start recording" (toggles to "⏹ Stop recording"). Clicking outside closes the dropdown.

**Async click handling:** Use `setTimeout(fn, 0)` to yield to the event loop so the browser can paint before the heavy work runs:

```typescript
menuItem.textContent = '⏳ Building...';
closeDropdown();
setTimeout(() => {
    const snapshot = buildDiagnosticSnapshot(deps);
    void navigator.clipboard.writeText(snapshot).then(() => showToast('✅ Copied'));
}, 0);
```

**Why not `requestAnimationFrame`:** rAF runs *before* the next paint, so a single rAF callback still blocks the repaint. `setTimeout(fn, 0)` yields to the event loop, which allows the browser to paint pending updates before the macrotask runs. This matches the existing `setTimeout` pattern used elsewhere in `debug-overlay.ts` (e.g. button text resets).

**Persistent recording indicator:** While recording, add a red `● REC` span in the header row (next to the tabs, outside the menu). Rendered inline via HTML string (bypasses the `obsidianmd/no-static-styles-assignment` ESLint rule). The update loop re-renders the header, so the indicator appears/disappears naturally when recording state changes.

**Toast feedback:** Floating div at the bottom of the overlay shows short-lived messages ("✅ Copied", "✅ Saved", "❌ Failed"). 2-second auto-dismiss. Replaces per-button text state management.

**Kebab menu outside-click handling:** When the dropdown opens, attach a `document.addEventListener('click', closeDropdown, { once: true, capture: true })`. The `once: true` auto-removes the listener after the first click, preventing listener accumulation. `capture: true` ensures it fires before any click handlers inside the dropdown (so clicking a menu item first handles the action, then the global handler would have already removed itself via `once: true`). Use `event.stopPropagation()` on the kebab toggle itself to prevent the same click from immediately closing the menu it just opened.

### Part 2: BT Inspector

**Entry paths:**
- **Ribbon icon + command** → opens inspector in index mode (empty state)
- **Click agent in game canvas** → opens/focuses inspector in detail mode with that agent's tree

**Index mode UI:**
- Top section: "Trees" — discovered `.mdsl` files from `${dataRoot}/behavior-trees/` and `${dataRoot}/jobs/`. Click loads the static tree.
- Bottom section: "Live Agents" — current agents with their active job (e.g., "Aldric — settler"). Click loads the agent's live tree.

**Detail mode UI:**
- Header: tree name + "Back to index" button + (live mode only) agent details summary
- Body: rendered tree via `renderTree(nodeDetails)`

**Tree rendering:** Nested `<div>` structure, one row per node. Indentation via `padding-left: depth * 16px`. State indicator on the left border:
- `READY` — gray
- `RUNNING` — blue with `▸`
- `SUCCEEDED` — green with `✓`
- `FAILED` — red with `✗`

Row content: `{type} {name}{args ? " " + args : ""} {state ? "(" + state + ")" : ""}`. Example: `sequence NeedsEquipment (RUNNING)` or `action BuyItem "equipment"`.

**Composite nodes** (selector/sequence) auto-expanded. Leaf nodes (action/condition) show their full content inline. Clicking a node expands inline details (guards, callbacks, full args) below it; clicking again collapses.

**Live refresh:** 500ms `setInterval` while in detail mode with an agent. Interval is cleared on view close, mode switch, or if `!containerEl.isShown()` (avoids work when tab is hidden). Each refresh calls `agent.behaviorTree.getTreeNodeDetails()` (note: the codebase uses the American spelling `behaviorTree` on `AgentActor`, even though mistreevous's class is named `BehaviourTree`) and replaces the tree container's innerHTML.

**Static tree loading — composition required for job files:** Individual job MDSL files (`jobs/settler.mdsl`, `jobs/craftsman.mdsl`, `jobs/guard.mdsl`) are **branch definitions**, not standalone trees — they lack the `root {}` wrapper and are meant to be composed with `base.mdsl`. The existing `src/infrastructure/entity/bt-loader.ts` handles this via `createMDSLLoader.loadComposed(vault, basePath, branchPath)`.

The new `loadStaticTree(vault, treeRef)` takes a discriminated union:
```typescript
type TreeRef =
  | { kind: 'base'; path: string }                    // 'behavior-trees/base.mdsl' — standalone
  | { kind: 'job'; branchPath: string };              // 'jobs/settler.mdsl' — composed with base
```

For `base`: read the file directly, construct `new BehaviourTree(mdsl, stubAgent)`.
For `job`: call `mdslLoader.loadComposed(vault, baseMdslPath, branchPath)`, which returns `{ mdsl, valid, errors }`. If `result.valid` is `false` or `result.mdsl` is `null`, throw an error with the first message from `result.errors` — `loadComposed` does not throw on composition failure, it returns an error result, so `loadStaticTree` must check and throw itself. Otherwise, construct `new BehaviourTree(result.mdsl, stubAgent)`.

In both cases, call `tree.getTreeNodeDetails()` without stepping — this returns the tree structure with all nodes in `READY` state (the initial state). Wrapped in try/catch; invalid MDSL or failed composition renders an error div instead of crashing.

**Stub agent:** The stub only needs to satisfy mistreevous's `Agent` type at construction time. The `BehaviourTree` constructor validates the definition but does not invoke agent methods — those only run during `step()`, which we never call. So the stub can be `{}` cast as `Agent` (or a `Proxy` that returns no-op functions on any property access). The stub's return values are irrelevant.

**Index entries for trees:**
- `base.mdsl` — listed as `{ kind: 'base', path: '...' }`
- `jobs/*.mdsl` — each listed as `{ kind: 'job', branchPath: '...' }`, displayed with the label "settler (base + settler)" so the user understands composition is happening

### Part 3: Recording Integration

Extend `buildAgentSnapshot()` in `debug-overlay.ts`. For each agent, after the existing state lines, append:

```markdown
BT Path: selector → sequence[HasJob, NeedsEquipment] → sequence[CanAffordItem "equipment"] → SeekMarket (RUNNING)
```

Generated by `extractActivePath(nodeDetails)`. Precise walk algorithm:

1. Start at root. Initialize `path: string[] = []`.
2. At each node, append its description (type + name + args) to `path`.
3. If the node has no children, stop — this is the leaf.
4. Otherwise, pick the next child to follow by state priority:
   - **Preferred:** the first child in `RUNNING` state → follow it
   - **Fallback 1:** if no child is RUNNING, the *last* child in `SUCCEEDED` or `FAILED` state → follow it (shows the just-completed path)
   - **Fallback 2:** if no child has been evaluated (all READY), stop — the composite itself is the deepest relevant node
5. Repeat from step 2.
6. Join `path` with `→`. Append the final node's state in parens: `"(RUNNING)"`, `"(SUCCEEDED)"`, `"(FAILED)"`, or nothing if READY.

**Why this rule:** In mistreevous, when a selector has a RUNNING child, earlier siblings are in FAILED (they were rejected) and later siblings are in READY (not yet considered). Following "first RUNNING child" correctly traces the currently-active branch. The fallback for "no RUNNING" handles the case where a tree has just completed a step — e.g., `Eat` succeeded — and we want to see what just finished, not the stale previous tick.

**Example output:**
- `selector → sequence[HasJob, NeedsEquipment] → sequence[CanAffordItem "equipment"] → SeekMarket (RUNNING)` — agent is going to market
- `selector → sequence → Work (SUCCEEDED)` — agent just finished a work tick
- `selector` — no child has been evaluated yet (brand-new tree, ready state)

The active path appears in every `buildAgentSnapshot()` call — so it's in both manual snapshots and recordings, keeping the two output paths consistent.

### Part 4: Agent Click Plumbing

**Canvas → Obsidian view hop:**
1. In `game-view.ts` `populateScene()`, attach an Excalibur pointer handler to each `AgentActor`:
   ```typescript
   agent.on('pointerdown', () => {
       container.dispatchEvent(new CustomEvent('meridian-agent-selected', {
           detail: { agentId: agent.agentId },
           bubbles: true,
       }));
   });
   ```
2. In `plugin.ts`, after the game view's container is mounted, register the listener via Obsidian's lifecycle-aware API:
   ```typescript
   this.registerDomEvent(gameViewContainer, 'meridian-agent-selected', (e: Event) => {
       const customEvent = e as CustomEvent<{ agentId: string }>;
       void this.openBTInspectorForAgent(customEvent.detail.agentId);
   });
   ```
   `registerDomEvent` auto-cleans the listener on plugin unload — no manual removal needed.
3. `openBTInspectorForAgent(agentId)`:
   - Check for existing `meridian-bt-inspector` leaves via `workspace.getLeavesOfType('meridian-bt-inspector')`
   - If one exists: focus it (`workspace.revealLeaf(leaf)`) and call `view.showAgent(agentId)`
   - Otherwise: `workspace.getLeaf(false).setViewState({ type: 'meridian-bt-inspector', state: { agentId } })`

**Click propagation:** Location marker actors (`createLocationMarker()` in `game-view.ts`) currently do **not** have pointer handlers. Only `AgentActor` instances will receive the new `pointerdown` handler. No conflict. If location markers later get click handlers, they should dispatch a different event name (`meridian-location-selected`) so the two don't collide.

**Why DOM events, not game-view methods:** The game view shouldn't know about the inspector. The inspector is a consumer. DOM events are a zero-coupling bus — the game view emits, the plugin orchestrates. This also avoids circular imports between the game view and the inspector view.

## Component Breakdown

### New files

The directory `src/infrastructure/ui/` does not yet exist — it will be created as part of this work. It's the appropriate home for Obsidian-layer UI components (distinct from `engine/` which owns Excalibur game rendering).

| File | Responsibility |
|------|----------------|
| `src/infrastructure/ui/bt-inspector-view.ts` | `MeridianBTInspectorView extends ItemView` — lifecycle, mode switching (index/detail), refresh interval, event subscription for agent-selected |
| `src/infrastructure/ui/bt-tree-renderer.ts` | Pure function `renderTree(details: NodeDetails): HTMLElement` — recursive nested div structure with state indicators |
| `src/infrastructure/ui/bt-tree-loader.ts` | `loadStaticTree(vault, treeRef): Promise<NodeDetails>` — reads MDSL (composing base + branch for job trees), builds temporary tree with stub agent, returns NodeDetails |
| `src/infrastructure/ui/bt-active-path.ts` | Pure function `extractActivePath(details: NodeDetails): string` — walks tree to active leaf following the precise state-priority rules, returns compact path string |

### Modified files

| File | Changes |
|------|---------|
| `src/plugin.ts` | Register `MeridianBTInspectorView`, add ribbon icon "🌳", add command "Open BT Inspector", wire vault + `getAgents` into view, attach `meridian-agent-selected` listener |
| `src/infrastructure/engine/debug-overlay.ts` | Widen to 480px, kebab menu dropdown, async click with rAF, recording header indicator, toast helper, call `extractActivePath()` in `buildAgentSnapshot()` |
| `src/infrastructure/engine/game-view.ts` | Attach Excalibur pointer handler to AgentActor in `populateScene()` that dispatches `meridian-agent-selected` DOM event |

## Test Plan

### Unit tests

**`tests/infrastructure/ui/bt-tree-renderer.test.ts`** (~8 tests):
1. Renders a single leaf node
2. Renders a composite with multiple children
3. READY state has gray indicator
4. RUNNING state has blue indicator with ▸
5. SUCCEEDED state has green indicator with ✓
6. FAILED state has red indicator with ✗
7. Args are rendered inline: `BuyItem "equipment"`
8. Deep nesting produces correct indent depth

**`tests/infrastructure/ui/bt-active-path.test.ts`** (~9 tests — precise algorithm needs thorough coverage):
1. All-READY tree (brand new, no steps yet) returns just the root description
2. Single RUNNING leaf at depth 1 returns `root → leaf (RUNNING)`
3. Nested RUNNING leaf at depth 3 returns full path joined with `→`
4. Selector with child[0]=FAILED, child[1]=RUNNING — path follows child[1], child[0] not in path
5. Selector with child[0]=FAILED, child[1]=SUCCEEDED (no RUNNING) — path follows child[1] (the last resolved child)
6. Sequence with child[0]=SUCCEEDED, child[1]=SUCCEEDED, child[2]=RUNNING — path follows child[2]
7. Sequence with all children SUCCEEDED — path follows the last child (fallback 1)
8. Root composite with no children evaluated (all READY) — path is just the root (fallback 2)
9. Final node state is appended in parens: `(RUNNING)`, `(SUCCEEDED)`, `(FAILED)`, nothing for READY

**`tests/infrastructure/ui/bt-tree-loader.test.ts`** (~5 tests):
1. `kind: 'base'` with valid MDSL returns NodeDetails with expected root
2. `kind: 'job'` composes branch with base and returns composed tree
3. `kind: 'job'` with mdslLoader composition failure — throws with descriptive error
4. Invalid MDSL throws with descriptive error from mistreevous validator
5. Vault read failure throws (missing file)

### Not unit tested

`MeridianBTInspectorView` — Obsidian lifecycle, DOM mounting, workspace events. Manual verification only. Same pattern as `MeridianGameView` which has no unit tests. Debug overlay changes also not unit tested (no existing tests for overlay).

### Manual test plan

1. Click ribbon → inspector opens in index mode with static trees + live agents listed
2. Click `base.mdsl` → static tree renders, all nodes READY
3. Click `settler.mdsl` → renders with equipment gate as first branch
4. Click a live agent in the index → detail mode with live-updating tree (500ms refresh)
5. Click an agent sprite in the canvas → inspector auto-opens/focuses with that agent
6. Start recording, let 4 phases pass, stop → open the recording file, verify each agent block contains `BT Path: ...` line
7. Debug panel: Record button reachable at 480px width, kebab menu opens, Snapshot shows "⏳ Building..." then toast, Record shows red `● REC` in header while active

## Error Handling

- **Invalid MDSL** in static tree: `loadStaticTree` catches, view renders error div with message
- **Agent disappears during live inspection**: `getAgentById(id)` returns undefined after the game was running → view clears tree, switches to index mode, toast "Agent no longer available"
- **Vault folder missing**: `list('${dataRoot}/jobs')` fails → index shows "No trees found in {folder}" instead of crashing
- **Tree refresh throws**: 500ms interval wraps `getTreeNodeDetails()` in try/catch; logs, keeps previous render, continues polling
- **Ribbon click before game loaded**: Index mode shows empty "Live Agents" section with "Waiting for game to load..." message; refreshes next time user returns to index
- **Obsidian restart with persisted `agentId` state**: On `onOpen`, the view distinguishes between two states:
  - `deps` unavailable (game not loaded yet): show "Waiting for game to load..." in detail mode header. Retry loading the agent on a short interval (1s) until either the agent appears or the user navigates away.
  - `deps` available but `getAgentById(id)` returns undefined: the previously-inspected agent no longer exists (game was reset). Switch to index mode, toast "Previous agent no longer available, showing index".
- **Game reset while inspector is open**: Same as "Agent disappears" — the live-refresh interval detects the missing agent and falls back to index mode.

## Dependencies

No new dependencies. Mistreevous 4.3.1 already provides `BehaviourTree.getTreeNodeDetails()` and `NodeDetails` type. All rendering is vanilla DOM.

## Out of Scope

- Visual node-link diagram (SVG / D3-style) — revisit if nested list proves insufficient
- Editing trees from the inspector — read-only
- Tree comparison / diff view — single tree at a time
- Exporting rendered trees as images — copy/paste of the recording markdown suffices
- BT breakpoints / step-through debugging — passive observation only
