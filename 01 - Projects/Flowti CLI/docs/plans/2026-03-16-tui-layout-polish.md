# TUI Layout Polish — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Closed — Delivered. Primitives now used by functional parity design.

**Goal:** Fix layout sizing, scroll jumping, and text overflow so the TUI fits any terminal without jitter.

**Architecture:** Replace hardcoded widths with Ink flexbox properties (`flexBasis`, `flexShrink`, `flexGrow`). Replace derived scroll offset with stateful follow-cursor pattern. Memoize detail panel to prevent full re-renders.

**Tech Stack:** React 19, Ink 6, Vitest, ink-testing-library 4

**Spec:** `docs/specs/2026-03-16-tui-layout-polish-design.md`

**Run all tests:** `npx vitest run --config configs/vitest.config.ts`
**Run TUI tests only:** `npx vitest run tests/tui/ --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Scroll Stability

Fix the scroll jumping first — it's the most disruptive UX issue.

### Task 1: Fix ScrollableList — stateful follow-cursor offset

**Files:**
- Modify: `src/tui/primitives/scrollable-list.tsx`
- Modify: `tests/tui/primitives/primitives.test.ts`

- [ ] **Step 1: Add test for scroll stability**

In `tests/tui/primitives/primitives.test.ts`, add to the `ScrollableList` describe block:

```typescript
it("does not jump when selection stays in view", () => {
	const items = Array.from({ length: 20 }, (_, i) => `Item ${i}`);
	const { unmount, rerender, ...inst } = render(
		React.createElement(ScrollableList, {
			items,
			selected: 0,
			renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
			maxHeight: 5,
		}),
	);
	// Move to item 2 — should not change scroll, still in view
	rerender(React.createElement(ScrollableList, {
		items,
		selected: 2,
		renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
		maxHeight: 5,
	}));
	const f = frame(inst);
	// Item 0 should still be visible (scroll didn't move)
	expect(f).toContain("Item 0");
	expect(f).toContain("Item 2");
	unmount();
});

