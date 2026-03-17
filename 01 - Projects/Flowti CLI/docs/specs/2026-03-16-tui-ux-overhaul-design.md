# TUI UX Overhaul — Design Spec

**Date**: 2026-03-16
**Branch**: `feat/iter-5/excalibur-rpg-phase-b3`
**Status**: Closed — Phase 1 delivered (focus zones, section memory, status hints). Phase 2 (single-file build) absorbed into `2026-03-17-tui-functional-parity-design.md`.
**Scope**: Fix TUI navigation UX with VS Code-style focus zones, integrate chat inline, then consolidate to single JS binary

---

## Problem Statement

The current TUI has a solid 4-pane layout (header, activity bar, content, status bar) with 8 sections and 28+ pages, but the navigation UX is broken:

1. **Invisible controls** — Ctrl+1-8 is the only way to switch sections; users instinctively try arrow keys
2. **No focus indicator** — no visual signal showing which zone accepts keyboard input
3. **Hooks exist but aren't wired** — `use-focus-zone.ts` and `use-keyboard.ts` exist but `App` doesn't use them
4. **Static status bar** — hints never change regardless of context or focus
5. **Page-level key conflicts** — `ListPage` consumes arrows unconditionally, stealing input from activity bar
6. **No section memory** — switching sections always resets to the landing page
7. **Three bundles** — CJS/ESM split produces 3 files (`main.js`, `tui.mjs`, `chat.mjs`) with `pathToFileURL` hacks

## Design Goals

| Priority | Goal |
|----------|------|
| P0 | Arrow keys + Enter to navigate sections and pages |
| P0 | Clear visual focus indicator on the active zone |
| P0 | Context-aware status bar hints |
| P1 | Section memory (resume where you left off) |
| P1 | Escape behavior that feels natural |
| P1 | Chat integrated inline as a real TUI page (not a separate Ink instance) |
| P2 | Single-file build (all bundles merged into one ESM output) |

---

## Phase 1: VS Code-Style Focus Navigation

### Mental Model

Two focus zones: **activity-bar** and **content**. Tab switches between them. Arrow keys and Enter work within the focused zone. The status bar updates to show contextually relevant hints.

```
┌──────────────────────────────────────────────┐
│  Home > Iterations                           │  ← Header (breadcrumbs, always visible)
├─────────┬────────────────────────────────────┤
│ ▶ 🏠 Ho │  #5 Agent World  [in-progress]    │
│   👤    │  #4 Visual Pres  [done]           │
│   📋    │  #3 Agent Orch   [done]           │
│   📊    │  ▶ #2 Agent Env  [done]           │  ← Content zone (list with detail)
│   ⚡    │  #1 The Agents   [done]           │
│   🔧 Ma │                                    │
│   📦    │                                    │
│   ❓    │                                    │
├─────────┴────────────────────────────────────┤
│  ↑↓ Section  Enter Open  Tab→Content         │  ← Status bar (zone-aware hints)
└──────────────────────────────────────────────┘
```

### Focus Zone Mechanics

| Zone | Focus indicator | Keys consumed | Tab behavior |
|------|----------------|---------------|--------------|
| `activity-bar` | Cyan left border on entire bar | ↑↓ move section highlight, Enter opens section | Tab → `content` |
| `content` | Cyan top border on content area | Page-specific (list arrows, form fields, etc.) | Tab → `activity-bar` |

**Simplification**: The current `FocusZone` type has 3 zones (`activity-bar`, `content`, `actions`). We reduce to 2 — `actions` merges into `content` since action keys (Enter, letter shortcuts) are contextual to the page and don't need a separate focus zone.

### Keyboard Flow

