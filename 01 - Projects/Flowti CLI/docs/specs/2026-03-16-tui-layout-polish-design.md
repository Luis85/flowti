# TUI Layout Polish — Design Spec

**Date**: 2026-03-16
**Branch**: `feat/iter-5/tui-ux-overhaul`
**Status**: Approved
**Scope**: Fix layout sizing, scroll jumping, and text overflow in the TUI

---

## Problem

The TUI has hardcoded widths that waste space (sidebar 14 cols, master list 30 cols), a scroll implementation that jumps to center the selection on every keystroke, and no text truncation for long content. The result is a cramped, jittery UI.

## Design Goals

| Priority | Goal |
|----------|------|
| P0 | Layout adapts naturally to any terminal size via Ink's flexbox |
| P0 | List navigation doesn't jump — scroll stays stable, follows cursor to edges |
| P1 | Long text truncates instead of wrapping/overflowing |

---

## Section 1: Flexbox-Only Layout

Remove all hardcoded `width` props. Let Ink's Yoga layout engine distribute space.

### ActivityBar

**Current**: `width={14}` (normal) / `width={4}` (compact <50 cols).

**New**: Remove `width` prop entirely. Use `flexShrink={0}` so the bar doesn't collapse, and let content width determine the bar size. Labels use `wrap="truncate"` to prevent overflow on very narrow terminals. Remove the `useStdout()` / compact mode logic — flexbox handles it naturally.

### MasterDetail

**Current**: `width={masterWidth ?? 30}` on master panel — fixed 30 columns.

**New**: Replace with `flexBasis="40%" flexShrink={0}` on master. Detail keeps `flexGrow={1}`. Remove the `masterWidth` prop from the component interface entirely. Add `overflow="hidden"` to the master Box so content can't bleed.

### Result

Sidebar, master, and detail all flex naturally. Narrow terminal — everything shrinks proportionally. Wide terminal — detail gets the extra space. No breakpoints, no column counting.

---

## Section 2: Scroll Stability

### ScrollableList

**Current**: `scrollStart` is derived every render as `selected - visibleCount/2`. Every arrow key recenters the list.

**New**: Track `scrollOffset` in `useState`. Only adjust when selection moves out of the visible window:
- `selected < scrollOffset` → set `scrollOffset = selected`
- `selected >= scrollOffset + visibleCount` → set `scrollOffset = selected - visibleCount + 1`
- Otherwise → don't move

This is the standard "follow cursor" pattern. The list stays still until selection reaches an edge.

### ListPage

**Current**: `detail` JSX is recreated on every render, triggering full MasterDetail re-render.

**New**: Wrap `detail` in `useMemo` keyed on `selected` index. The master list component stays stable — React sees the same element reference and skips re-rendering it.

---

## Section 3: Text Overflow

### List Items

Add `wrap="truncate"` to Text elements inside `renderItem` callbacks (ai-tools-page and other pages using ListPage). Long agent names, badges, and domain text get truncated instead of wrapping.

### MasterDetail Master Panel

Add `overflow="hidden"` to the master Box (already covered in Section 1).

---

## File Inventory

| File | Change | LOC |
|------|--------|-----|
| `src/tui/shell/activity-bar.tsx` | Remove `width`, `useStdout`, compact logic. Use `flexShrink={0}`, `wrap="truncate"` | ~-15, +5 |
| `src/tui/primitives/master-detail.tsx` | Replace `width={masterWidth}` with `flexBasis="40%" flexShrink={0}`, add `overflow="hidden"`. Remove `masterWidth` prop | ~-5, +5 |
| `src/tui/primitives/scrollable-list.tsx` | Replace derived `scrollStart` with stateful `scrollOffset`, follow-cursor logic | ~-5, +15 |
| `src/tui/pages/list-page.tsx` | Memoize `detail` with `useMemo`. Remove `masterWidth` prop usage | ~+5 |
| `src/tui/pages/ai-tools-page.tsx` | Add `wrap="truncate"` to renderItem Text | +1 |
| `tests/tui/primitives/primitives.test.ts` | Update ScrollableList tests for new scroll behavior | ~+10 |
| **Total** | | ~80 LOC net |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Flexbox sidebar too narrow for labels on very small terminals | Low | `flexShrink={0}` prevents collapse below content width. Labels truncate via `wrap="truncate"` |
| 40% master basis too wide on very wide terminals | Low | `flexShrink={0}` + `flexBasis` means it stays at 40%, detail gets the rest. Acceptable ratio |
| `useMemo` on detail might cache stale data | Low | Keyed on `selected` — updates exactly when selection changes |
| Removing `masterWidth` prop breaks pages that pass it | Low | Only `ai-tools-page` passes it (and it's optional). Other pages use default |

---

## Test Strategy

- Update ScrollableList tests: verify offset stays stable when selection is in view, scrolls when selection reaches edge
- Verify ActivityBar tests still pass (they test for labels/icons, not width)
- Verify MasterDetail tests (if any) handle flexBasis instead of width
- Manual verification: resize terminal, navigate lists, confirm no jumping