it("scrolls when selection reaches edge", () => {
	const items = Array.from({ length: 20 }, (_, i) => `Item ${i}`);
	const { unmount, rerender, ...inst } = render(
		React.createElement(ScrollableList, {
			items,
			selected: 0,
			renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
			maxHeight: 5,
		}),
	);
	// Move to item 6 — beyond visible window, must scroll
	rerender(React.createElement(ScrollableList, {
		items,
		selected: 6,
		renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
		maxHeight: 5,
	}));
	const f = frame(inst);
	expect(f).toContain("Item 6");
	// Item 0 should no longer be visible
	expect(f).not.toContain("Item 0");
	unmount();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts`

Expected: New tests FAIL — current centering logic makes "Item 0" disappear when selected is 2.

- [ ] **Step 3: Rewrite ScrollableList with stateful offset**

Replace the entire contents of `src/tui/primitives/scrollable-list.tsx`:

```typescript
/**
 * scrollable-list.tsx — Arrow-key navigable list with virtualization.
 *
 * Uses a stateful scroll offset with follow-cursor behavior:
 * scroll stays still until the selection moves out of the visible window.
 */

import React, { useState, useEffect } from "react";
import { Box, Text, useStdout } from "ink";

interface ScrollableListProps<T> {
	readonly items: readonly T[];
	readonly selected: number;
	readonly renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
	readonly onSelect?: (index: number) => void;
	readonly maxHeight?: number;
}

export function ScrollableList<T>({ items, selected, renderItem, maxHeight }: ScrollableListProps<T>): React.JSX.Element {
	const { stdout } = useStdout();
	const termRows = stdout?.rows ?? 24;
	const visibleCount = maxHeight ?? Math.max(3, termRows - 10);
	const [scrollOffset, setScrollOffset] = useState(0);

	useEffect(() => {
		setScrollOffset((prev) => {
			if (selected < prev) return selected;
			if (selected >= prev + visibleCount) return selected - visibleCount + 1;
			return prev;
		});
	}, [selected, visibleCount]);

	const safeOffset = Math.max(0, Math.min(scrollOffset, items.length - visibleCount));
	const visibleItems = items.slice(safeOffset, safeOffset + visibleCount);

	if (items.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No items</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{safeOffset > 0 && <Text dimColor> {"  \u25B2 more"}</Text>}
			{visibleItems.map((item, vi) => {
				const actualIndex = safeOffset + vi;
				const isSelected = actualIndex === selected;
				return (
					<Box key={actualIndex} paddingLeft={1}>
						<Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
							{isSelected ? "\u25B6 " : "  "}
						</Text>
						{renderItem(item, actualIndex, isSelected)}
					</Box>
				);
			})}
			{safeOffset + visibleCount < items.length && <Text dimColor> {"  \u25BC more"}</Text>}
		</Box>
	);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts`

Expected: All ScrollableList tests PASS (existing + 2 new).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/scrollable-list.tsx" "01 - Projects/Flowti CLI/tests/tui/primitives/primitives.test.ts"
git commit -m "fix(tui): scroll stays stable — follow-cursor offset instead of centering"
```

### Task 2: Memoize detail in ListPage

**Files:**
- Modify: `src/tui/pages/list-page.tsx`

- [ ] **Step 1: Add useMemo for detail**

Replace the entire contents of `src/tui/pages/list-page.tsx`:

```typescript
/**
 * list-page.tsx — Generic list+detail page pattern.
 *
 * Renders a ScrollableList with optional MasterDetail panel.
 * Handles arrow-key navigation and item selection.
 * Detail panel is memoized to prevent master list re-renders.
 */

import React, { useState, useMemo } from "react";
import { Box, useInput } from "ink";
import { ScrollableList } from "../primitives/scrollable-list.js";
import { MasterDetail } from "../primitives/master-detail.js";
import { ActionBar } from "../primitives/action-bar.js";
import type { ActionDef } from "../primitives/action-bar.js";

interface ListPageProps<T> {
	readonly items: readonly T[];
	readonly renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
	readonly renderDetail?: (item: T) => React.ReactNode;
	readonly actions?: readonly ActionDef[];
	readonly onSelect?: (item: T, index: number) => void;
	readonly enabled?: boolean;
}

export function ListPage<T>({ items, renderItem, renderDetail, actions, onSelect, enabled = true }: ListPageProps<T>): React.JSX.Element {
	const [selected, setSelected] = useState(0);

	useInput((_input, key) => {
		if (!enabled) return;
		if (key.upArrow && selected > 0) setSelected((s) => s - 1);
		if (key.downArrow && selected < items.length - 1) setSelected((s) => s + 1);
		if (key.return && items[selected] && onSelect) onSelect(items[selected], selected);
	});

	const list = (
		<ScrollableList
			items={items}
			selected={selected}
			renderItem={renderItem}
		/>
	);

	const detail = useMemo(
		() => renderDetail && items[selected] ? renderDetail(items[selected]) : undefined,
		[renderDetail, items, selected],
	);

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexGrow={1}>
				{renderDetail ? (
					<MasterDetail master={list} detail={detail} />
				) : (
					list
				)}
			</Box>
			{actions && actions.length > 0 && <ActionBar actions={actions} />}
		</Box>
	);
}
```

Note: `masterWidth` prop removed — MasterDetail will use flexbox instead.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors. If any pages pass `masterWidth` to ListPage, they'll get a compile error — fix by removing the prop.

- [ ] **Step 3: Run TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/list-page.tsx"
git commit -m "fix(tui): memoize detail panel, remove masterWidth prop from ListPage"
```

---

## Chunk 2: Flexbox Layout

### Task 3: MasterDetail — flexbox instead of fixed width

**Files:**
- Modify: `src/tui/primitives/master-detail.tsx`

- [ ] **Step 1: Replace fixed width with flexBasis**

Replace the entire contents of `src/tui/primitives/master-detail.tsx`:

```typescript
/**
 * master-detail.tsx — Split panel layout.
 *
 * Renders master (left) and detail (right) panes side by side.
 * Master gets 40% width via flexBasis, detail fills the rest.
 */

import React from "react";
import { Box } from "ink";

interface MasterDetailProps {
	readonly master: React.ReactNode;
	readonly detail?: React.ReactNode;
}

export function MasterDetail({ master, detail }: MasterDetailProps): React.JSX.Element {
	return (
		<Box flexDirection="row" flexGrow={1}>
			<Box flexDirection="column" flexBasis="40%" flexShrink={0} overflow="hidden" borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
				{master}
			</Box>
			{detail !== undefined && (
				<Box flexDirection="column" flexGrow={1} paddingLeft={1}>
					{detail}
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts`

Expected: MasterDetail tests PASS — they check for content ("LIST", "DETAIL"), not width.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: Compile errors if any file passes `masterWidth` to MasterDetail. Fix by removing the prop from callsites.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/master-detail.tsx"
git commit -m "feat(tui): MasterDetail uses flexBasis 40% instead of fixed width"
```

### Task 4: ActivityBar — flexbox natural width

**Files:**
- Modify: `src/tui/shell/activity-bar.tsx`
- Modify: `tests/tui/shell/activity-bar.test.ts`

- [ ] **Step 1: Replace hardcoded width with flexShrink**

Replace the entire contents of `src/tui/shell/activity-bar.tsx`:

```typescript
/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons with labels.
 * When focused: shows cursor indicator on the cursor section.
 * Active section is highlighted. Width determined by content via flexbox.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Section } from "../types.js";

interface ActivityBarProps {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly focused: boolean;
	readonly cursorSection: string;
	readonly onSelect: (sectionId: string) => void;
}

export function ActivityBar({ sections, activeSection, focused, cursorSection }: ActivityBarProps): React.JSX.Element {
	return (
		<Box
			flexDirection="column"
			flexShrink={0}
			borderStyle="single"
			borderRight
			borderTop={false}
			borderBottom={false}
			borderLeft={false}
			borderColor={focused ? "cyan" : undefined}
		>
			{sections.map((section) => {
				const isActive = section.id === activeSection;
				const isCursor = focused && section.id === cursorSection;
				const prefix = isCursor ? "\u25B8 " : "  ";
				const color = isCursor ? "cyan" : isActive ? "white" : undefined;
				return (
					<Box key={section.id} paddingX={1}>
						<Text bold={isCursor || isActive} color={color} dimColor={!isActive && !isCursor} wrap="truncate">
							{prefix}{section.icon} {section.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run tests/tui/shell/activity-bar.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS. Tests check for labels/icons/cursor, not width values.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/activity-bar.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/activity-bar.test.ts"
git commit -m "feat(tui): ActivityBar uses flexShrink natural width instead of fixed 14"
```

---

## Chunk 3: Text Overflow + Verification

### Task 5: Add truncation to agent list items

**Files:**
- Modify: `src/tui/pages/ai-tools-page.tsx`

- [ ] **Step 1: Add wrap="truncate" to renderItem**

In `src/tui/pages/ai-tools-page.tsx`, update the `renderItem` function. Change line 26:

```typescript
// Before:
return React.createElement(Text, { bold: sel },

// After:
return React.createElement(Text, { bold: sel, wrap: "truncate" },
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/ai-tools-page.tsx"
git commit -m "fix(tui): truncate long agent names in list items"
```

### Task 6: Full verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 2: Run all TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: Build and smoke test**

Run (from project root): `node configs/esbuild.config.mjs`

Then from vault root: `.\flowti.cmd`

Verify:
1. Sidebar shows all section labels, naturally sized
2. Navigate to Agents — list fills left panel, detail fills right
3. Arrow down through agents — list does NOT jump, scrolls smoothly when cursor reaches edge
4. Long agent names truncate with ellipsis
5. Resize terminal — layout adapts proportionally