```
┌─────────────────────────────────────────────────┐
│                    App (global)                  │
│  Tab → cycle focus zone                          │
│  Ctrl+1-8 → jump to section (any zone)          │
│  q → quit                                        │
├────────────────────┬────────────────────────────┤
│  Activity Bar      │  Content                    │
│  (when focused)    │  (when focused)             │
│                    │                              │
│  ↑↓ → move cursor  │  Delegated to page:         │
│  Enter → open      │  DashboardPage: scroll,     │
│                    │    action keys               │
│                    │  ListPage: ↑↓, Enter, keys   │
│                    │  FormPage: ↑↓ Tab, Enter,    │
│                    │    Esc cancel                 │
├────────────────────┴────────────────────────────┤
│  Escape (context-dependent):                     │
│  - Content zone, page stack > 1 → goBack()       │
│  - Content zone, page stack = 1 → focus bar      │
│  - Activity bar → no-op (already at root)         │
└─────────────────────────────────────────────────┘
```

### Section Memory

Each section maintains its own independent page stack. Switching sections doesn't destroy history — it suspends and resumes.

**Data model change in `NavigationState`**:

```typescript
// Before
interface NavigationState {
  readonly section: string;
  readonly pageStack: readonly string[];
  readonly params: Readonly<Record<string, string>>;
}

// After
interface SectionState {
  readonly pageStack: readonly string[];
  readonly params: Readonly<Record<string, string>>;
}

interface NavigationState {
  readonly activeSection: string;
  readonly sections: Readonly<Record<string, SectionState>>;
}
```

**Behavior**:
- `setSection("project")` → saves current section's state, restores project's state (or initializes with landing page)
- `navigate("build")` → pushes onto current section's stack, auto-detects section
- `goBack()` → pops current section's stack; if stack is length 1 and focus is content, moves focus to activity bar
- Cross-section navigation (e.g., from Home page linking to Iterations) → switches section and pushes page

### Activity Bar Visual Redesign

Current: width 8, icon only for inactive, icon+label for active. Too cramped.

**New design** (width 14):

```
When activity-bar is focused:
┌─────────────┐
│▸ 🏠 Home    │  ← cursor + cyan + bold
│  👤 Agents  │
│  📋 Project │  ← dimmed
│  📊 Reports │
│  ⚡ Events  │
│  🔧 Manage  │
│  📦 Publish │
│  ❓ Help    │
└─────────────┘

When content is focused:
┌─────────────┐
│  🏠 Home    │  ← active section: white
│  👤 Agents  │
│  📋 Project │  ← dimmed
│  ...        │
└─────────────┘
```

- **Width**: 14 (enough for icon + space + label on all sections)
- **Always show labels** — icons alone aren't learnable in a terminal
- **Cursor indicator**: `▸` prefix when activity-bar is focused, on the selected section
- **Active section**: Cyan + bold when bar is focused; white when content is focused
- **Inactive sections**: Always show label, dimmed

### Status Bar — Zone-Aware Hints

The status bar dynamically reflects available actions for the current focus zone and page type.

```typescript
interface StatusHintSet {
  readonly "activity-bar": readonly KeyHint[];
  readonly "content:dashboard": readonly KeyHint[];
  readonly "content:list": readonly KeyHint[];
  readonly "content:form": readonly KeyHint[];
  readonly "content:default": readonly KeyHint[];
}
```

| Zone / Page | Hints shown |
|-------------|-------------|
| `activity-bar` | `↑↓ Navigate  Enter Open  Tab→Content  q Quit` |
| `content:dashboard` | `Tab→Sidebar  Esc Back  q Quit` |
| `content:list` | `↑↓ Navigate  Enter Select  Tab→Sidebar  Esc Back` |
| `content:form` | `↑↓ Fields  Enter Submit  Esc Cancel  Tab→Sidebar` |
| `content:default` | `Tab→Sidebar  Esc Back  q Quit` |

Pages declare their hint set via a `pageType` property or we infer from which pattern component they use.

### Component Changes Summary

| File | Change |
|------|--------|
| `types.ts` | Update `FocusZone` to 2 zones, add `SectionState`, redesign `NavigationState` |
| `app.tsx` | Wire `useFocusZone`, pass `focusZone` to children, handle Tab/Escape per spec |
| `use-navigation.ts` | Section memory (per-section page stacks), cross-section navigation |
| `use-focus-zone.ts` | Simplify to 2 zones, add `isActive(zone)` helper |
| `use-keyboard.ts` | Add Enter handler for section open, guard on focus zone |
| `activity-bar.tsx` | Width 14, always-visible labels, cursor indicator, focus-aware styling |
| `content-area.tsx` | Accept `focused` prop, pass `enabled={focused}` to page |
| `status-bar.tsx` | Accept `focusZone` + `pageType` props, render dynamic hints |
| `header-bar.tsx` | No changes needed |
| `list-page.tsx` | Respect `enabled` prop (already exists but not wired) |
| `form-page.tsx` | Respect `enabled` prop (already exists but not wired) |
| `dashboard-page.tsx` | Add `enabled` prop pattern for consistency |

### New Hook: `useStatusHints`

Computes the correct hint set based on focus zone and current page characteristics:

```typescript
function useStatusHints(focusZone: FocusZone, pageId: string): readonly KeyHint[] {
  // Determine page type from registry metadata or pattern detection
  // Return appropriate hint set
}
```

This keeps the logic out of App and makes it testable.

---

## Phase 2: Single-File ESM Build

### Current State (3 bundles)

```
esbuild.config.mjs
├── main.js   (CJS)  — core CLI, excludes ink/react
├── tui.mjs   (ESM)  — Ink TUI shell
└── chat.mjs  (ESM)  — Ink chat renderer

main.ts loads tui.mjs via:
  const { pathToFileURL } = await import("node:url");
  const tuiBundlePath = pathToFileURL(paths.join(..., "tui.mjs")).href;
  const { runTui } = await import(tuiBundlePath);
```

**Why 3 bundles**: Ink v6 is ESM-only with top-level await. The main CLI was CJS because some infra code used `require()` patterns. The split was a workaround.

### Target State (1 bundle)

```
esbuild.config.mjs
└── main.mjs  (ESM)  — everything in one file

bootstrap.mjs references main.mjs instead of main.js
```

### Migration Strategy

1. **Switch main bundle to `format: "esm"`** — the entire CLI becomes ESM
2. **Add `createRequire` banner** for any remaining CJS-style imports:
   ```javascript
   import { createRequire } from "node:module";
   const require = createRequire(import.meta.url);
   ```
3. **Merge entry points** — `tui-entry.ts` and `ink-chat-renderer.ts` become direct imports from `main.ts` (lazy-loaded via `import()` to avoid loading ink on non-interactive runs)
4. **Remove `pathToFileURL` hack** — direct dynamic `import()` works within ESM
5. **Single external list** — ink/react stay external (they're in node_modules)
6. **Update bootstrap** — change `BIN_ENTRY` from `main.js` to `main.mjs`
7. **Update `package.json` in bin/** — change to `{ "type": "module" }` or remove entirely

### Lazy Loading (Critical)

Non-interactive commands (`flowti build`, `flowti health`, etc.) must NOT pay the Ink/React import cost. The TUI is only loaded when running in interactive mode:

```typescript
// main.ts — after migration
async function main(): Promise<void> {
  if (await handleCliArgs()) return;

  // Interactive mode — lazy-load TUI
  printBanner();
  const { runTui } = await import("./tui/tui-entry.js");
  await runTui();
}
```

Since the entire bundle is ESM, `import()` just works — no `pathToFileURL` needed.

### Risk: `require()` in domain/infra code

Scan all source for `require(` calls. Current known uses:
- None in domain (domain is pure)
- `createRequire` in bootstrap (stays separate, not bundled)
- esbuild resolves all `import` statements at build time

**Mitigation**: esbuild bundles all imports into the output. The only externals are `node:*` and `ink/react`. There should be zero runtime `require()` calls in the bundled output. If any surface, the `createRequire` banner handles them.

### Build Config Changes

```javascript
// Before: 3 builds
const mainOptions  = { format: "cjs", ... };
const tuiOptions   = { format: "esm", ... };
const chatOptions  = { format: "esm", ... };

// After: 1 build
const mainOptions = {
  entryPoints: [path.join(projectRoot, "src/main.ts")],
  bundle: true,
  outfile: path.join(outDir, "main.mjs"),
  platform: "node",
  format: "esm",
  target: "node22",
  banner: {
    js: [
      "#!/usr/bin/env node",
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
    ].join("\n"),
  },
  external: ["node:*", ...INK_EXTERNALS],
};
```

### Bootstrap Changes

```javascript
// Before
const BIN_ENTRY = resolve(VAULT_ROOT, ".flowti", "bin", "main.js");
// ...
const result = spawnSync(process.execPath, [BIN_ENTRY, ...process.argv.slice(2)], ...);

// After
const BIN_ENTRY = resolve(VAULT_ROOT, ".flowti", "bin", "main.mjs");
// ...
const result = spawnSync(process.execPath, [BIN_ENTRY, ...process.argv.slice(2)], ...);
```

---

## File Inventory

### Phase 1 — Focus Navigation (modified files)

| File | LOC delta | Description |
|------|-----------|-------------|
| `src/tui/types.ts` | +15 | `SectionState`, updated `NavigationState`, simplified `FocusZone` |
| `src/tui/app.tsx` | +30 ~-15 | Wire focus zones, Tab/Escape dispatch, pass props down |
| `src/tui/navigation/use-navigation.ts` | +40 ~-20 | Per-section page stacks, cross-section nav |
| `src/tui/hooks/use-focus-zone.ts` | +5 ~-5 | Simplify to 2 zones |
| `src/tui/navigation/use-keyboard.ts` | +10 | Add Enter handler |
| `src/tui/shell/activity-bar.tsx` | +20 ~-10 | Width 14, labels, cursor, focus-aware |
| `src/tui/shell/content-area.tsx` | +5 | Accept/pass `focused` prop |
| `src/tui/shell/status-bar.tsx` | +25 ~-5 | Zone-aware dynamic hints |
| `src/tui/pages/dashboard-page.tsx` | +3 | Add `enabled` prop |
| **Total** | ~+100 net | |

### Phase 1 — Focus Navigation (new files)

| File | LOC | Description |
|------|-----|-------------|
| `src/tui/hooks/use-status-hints.ts` | ~40 | Compute hints from zone + page type |
| `tests/tui/navigation/use-navigation.test.ts` | ~120 | Section memory, cross-section nav |
| `tests/tui/hooks/use-focus-zone.test.ts` | ~40 | Zone cycling |
| `tests/tui/hooks/use-status-hints.test.ts` | ~50 | Hint computation |
| `tests/tui/shell/activity-bar.test.ts` | ~60 | Rendering states |
| `tests/tui/shell/status-bar.test.ts` | ~40 | Dynamic hints |
| **Total** | ~350 | |

### Phase 2 — Single-File Build (modified files)

| File | LOC delta | Description |
|------|-----------|-------------|
| `configs/esbuild.config.mjs` | ~-40 | Remove 2 of 3 build targets |
| `src/main.ts` | ~-5 | Remove `pathToFileURL` hack, direct `import()` |
| `src/boot/bootstrap.mjs` | +1 ~-1 | `main.js` → `main.mjs` |
| **Total** | ~-45 net | |

**Grand total**: ~+405 LOC new/modified across both phases.

---

## Architecture Decisions

### AD-1: Two focus zones, not three

**Decision**: Drop the `actions` zone. Actions are part of content.

**Rationale**: In practice, action keys (Enter to select, letter shortcuts) work within the content context. A separate actions zone would require an extra Tab press to reach, making the UX slower. VS Code doesn't have a separate focus zone for its status bar actions.

### AD-2: Section memory via per-section state map

**Decision**: Store `Record<string, SectionState>` instead of a single `pageStack`.

**Rationale**: Without section memory, switching from "Iterations > Iteration Detail" to "Home" and back to "Management" loses your place. This is the #1 frustration in multi-pane UIs. The memory cost is trivial (8 sections max).

### AD-3: Activity bar always shows labels

**Decision**: Width 14, always show icon + label for every section.

**Rationale**: Icons alone are unlearnable in a terminal (no tooltips, no hover). The extra 6 columns is a small cost for discoverability. Users with narrow terminals (< 60 cols) would see the same cramped layout either way.

### AD-4: Escape is context-dependent

**Decision**: Escape goes back in content, moves focus to bar at root.

**Rationale**: This matches VS Code's Escape behavior (close panels, then defocus). It provides a natural "zoom out" flow: deep page → parent page → ... → root page → sidebar. No dead ends.

### AD-5: Lazy TUI import for single-file build

**Decision**: Keep `import("./tui/tui-entry.js")` as dynamic import even in single bundle.

**Rationale**: esbuild with `splitting: false` (default for single output) inlines dynamic imports. But tree-shaking ensures ink/react externals are only resolved at runtime when the import runs. Non-interactive commands (`flowti build`) skip the TUI code path entirely.

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ink's `useInput` hook fights with focus zones | Multiple `useInput` handlers fire simultaneously | Guard every `useInput` with `if (!enabled) return` — already exists in ListPage/FormPage |
| Section memory increases state complexity | Harder to debug navigation bugs | Pure state machine with no side effects; comprehensive tests |
| Single-file ESM breaks some edge case | CLI won't start for some users | Phase 2 is separate; can ship Phase 1 alone. Run full E2E before merging |
| Activity bar width 14 too wide on small terminals | Layout breaks below ~50 cols | Terminal apps typically assume 80+ cols. Add `min-width` guard if needed |

---

## Test Strategy

### Phase 1 Tests

1. **`use-navigation.test.ts`** — Section memory: switch sections, verify stacks preserved; cross-section nav; goBack at root
2. **`use-focus-zone.test.ts`** — Tab cycling between 2 zones; setActive
3. **`use-status-hints.test.ts`** — Correct hints for each zone/page combination
4. **`activity-bar.test.ts`** — Cursor visible when focused; labels always visible; active section highlighted
5. **`status-bar.test.ts`** — Renders zone-specific hints; updates when zone changes

### Phase 2 Tests

1. **Build output verification** — Single `.mjs` file exists, no `.js` or second `.mjs`
2. **Non-interactive smoke test** — `node main.mjs help` works without loading ink
3. **Interactive smoke test** — TUI launches and renders

---

## Implementation Order

**Phase 1** (UX — do first):
1. Update types (`FocusZone`, `NavigationState`, `SectionState`)
2. Rewrite `use-navigation.ts` with section memory + tests
3. Update `use-focus-zone.ts` to 2 zones + tests
4. Create `use-status-hints.ts` + tests
5. Wire focus into `app.tsx` (Tab, Escape, pass focus props)
6. Update `activity-bar.tsx` (width, labels, cursor, focus styling) + tests
7. Update `content-area.tsx` (pass `focused`/`enabled`)
8. Update `status-bar.tsx` (dynamic hints) + tests
9. Update `use-keyboard.ts` (Enter on section)
10. Verify ListPage/FormPage/DashboardPage respect `enabled`

**Phase 2** (Build — do after Phase 1 is stable):
1. Modify `esbuild.config.mjs` to single ESM output
2. Remove `pathToFileURL` hack from `main.ts`
3. Update `bootstrap.mjs` to reference `main.mjs`
4. Verify non-interactive commands still work
5. Verify interactive TUI still launches
6. Remove stale bundle references
