# TUI UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Closed — Delivered. Phase 2 (single-file build) absorbed into functional parity plan.

**Goal:** Fix TUI navigation with VS Code-style focus zones — Tab switches between activity bar and content, arrow keys navigate within the focused zone, status bar shows context-aware hints.

**Architecture:** Two focus zones (`activity-bar`, `content`) managed by `useFocusZone` hook. Navigation state redesigned to store per-section page stacks so switching sections resumes where you left off. All keyboard input gated by `enabled` props tied to focus zone. Status hints computed dynamically.

**Tech Stack:** React 19, Ink 6, ink-testing-library 4, Vitest

**Spec:** `docs/specs/2026-03-16-tui-ux-overhaul-design.md`

**Run all tests:** `npx vitest run --config configs/vitest.config.ts`
**Run TUI tests only:** `npx vitest run tests/tui/ --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Types & Focus Zone (foundation)

Update the shared types and simplify the focus zone hook from 3 zones to 2.

### Task 1: Update FocusZone type

**Files:**
- Modify: `src/tui/types.ts`

- [ ] **Step 1: Update the FocusZone type to 2 zones**

In `src/tui/types.ts`, change the `FocusZone` type from 3 zones to 2:

```typescript
// Replace this line:
export type FocusZone = "activity-bar" | "content" | "actions";

// With:
export type FocusZone = "activity-bar" | "content";
```

- [ ] **Step 2: Add `enabled` to PageProps**

In `src/tui/types.ts`, add `enabled?: boolean` to `PageProps` so ContentArea can pass focus state to pages:

```typescript
// Add to PageProps interface:
export interface PageProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly onAction?: (actionId: string, params?: Record<string, string>) => void;
	readonly enabled?: boolean;
}
```

- [ ] **Step 3: Add SectionState and update NavigationState**

In `src/tui/types.ts`, replace the `NavigationState` interface and add `SectionState`:

```typescript
// Replace:
export interface NavigationState {
	readonly section: string;
	readonly pageStack: readonly string[];
	readonly params: Readonly<Record<string, string>>;
}

// With:
export interface SectionState {
	readonly pageStack: readonly string[];
	readonly params: Readonly<Record<string, string>>;
}

export interface NavigationState {
	readonly activeSection: string;
	readonly sections: Readonly<Record<string, SectionState>>;
}
```

- [ ] **Step 4: Run type check to see what breaks**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: Multiple errors in files that reference `state.section`, `state.pageStack`, `state.params`. This is expected — we'll fix them in subsequent tasks.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/types.ts"
git commit -m "refactor(tui): update FocusZone to 2 zones, add SectionState, add enabled to PageProps"
```

### Task 2: Update use-focus-zone hook and tests

**Files:**
- Modify: `src/tui/hooks/use-focus-zone.ts`
- Modify: `tests/tui/hooks/use-focus-zone.test.ts`

- [ ] **Step 1: Update the test to use 2 zones**

Replace the entire contents of `tests/tui/hooks/use-focus-zone.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useFocusZone } from "../../../src/tui/hooks/use-focus-zone.js";
import type { FocusZone } from "../../../src/tui/types.js";

interface FocusResult {
	active: FocusZone;
	next: () => void;
	prev: () => void;
	setActive: (zone: FocusZone) => void;
}

function FocusHarness({ resultRef }: { resultRef: React.MutableRefObject<FocusResult | null> }): React.JSX.Element {
	const result = useFocusZone(["activity-bar", "content"]);
	resultRef.current = result;
	return React.createElement(Text, null, result.active);
}

function renderFocus() {
	const resultRef: React.MutableRefObject<FocusResult | null> = { current: null };
	const instance = render(React.createElement(FocusHarness, { resultRef }));
	return { ...instance, focus: () => resultRef.current! };
}

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

describe("useFocusZone", () => {
	it("starts at content zone (zones[1])", () => {
		const { unmount, focus } = renderFocus();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("next cycles from content to activity-bar", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("next wraps from activity-bar back to content", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		focus().next();
		await flush();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("prev cycles from content to activity-bar", async () => {
		const { unmount, focus } = renderFocus();
		focus().prev();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("setActive jumps to a zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().setActive("activity-bar");
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});
});
```

- [ ] **Step 2: Run the updated test**

Run: `npx vitest run tests/tui/hooks/use-focus-zone.test.ts --config configs/vitest.config.ts`

Expected: All 5 tests PASS. The hook implementation doesn't need changes — it already works with any zone array. Only the test needed updating to reflect the 2-zone model.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/tui/hooks/use-focus-zone.test.ts"
git commit -m "test(tui): update focus zone tests for 2-zone model"
```

### Task 3: Rewrite use-navigation with section memory

**Files:**
- Modify: `src/tui/navigation/use-navigation.ts`
- Modify: `tests/tui/navigation/use-navigation.test.ts`

- [ ] **Step 1: Write the new tests first**

Replace the entire contents of `tests/tui/navigation/use-navigation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useNavigation } from "../../../src/tui/navigation/use-navigation.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";
import type { NavigationState } from "../../../src/tui/types.js";

interface HarnessActions {
	navigate: (pageId: string, params?: Record<string, string>) => void;
	goBack: () => void;
	setSection: (sectionId: string) => void;
}

const actionsRef: { current: HarnessActions | null } = { current: null };

function NavigationHarness(): React.JSX.Element {
	const sections = buildSections();
	const nav = useNavigation(sections);
	actionsRef.current = { navigate: nav.navigate, goBack: nav.goBack, setSection: nav.setSection };
	return React.createElement(Text, null, JSON.stringify(nav.state));
}

function parseState(frame: string | undefined): NavigationState {
	return JSON.parse(frame ?? "{}");
}

function flush(): Promise<void> {
	return new Promise((r) => setTimeout(r, 0));
}

function activeStack(state: NavigationState): readonly string[] {
	return state.sections[state.activeSection].pageStack;
}

function activeParams(state: NavigationState): Readonly<Record<string, string>> {
	return state.sections[state.activeSection].params;
}

describe("useNavigation", () => {
	it("starts at home section with start page", () => {
		const inst = render(React.createElement(NavigationHarness));
		const state = parseState(inst.lastFrame());
		expect(state.activeSection).toBe("home");
		expect(activeStack(state)).toEqual(["start"]);
		inst.unmount();
	});

	it("navigate cross-section replaces target stack with page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeStack(state)).toEqual(["ai-tools"]);
		expect(state.activeSection).toBe("agents");
		inst.unmount();
	});

	it("navigate passes params", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeParams(state)).toEqual({ name: "bob" });
		inst.unmount();
	});

	it("goBack pops the stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		actionsRef.current!.goBack();
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeStack(state)).toEqual(["ai-tools"]);
		expect(state.activeSection).toBe("agents");
		inst.unmount();
	});

	it("goBack at root returns atRoot flag", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.goBack();
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeStack(state)).toEqual(["start"]);
		inst.unmount();
	});

	it("setSection switches and initializes landing page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.setSection("reports");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.activeSection).toBe("reports");
		expect(activeStack(state)).toEqual(["reports"]);
		inst.unmount();
	});

	it("setSection preserves previous section state", async () => {
		const inst = render(React.createElement(NavigationHarness));
		// Navigate deep into agents
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		// Switch to reports
		actionsRef.current!.setSection("reports");
		await flush();
		// Switch back to agents — should resume where we left off
		actionsRef.current!.setSection("agents");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.activeSection).toBe("agents");
		expect(activeStack(state)).toEqual(["ai-tools", "agent-detail"]);
		expect(activeParams(state)).toEqual({ name: "bob" });
		inst.unmount();
	});

	it("navigate within same section pushes onto stack", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.setSection("agents");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "alice" });
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeStack(state)).toEqual(["ai-tools", "agent-detail"]);
		expect(activeParams(state)).toEqual({ name: "alice" });
		inst.unmount();
	});

	it("navigate auto-switches section for cross-section targets", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("iterations");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(state.activeSection).toBe("management");
		expect(activeStack(state)).toEqual(["iterations"]);
		inst.unmount();
	});

	it("setSection to same section resets to landing page", async () => {
		const inst = render(React.createElement(NavigationHarness));
		actionsRef.current!.navigate("ai-tools");
		await flush();
		actionsRef.current!.navigate("agent-detail", { name: "bob" });
		await flush();
		// Re-select same section → resets
		actionsRef.current!.setSection("agents");
		await flush();
		const state = parseState(inst.lastFrame());
		expect(activeStack(state)).toEqual(["ai-tools"]);
		inst.unmount();
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/tui/navigation/use-navigation.test.ts --config configs/vitest.config.ts`

Expected: FAIL — tests reference `state.activeSection` and `state.sections` which don't exist yet.

- [ ] **Step 3: Rewrite the use-navigation hook**

Replace the entire contents of `src/tui/navigation/use-navigation.ts`:

```typescript
/**
 * use-navigation.ts — Navigation state machine hook for the TUI shell.
 *
 * Manages per-section page stacks (section memory), cross-section navigation,
 * and breadcrumb-compatible page history.
 */

import { useState, useCallback } from "react";
import type { Section, NavigationState, SectionState } from "../types.js";
import { findSectionForPage } from "./section-map.js";

interface UseNavigationResult {
	readonly state: NavigationState;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly setSection: (sectionId: string) => void;
}

function initSections(sections: readonly Section[]): Record<string, SectionState> {
	const map: Record<string, SectionState> = {};
	for (const s of sections) {
		map[s.id] = { pageStack: [s.pages[0]], params: {} };
	}
	return map;
}

export function useNavigation(sections: readonly Section[]): UseNavigationResult {
	const [state, setState] = useState<NavigationState>(() => ({
		activeSection: "home",
		sections: initSections(sections),
	}));

	const navigate = useCallback((pageId: string, params?: Record<string, string>) => {
		setState((prev) => {
			const targetSection = findSectionForPage(sections, pageId);
			if (!targetSection) return prev;

			if (targetSection === prev.activeSection) {
				// Same section — push onto current stack
				const current = prev.sections[prev.activeSection];
				return {
					...prev,
					sections: {
						...prev.sections,
						[prev.activeSection]: {
							pageStack: [...current.pageStack, pageId],
							params: params ?? {},
						},
					},
				};
			}

			// Cross-section — switch section and set page
			return {
				activeSection: targetSection,
				sections: {
					...prev.sections,
					[targetSection]: {
						pageStack: [pageId],
						params: params ?? {},
					},
				},
			};
		});
	}, [sections]);

	const goBack = useCallback(() => {
		setState((prev) => {
			const current = prev.sections[prev.activeSection];
			if (current.pageStack.length <= 1) return prev;
			return {
				...prev,
				sections: {
					...prev.sections,
					[prev.activeSection]: {
						pageStack: current.pageStack.slice(0, -1),
						params: {},
					},
				},
			};
		});
	}, []);

	const setSection = useCallback((sectionId: string) => {
		const section = sections.find((s) => s.id === sectionId);
		if (!section) return;
		setState((prev) => {
			if (sectionId === prev.activeSection) {
				// Re-selecting current section → reset to landing page
				return {
					...prev,
					sections: {
						...prev.sections,
						[sectionId]: { pageStack: [section.pages[0]], params: {} },
					},
				};
			}
			// Switch to section — preserve its existing state (section memory)
			return { ...prev, activeSection: sectionId };
		});
	}, [sections]);

	return { state, navigate, goBack, setSection };
}
```

- [ ] **Step 4: Run the navigation tests**

Run: `npx vitest run tests/tui/navigation/use-navigation.test.ts --config configs/vitest.config.ts`

Expected: All 10 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/navigation/use-navigation.ts" "01 - Projects/Flowti CLI/tests/tui/navigation/use-navigation.test.ts"
git commit -m "feat(tui): rewrite navigation with per-section page stacks (section memory)"
```

---

## Chunk 2: Shell Components (activity bar, status bar, content area)

Update the visual shell to support focus-aware rendering.

### Task 4: Update ActivityBar with focus-aware styling

**Files:**
- Modify: `src/tui/shell/activity-bar.tsx`
- Modify: `tests/tui/shell/activity-bar.test.ts`

- [ ] **Step 1: Write failing tests for new ActivityBar behavior**

Replace the entire contents of `tests/tui/shell/activity-bar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ActivityBar } from "../../../src/tui/shell/activity-bar.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ActivityBar", () => {
	const sections = buildSections();

	it("renders all section icons", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u{1F3E0}");
		expect(frame).toContain("\u{1F464}");
		expect(frame).toContain("\u{1F4CA}");
		unmount();
	});

	it("always shows labels for all sections", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Project");
		expect(frame).toContain("Reports");
		expect(frame).toContain("Manage");
		expect(frame).toContain("Help");
		unmount();
	});

	it("shows cursor indicator when focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: true, cursorSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("\u25B8");
		unmount();
	});

	it("does not show cursor when not focused", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", focused: false, cursorSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).not.toContain("\u25B8");
		unmount();
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/tui/shell/activity-bar.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `focused` and `cursorSection` props don't exist yet.

- [ ] **Step 3: Rewrite ActivityBar component**

Replace the entire contents of `src/tui/shell/activity-bar.tsx`:

```typescript
/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons with labels.
 * When focused: shows cursor indicator on the cursor section.
 * Active section is highlighted. Labels always visible.
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
			width={14}
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
						<Text bold={isCursor || isActive} color={color} dimColor={!isActive && !isCursor}>
							{prefix}{section.icon} {section.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
```

- [ ] **Step 4: Run ActivityBar tests**

Run: `npx vitest run tests/tui/shell/activity-bar.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/activity-bar.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/activity-bar.test.ts"
git commit -m "feat(tui): activity bar with focus-aware cursor, width 14, always-visible labels"
```

### Task 5: Create use-status-hints hook

**Files:**
- Create: `src/tui/hooks/use-status-hints.ts`
- Create: `tests/tui/hooks/use-status-hints.test.ts`

- [ ] **Step 1: Write the tests**

Create `tests/tui/hooks/use-status-hints.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getHintsForZone } from "../../../src/tui/hooks/use-status-hints.js";

describe("getHintsForZone", () => {
	it("returns activity-bar hints when zone is activity-bar", () => {
		const hints = getHintsForZone("activity-bar");
		const labels = hints.map((h) => h.label);
		expect(labels).toContain("Navigate");
		expect(labels).toContain("Open");
		expect(labels).toContain("Content");
		expect(labels).toContain("Quit");
	});

	it("returns content hints when zone is content", () => {
		const hints = getHintsForZone("content");
		const labels = hints.map((h) => h.label);
		expect(labels).toContain("Sidebar");
		expect(labels).toContain("Back");
		expect(labels).toContain("Quit");
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/tui/hooks/use-status-hints.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/tui/hooks/use-status-hints.ts`:

```typescript
/**
 * use-status-hints.ts — Compute status bar hints based on focus zone.
 *
 * Returns the appropriate key hints for the currently active focus zone.
 * Pure function — no React state needed.
 */

import type { FocusZone } from "../types.js";

interface KeyHint {
	readonly key: string;
	readonly label: string;
}

const ACTIVITY_BAR_HINTS: readonly KeyHint[] = [
	{ key: "\u2191\u2193", label: "Navigate" },
	{ key: "Enter", label: "Open" },
	{ key: "Tab", label: "Content" },
	{ key: "q", label: "Quit" },
];

const CONTENT_HINTS: readonly KeyHint[] = [
	{ key: "\u2191\u2193", label: "Navigate" },
	{ key: "Enter", label: "Select" },
	{ key: "Tab", label: "Sidebar" },
	{ key: "Esc", label: "Back" },
	{ key: "q", label: "Quit" },
];

const HINT_MAP: Record<FocusZone, readonly KeyHint[]> = {
	"activity-bar": ACTIVITY_BAR_HINTS,
	"content": CONTENT_HINTS,
};

export function getHintsForZone(zone: FocusZone): readonly KeyHint[] {
	return HINT_MAP[zone];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/hooks/use-status-hints.test.ts --config configs/vitest.config.ts`

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/use-status-hints.ts" "01 - Projects/Flowti CLI/tests/tui/hooks/use-status-hints.test.ts"
git commit -m "feat(tui): add getHintsForZone for zone-aware status bar hints"
```

### Task 6: Update StatusBar for dynamic hints

**Files:**
- Modify: `src/tui/shell/status-bar.tsx`
- Modify: `tests/tui/shell/status-bar.test.ts`

- [ ] **Step 1: Update tests — StatusBar receives hints from parent**

The StatusBar component doesn't need to change its interface — it already accepts `hints` as a prop. The parent (App) will compute the hints and pass them. Update the test to confirm it renders whatever hints it receives:

No changes needed to `tests/tui/shell/status-bar.test.ts` — the existing tests already verify this behavior. The zone-awareness lives in App, not StatusBar.

- [ ] **Step 2: Verify existing tests still pass**

Run: `npx vitest run tests/tui/shell/status-bar.test.ts --config configs/vitest.config.ts`

Expected: All 2 tests PASS.

- [ ] **Step 3: No commit needed — no changes**

### Task 7: Update ContentArea to accept focused prop

**Files:**
- Modify: `src/tui/shell/content-area.tsx`
- Modify: `tests/tui/shell/content-area.test.ts`

- [ ] **Step 1: Update the test to pass focused prop**

Replace the entire contents of `tests/tui/shell/content-area.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ContentArea } from "../../../src/tui/shell/content-area.js";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ContentArea", () => {
	it("renders placeholder for unknown page", () => {
		const { unmount, ...instance } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(ContentArea, {
					pageId: "unknown-page",
					params: {},
					navigate: () => {},
					goBack: () => {},
					focused: true,
				}),
			),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("unknown-page");
		expect(frame).toContain("migrated");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/tui/shell/content-area.test.ts --config configs/vitest.config.ts`

Expected: FAIL — `focused` prop not in interface.

- [ ] **Step 3: Add focused prop to ContentArea**

In `src/tui/shell/content-area.tsx`, update the interface and component:

```typescript
/**
 * content-area.tsx — Renders the active page component from the page registry.
 *
 * Passes `focused` (derived from focus zone) to the active page as `enabled`.
 * Pages that respect `enabled` will only consume keyboard input when content is focused.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import { getPage } from "../pages/page-registry.js";
import { useLoaderContext } from "../context.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly focused: boolean;
}

export function ContentArea({ pageId, params, navigate, goBack, focused }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const _ctx = useLoaderContext(params);
	const Page = getPage(pageId);

	const handleAction = (_actionId: string, _params?: Record<string, string>) => {
		setActionError(null);
	};

	return (
		<Box flexGrow={1} flexDirection="column">
			{actionError !== null && (
				<Box paddingX={1} marginBottom={1}>
					<Text color="red" bold>Error: {actionError} </Text>
					<Text dimColor>(press any key to dismiss)</Text>
				</Box>
			)}
			{React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction, enabled: focused })}
		</Box>
	);
}
```

Note: This passes `enabled` as an extra prop. Page components that accept it (ListPage, FormPage) will use it. Others will ignore it via React's prop spreading.

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/tui/shell/content-area.test.ts --config configs/vitest.config.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/content-area.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/content-area.test.ts"
git commit -m "feat(tui): ContentArea passes focused state as enabled to pages"
```

---

## Chunk 3: Wire App (the integration point)

Connect focus zones, keyboard handling, and navigation in the root App component.

### Task 8: Update use-keyboard with Enter handler

**Files:**
- Modify: `src/tui/navigation/use-keyboard.ts`
- Create: `tests/tui/navigation/use-keyboard.test.ts`

- [ ] **Step 1: Write tests for keyboard handler**

Create `tests/tui/navigation/use-keyboard.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useKeyboard } from "../../../src/tui/navigation/use-keyboard.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";

function KeyboardHarness({ onSectionChange, enabled }: { onSectionChange: (id: string) => void; enabled: boolean }): React.JSX.Element {
	const sections = buildSections();
	useKeyboard({ sections, activeSection: "home", onSectionChange, enabled });
	return React.createElement(Text, null, "keyboard-harness");
}

function KeyboardOpenHarness({ onSectionChange, onSectionOpen, enabled }: { onSectionChange: (id: string) => void; onSectionOpen: (id: string) => void; enabled: boolean }): React.JSX.Element {
	const sections = buildSections();
	useKeyboard({ sections, activeSection: "home", onSectionChange, onSectionOpen, enabled });
	return React.createElement(Text, null, "keyboard-harness");
}

describe("useKeyboard", () => {
	it("calls onSectionChange on down arrow when enabled", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: true }),
		);
		stdin.write("\u001B[B"); // down arrow
		expect(onSectionChange).toHaveBeenCalledWith("agents");
		unmount();
	});

	it("does not call onSectionChange when disabled", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: false }),
		);
		stdin.write("\u001B[B"); // down arrow
		expect(onSectionChange).not.toHaveBeenCalled();
		unmount();
	});

	it("calls onSectionChange with current section on Enter when no onSectionOpen", () => {
		const onSectionChange = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardHarness, { onSectionChange, enabled: true }),
		);
		stdin.write("\r"); // Enter
		expect(onSectionChange).toHaveBeenCalledWith("home");
		unmount();
	});

	it("calls onSectionOpen instead of onSectionChange when provided", () => {
		const onSectionChange = vi.fn();
		const onSectionOpen = vi.fn();
		const { unmount, stdin } = render(
			React.createElement(KeyboardOpenHarness, { onSectionChange, onSectionOpen, enabled: true }),
		);
		stdin.write("\r"); // Enter
		expect(onSectionOpen).toHaveBeenCalledWith("home");
		expect(onSectionChange).not.toHaveBeenCalled();
		unmount();
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run tests/tui/navigation/use-keyboard.test.ts --config configs/vitest.config.ts`

Expected: FAIL — Enter handler doesn't exist yet.

- [ ] **Step 3: Add Enter handler to use-keyboard**

Replace the entire contents of `src/tui/navigation/use-keyboard.ts`:

```typescript
/**
 * use-keyboard.ts — Keyboard handler for activity bar section navigation.
 *
 * Only active when the activity bar focus zone is active (enabled=true).
 * Handles: ↑↓ to move between sections, Enter to open/select section.
 * Escape is NOT handled here — it is handled exclusively in App.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly onSectionOpen?: (sectionId: string) => void;
	readonly enabled: boolean;
}

export function useKeyboard({ sections, activeSection, onSectionChange, onSectionOpen, enabled }: UseKeyboardOptions): void {
	useInput((_input, key) => {
		if (!enabled) return;
		if (key.upArrow) {
			const idx = sections.findIndex((s) => s.id === activeSection);
			if (idx > 0) {
				onSectionChange(sections[idx - 1].id);
			}
		}
		if (key.downArrow) {
			const idx = sections.findIndex((s) => s.id === activeSection);
			if (idx < sections.length - 1) {
				onSectionChange(sections[idx + 1].id);
			}
		}
		if (key.return) {
			if (onSectionOpen) {
				onSectionOpen(activeSection);
			} else {
				onSectionChange(activeSection);
			}
		}
	});
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/navigation/use-keyboard.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/navigation/use-keyboard.ts" "01 - Projects/Flowti CLI/tests/tui/navigation/use-keyboard.test.ts"
git commit -m "feat(tui): add Enter handler to activity bar keyboard navigation"
```

### Task 9: Rewrite App to wire everything together

**Files:**
- Modify: `src/tui/app.tsx`
- Modify: `tests/tui/app.test.ts`

- [ ] **Step 1: Update App tests for new behavior**

Replace the entire contents of `tests/tui/app.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/app.js";
import { TuiProvider } from "../../src/tui/context.js";
import type { TuiContextValue } from "../../src/tui/context.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

function renderApp() {
	return render(
		React.createElement(TuiProvider, { value: mockTuiContext },
			React.createElement(App, {}),
		),
	);
}

describe("App", () => {
	it("renders activity bar with all section labels", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Project");
		unmount();
	});

	it("renders header bar with breadcrumbs", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		unmount();
	});

	it("renders status bar with zone-aware hints", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		// Content zone is default focus — should show content hints
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Sidebar");
		unmount();
	});

	it("renders content area with start page", () => {
		const { unmount, ...instance } = renderApp();
		const frame = lastFrame(instance);
		expect(frame).toContain("start");
		unmount();
	});
});
```

- [ ] **Step 2: Rewrite App component**

Replace the entire contents of `src/tui/app.tsx`:

```typescript
/**
 * app.tsx — Root Ink component for the Flowti CLI TUI.
 *
 * Layout: ActivityBar (left) | Header + Content + StatusBar (right)
 *
 * Focus zones: Tab cycles between activity-bar and content.
 * Activity bar: ↑↓ move cursor, Enter opens section.
 * Content: keyboard delegated to page components.
 * Escape: goBack in content, or move focus to activity bar at root.
 */

import React, { useState, useCallback } from "react";
import { Box, useApp, useInput } from "ink";
import { buildSections } from "./navigation/section-map.js";
import { useNavigation } from "./navigation/use-navigation.js";
import { useFocusZone } from "./hooks/use-focus-zone.js";
import { useKeyboard } from "./navigation/use-keyboard.js";
import { getHintsForZone } from "./hooks/use-status-hints.js";
import { ActivityBar } from "./shell/activity-bar.js";
import { HeaderBar } from "./shell/header-bar.js";
import { ContentArea } from "./shell/content-area.js";
import { StatusBar } from "./shell/status-bar.js";
import type { Section, FocusZone } from "./types.js";

function buildBreadcrumbs(sections: readonly Section[], pageStack: readonly string[]): string[] {
	return pageStack.map((pageId) => {
		const section = sections.find((s) => s.pages.includes(pageId));
		if (section && section.pages[0] === pageId) return section.label;
		return pageId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	});
}

const ZONES: readonly FocusZone[] = ["activity-bar", "content"];

export function App(): React.JSX.Element {
	const { exit } = useApp();
	const sections = buildSections();
	const { state, navigate, goBack, setSection } = useNavigation(sections);
	const { active: focusZone, setActive: setFocusZone } = useFocusZone(ZONES);
	const [cursorSection, setCursorSection] = useState(state.activeSection);

	const handleSectionOpen = useCallback((sectionId: string) => {
		setSection(sectionId);
		setFocusZone("content");
	}, [setSection, setFocusZone]);

	// Activity bar keyboard (arrows + Enter) — only when bar is focused
	useKeyboard({
		sections,
		activeSection: cursorSection,
		onSectionChange: setCursorSection,
		onSectionOpen: handleSectionOpen,
		enabled: focusZone === "activity-bar",
	});

	// Global keys: Tab, Escape, Ctrl+N, q
	useInput((input, key) => {
		if (key.tab) {
			if (focusZone === "activity-bar") {
				setFocusZone("content");
			} else {
				setFocusZone("activity-bar");
				setCursorSection(state.activeSection);
			}
			return;
		}

		if (key.escape) {
			if (focusZone === "content") {
				const currentStack = state.sections[state.activeSection].pageStack;
				if (currentStack.length > 1) {
					goBack();
				} else {
					setFocusZone("activity-bar");
					setCursorSection(state.activeSection);
				}
			}
			return;
		}

		if (key.ctrl && input >= "1" && input <= "8") {
			const idx = parseInt(input, 10) - 1;
			if (idx < sections.length) {
				setSection(sections[idx].id);
				setCursorSection(sections[idx].id);
				setFocusZone("content");
			}
			return;
		}

		if (input === "q" && !key.ctrl && !key.meta) {
			exit();
		}
	});

	const activeState = state.sections[state.activeSection];
	const activePage = activeState.pageStack[activeState.pageStack.length - 1];
	const breadcrumbs = buildBreadcrumbs(sections, activeState.pageStack);
	const hints = getHintsForZone(focusZone);

	return (
		<Box flexDirection="row" width="100%" height="100%">
			<ActivityBar
				sections={sections}
				activeSection={state.activeSection}
				focused={focusZone === "activity-bar"}
				cursorSection={cursorSection}
				onSelect={handleSectionOpen}
			/>
			<Box flexDirection="column" flexGrow={1}>
				<HeaderBar breadcrumbs={breadcrumbs} />
				<ContentArea
					pageId={activePage}
					params={activeState.params}
					navigate={navigate}
					goBack={goBack}
					focused={focusZone === "content"}
				/>
				<StatusBar hints={hints} />
			</Box>
		</Box>
	);
}
```

- [ ] **Step 3: Run App tests**

Run: `npx vitest run tests/tui/app.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS.

- [ ] **Step 4: Run ALL TUI tests to check for regressions**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS across all TUI test files. If any fail, fix them before proceeding.

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No type errors. If there are errors, they'll likely be in:
- Pages that reference `state.section` (now `state.activeSection`)
- Pages that reference `state.pageStack` (now `state.sections[state.activeSection].pageStack`)

Fix any type errors by updating the references.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/app.tsx" "01 - Projects/Flowti CLI/tests/tui/app.test.ts"
git commit -m "feat(tui): wire VS Code-style focus zones with Tab, Escape, zone-aware hints"
```

---

## Chunk 4: Fix Remaining Type Errors and Integration

After the App rewrite, some files may reference the old NavigationState shape. Fix them.

### Task 10: Fix any remaining type errors

**Files:**
- Possibly modify: any file that imports `NavigationState` or accesses `.section`, `.pageStack`, `.params` on it

- [ ] **Step 1: Run type check and catalog errors**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Catalog all errors. Common patterns to fix:

1. `state.section` → `state.activeSection`
2. `state.pageStack` → `state.sections[state.activeSection].pageStack`
3. `state.params` → `state.sections[state.activeSection].params`

Most of these will be in `app.tsx` (already fixed) and possibly in page components that directly access navigation state (unlikely — pages receive `params` via props).

- [ ] **Step 2: Fix each error**

For each file with errors, update the references to match the new NavigationState shape. The most likely candidates are:
- `src/tui/tui-entry.ts` — if it references NavigationState (unlikely, it just creates context)
- Test files that import NavigationState

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: Run full project test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

Expected: All tests PASS (7000+ tests).

- [ ] **Step 5: Run lint**

Run: `npx eslint src/ --config configs/eslint.config.mjs`

Expected: No lint errors.

- [ ] **Step 6: Commit**

```bash
git add -A "01 - Projects/Flowti CLI/"
git commit -m "fix(tui): resolve remaining type errors from NavigationState migration"
```

### Task 11: Build and manual smoke test

**Files:**
- No source changes

- [ ] **Step 1: Build the CLI**

Run (from `01 - Projects/Flowti CLI/`): `node configs/esbuild.config.mjs`

Expected: Three bundles built successfully (main.js, tui.mjs, chat.mjs).

- [ ] **Step 2: Launch the TUI**

Run (from git root): `.\flowti.cmd`

Expected:
- Activity bar shows all 8 sections with labels (width 14)
- Content zone starts focused (content hints in status bar)
- Press **Tab** → focus moves to activity bar (cursor appears, hints change)
- Press **↓** → cursor moves down through sections
- Press **Enter** → section opens, focus returns to content
- Press **Esc** → goes back (or moves focus to activity bar at root)
- Press **Tab** → focus cycles back to content
- Press **q** → exits

- [ ] **Step 3: Test section memory**

1. Navigate to Agents section (Tab → ↓ to Agents → Enter)
2. Navigate deeper in content if possible
3. Tab → ↓ to Management → Enter
4. Tab → ↑ to Agents → Enter
5. **Expected**: Should resume where you left off in Agents

- [ ] **Step 4: No commit needed — this is verification only**

---

## Chunk 5: Chat Sub-Components

Build the 5 Ink components that `ink-chat-renderer.ts` imports from `./components/`. These files don't exist yet — the renderer's imports will fail without them. Each component is a pure presentational React component using `React.createElement` (`.ts` files, not `.tsx`, matching the renderer's convention).

**Prerequisite**: Chunks 1-4 must be complete before Chunk 5. Chunk 1 adds `enabled?: boolean` to `PageProps`, which Chunk 6 depends on.

**Key constraint**: These components are imported by BOTH the standalone ESM chat bundle (`chat.mjs`) AND the TUI page. They live at `src/infrastructure/chat/components/` to match the existing import paths in `ink-chat-renderer.ts`.

**Naming**: `HeaderBar` and `ActivityBar` here are chat-specific — they are NOT the same as the shell's `HeaderBar`/`ActivityBar`. The chat uses them internally with short names; the TUI page will import with aliased names if needed.

### Task 12: Create ChatHeaderBar component

**Files:**
- Create: `src/infrastructure/chat/components/header-bar.ts`
- Create: `tests/infrastructure/chat/components/header-bar.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/infrastructure/chat/components/header-bar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HeaderBar } from "../../../../src/infrastructure/chat/components/header-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Chat HeaderBar", () => {
	it("renders agent name", () => {
		const { unmount, ...inst } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "idle" }),
		);
		expect(lastFrame(inst)).toContain("Atlas");
		unmount();
	});

	it("renders status indicator", () => {
		const { unmount, ...inst } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "thinking" }),
		);
		expect(lastFrame(inst)).toContain("thinking");
		unmount();
	});

	it("renders persona when provided", () => {
		const { unmount, ...inst } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "idle", persona: "Product Lead" }),
		);
		expect(lastFrame(inst)).toContain("Product Lead");
		unmount();
	});

	it("renders topic name when provided", () => {
		const { unmount, ...inst } = render(
			React.createElement(HeaderBar, { agentName: "Atlas", status: "idle", topicName: "thread-123" }),
		);
		expect(lastFrame(inst)).toContain("thread-123");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/infrastructure/chat/components/header-bar.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/infrastructure/chat/components/header-bar.ts`:

```typescript
/**
 * header-bar.ts — Chat session header showing agent identity and status.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface HeaderBarProps {
	readonly agentName: string;
	readonly persona?: string;
	readonly status: ChatViewStatus;
	readonly topicName?: string;
}

const STATUS_COLORS: Record<ChatViewStatus, string> = {
	idle: "green",
	thinking: "yellow",
	working: "cyan",
	waiting: "blue",
	error: "red",
};

const STATUS_ICONS: Record<ChatViewStatus, string> = {
	idle: "\u25CF",
	thinking: "\u25CB",
	working: "\u25D4",
	waiting: "\u25CB",
	error: "\u25CF",
};

export function HeaderBar({ agentName, persona, status, topicName }: HeaderBarProps): React.JSX.Element {
	return React.createElement(
		Box,
		{ borderStyle: "single", borderBottom: true, borderTop: false, borderLeft: false, borderRight: false, paddingX: 1, justifyContent: "space-between" },
		React.createElement(
			Box,
			{ gap: 1 },
			React.createElement(Text, { bold: true }, agentName),
			persona ? React.createElement(Text, { dimColor: true }, `(${persona})`) : null,
			React.createElement(Text, { color: STATUS_COLORS[status] }, `${STATUS_ICONS[status]} ${status}`),
		),
		topicName ? React.createElement(Text, { dimColor: true }, topicName) : null,
	);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/infrastructure/chat/components/header-bar.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/header-bar.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/components/header-bar.test.ts"
git commit -m "feat(chat): add HeaderBar component — agent name, status, persona, topic"
```

### Task 13: Create MessageArea component

**Files:**
- Create: `src/infrastructure/chat/components/message-area.ts`
- Create: `tests/infrastructure/chat/components/message-area.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/infrastructure/chat/components/message-area.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { MessageArea } from "../../../../src/infrastructure/chat/components/message-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Chat MessageArea", () => {
	it("renders messages", () => {
		const { unmount, ...inst } = render(
			React.createElement(MessageArea, {
				summary: "",
				recentTurns: [],
				messages: [
					{ role: "user", content: "Hello", timestamp: "2026-03-16T10:00:00Z" },
					{ role: "agent", content: "Hi there!", timestamp: "2026-03-16T10:00:01Z" },
				],
				streamingText: "",
				streamingThinking: "",
				agentName: "Atlas",
				agentStatus: "idle",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Hello");
		expect(frame).toContain("Hi there!");
		unmount();
	});

	it("renders streaming text when present", () => {
		const { unmount, ...inst } = render(
			React.createElement(MessageArea, {
				summary: "",
				recentTurns: [],
				messages: [],
				streamingText: "I am currently",
				streamingThinking: "",
				agentName: "Atlas",
				agentStatus: "thinking",
				toolsExpanded: false,
			}),
		);
		expect(lastFrame(inst)).toContain("I am currently");
		unmount();
	});

	it("renders summary when provided", () => {
		const { unmount, ...inst } = render(
			React.createElement(MessageArea, {
				summary: "Resuming conversation",
				recentTurns: [{ role: "user", content: "prior msg", timestamp: "2026-03-16T09:00:00Z" }],
				messages: [],
				streamingText: "",
				streamingThinking: "",
				agentName: "Atlas",
				agentStatus: "idle",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Resuming conversation");
		expect(frame).toContain("prior msg");
		unmount();
	});

	it("shows empty state when no messages", () => {
		const { unmount, ...inst } = render(
			React.createElement(MessageArea, {
				summary: "",
				recentTurns: [],
				messages: [],
				streamingText: "",
				streamingThinking: "",
				agentName: "Atlas",
				agentStatus: "idle",
				toolsExpanded: false,
			}),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Type a message");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/infrastructure/chat/components/message-area.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/infrastructure/chat/components/message-area.ts`:

```typescript
/**
 * message-area.ts — Scrollable conversation message display.
 *
 * Shows conversation history, recent turns (from persistence), current messages,
 * and live streaming text/thinking preview.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatMessage, ChatTurn, ChatViewStatus } from "../chat-renderer-types.js";

interface MessageAreaProps {
	readonly summary: string;
	readonly recentTurns: readonly ChatTurn[];
	readonly messages: readonly ChatMessage[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly agentName: string;
	readonly agentStatus: ChatViewStatus;
	readonly toolsExpanded: boolean;
}

function renderTurn(turn: ChatTurn, i: number, agentName: string): React.JSX.Element {
	const isUser = turn.role === "user";
	const label = isUser ? "You" : agentName;
	return React.createElement(
		Box,
		{ key: `turn-${i}`, flexDirection: "column", paddingX: 1, marginBottom: 0 },
		React.createElement(Text, { bold: true, color: isUser ? "green" : "cyan" }, `${label}: `),
		React.createElement(Text, { wrap: "wrap" }, turn.content),
	);
}

function renderMessage(msg: ChatMessage, i: number, agentName: string): React.JSX.Element {
	const isUser = msg.role === "user";
	const label = isUser ? "You" : agentName;
	return React.createElement(
		Box,
		{ key: `msg-${i}`, flexDirection: "column", paddingX: 1, marginBottom: 0 },
		React.createElement(Text, { bold: true, color: isUser ? "green" : "cyan" }, `${label}: `),
		React.createElement(Text, { wrap: "wrap" }, msg.content),
	);
}

export function MessageArea({ summary, recentTurns, messages, streamingText, streamingThinking, agentName, agentStatus }: MessageAreaProps): React.JSX.Element {
	const hasContent = summary !== "" || recentTurns.length > 0 || messages.length > 0 || streamingText !== "";

	if (!hasContent) {
		return React.createElement(
			Box,
			{ flexGrow: 1, alignItems: "center", justifyContent: "center" },
			React.createElement(Text, { dimColor: true }, "Type a message to start chatting"),
		);
	}

	return React.createElement(
		Box,
		{ flexDirection: "column", flexGrow: 1, overflow: "hidden" },
		summary !== "" ? React.createElement(
			Box,
			{ paddingX: 1, marginBottom: 1 },
			React.createElement(Text, { dimColor: true, italic: true }, summary),
		) : null,
		...recentTurns.map((t, i) => renderTurn(t, i, agentName)),
		recentTurns.length > 0 && messages.length > 0
			? React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { dimColor: true }, "\u2500".repeat(40)))
			: null,
		...messages.map((m, i) => renderMessage(m, i, agentName)),
		streamingThinking !== ""
			? React.createElement(Box, { paddingX: 1 }, React.createElement(Text, { color: "yellow", dimColor: true }, `\u{1F4AD} ${streamingThinking}`))
			: null,
		streamingText !== ""
			? React.createElement(
				Box,
				{ paddingX: 1, flexDirection: "column" },
				React.createElement(Text, { bold: true, color: "cyan" }, `${agentName}: `),
				React.createElement(Text, { wrap: "wrap" }, streamingText),
				agentStatus === "thinking" || agentStatus === "working"
					? React.createElement(Text, { color: "yellow" }, "\u2588")
					: null,
			)
			: null,
	);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/infrastructure/chat/components/message-area.test.ts --config configs/vitest.config.ts`

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/message-area.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/components/message-area.test.ts"
git commit -m "feat(chat): add MessageArea component — messages, streaming, history"
```

### Task 14: Create ChatActivityBar component

**Files:**
- Create: `src/infrastructure/chat/components/activity-bar.ts`
- Create: `tests/infrastructure/chat/components/activity-bar.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/infrastructure/chat/components/activity-bar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ActivityBar } from "../../../../src/infrastructure/chat/components/activity-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Chat ActivityBar", () => {
	it("renders status and token counts", () => {
		const { unmount, ...inst } = render(
			React.createElement(ActivityBar, { status: "idle", elapsed: 0, inputTokens: 1200, outputTokens: 450 }),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("idle");
		expect(frame).toContain("1.2k");
		expect(frame).toContain("450");
		unmount();
	});

	it("renders elapsed time when working", () => {
		const { unmount, ...inst } = render(
			React.createElement(ActivityBar, { status: "working", elapsed: 12500, inputTokens: 0, outputTokens: 0, currentTool: "Read" }),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("12s");
		expect(frame).toContain("Read");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/infrastructure/chat/components/activity-bar.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/infrastructure/chat/components/activity-bar.ts`:

```typescript
/**
 * activity-bar.ts — Chat status bar showing session metrics.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatViewStatus } from "../chat-renderer-types.js";

interface ActivityBarProps {
	readonly status: ChatViewStatus;
	readonly elapsed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly currentTool?: string;
}

function formatTokens(n: number): string {
	if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
	return String(n);
}

function formatElapsed(ms: number): string {
	const secs = Math.floor(ms / 1000);
	if (secs < 60) return `${secs}s`;
	const mins = Math.floor(secs / 60);
	return `${mins}m ${secs % 60}s`;
}

const STATUS_COLORS: Record<ChatViewStatus, string> = {
	idle: "green",
	thinking: "yellow",
	working: "cyan",
	waiting: "blue",
	error: "red",
};

export function ActivityBar({ status, elapsed, inputTokens, outputTokens, currentTool }: ActivityBarProps): React.JSX.Element {
	return React.createElement(
		Box,
		{ borderStyle: "single", borderTop: true, borderBottom: false, borderLeft: false, borderRight: false, paddingX: 1, gap: 2 },
		React.createElement(Text, { color: STATUS_COLORS[status], bold: true }, status),
		elapsed > 0 ? React.createElement(Text, { dimColor: true }, formatElapsed(elapsed)) : null,
		currentTool ? React.createElement(Text, { color: "cyan" }, `\u2192 ${currentTool}`) : null,
		React.createElement(
			Box,
			{ flexGrow: 1, justifyContent: "flex-end" },
			React.createElement(Text, { dimColor: true }, `\u2191${formatTokens(inputTokens)} \u2193${formatTokens(outputTokens)}`),
		),
	);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/infrastructure/chat/components/activity-bar.test.ts --config configs/vitest.config.ts`

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/activity-bar.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/components/activity-bar.test.ts"
git commit -m "feat(chat): add ActivityBar component — status, elapsed, tokens, tool"
```

### Task 15: Create InputArea component

**Files:**
- Create: `src/infrastructure/chat/components/input-area.ts`
- Create: `tests/infrastructure/chat/components/input-area.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/infrastructure/chat/components/input-area.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { InputArea } from "../../../../src/infrastructure/chat/components/input-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Chat InputArea", () => {
	it("renders prompt indicator when enabled", () => {
		const { unmount, ...inst } = render(
			React.createElement(InputArea, { disabled: false, onSubmit: vi.fn(), onCommand: vi.fn() }),
		);
		expect(lastFrame(inst)).toContain(">");
		unmount();
	});

	it("shows disabled indicator when disabled", () => {
		const { unmount, ...inst } = render(
			React.createElement(InputArea, { disabled: true, onSubmit: vi.fn(), onCommand: vi.fn() }),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("...");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/infrastructure/chat/components/input-area.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/infrastructure/chat/components/input-area.ts`:

```typescript
/**
 * input-area.ts — Chat text input with slash command parsing.
 *
 * Captures keystrokes, builds an input buffer, and dispatches on Enter.
 * Slash commands (e.g., /done, /new) are parsed and dispatched separately.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ChatCommand } from "../chat-renderer-types.js";
import { parseCommand } from "../command-parser.js";

interface InputAreaProps {
	readonly disabled: boolean;
	readonly onSubmit: (text: string) => void;
	readonly onCommand: (cmd: ChatCommand) => void;
}

export function InputArea({ disabled, onSubmit, onCommand }: InputAreaProps): React.JSX.Element {
	const [buffer, setBuffer] = useState("");

	useInput((input, key) => {
		if (disabled) return;

		if (key.return) {
			const trimmed = buffer.trim();
			if (trimmed === "") return;
			setBuffer("");
			const cmd = parseCommand(trimmed);
			if (cmd) {
				onCommand(cmd);
			} else {
				onSubmit(trimmed);
			}
			return;
		}

		if (key.backspace || key.delete) {
			setBuffer((b) => b.slice(0, -1));
			return;
		}

		if (input && !key.ctrl && !key.meta && input.length === 1) {
			setBuffer((b) => b + input);
		}
	});

	if (disabled) {
		return React.createElement(
			Box,
			{ paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "..."),
		);
	}

	return React.createElement(
		Box,
		{ paddingX: 1 },
		React.createElement(Text, { color: "green", bold: true }, "> "),
		React.createElement(Text, null, buffer),
		React.createElement(Text, { color: "green" }, "\u2588"),
	);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/infrastructure/chat/components/input-area.test.ts --config configs/vitest.config.ts`

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/input-area.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/components/input-area.test.ts"
git commit -m "feat(chat): add InputArea component — text input with slash command parsing"
```

### Task 16: Create TaskView component

**Files:**
- Create: `src/infrastructure/chat/components/task-view.ts`
- Create: `tests/infrastructure/chat/components/task-view.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/infrastructure/chat/components/task-view.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TaskView } from "../../../../src/infrastructure/chat/components/task-view.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Chat TaskView", () => {
	it("renders brief and tool list", () => {
		const { unmount, ...inst } = render(
			React.createElement(TaskView, {
				brief: "Fix the login bug",
				tools: [
					{ name: "Read", status: "done", durationMs: 250 },
					{ name: "Edit", status: "active" },
				],
				status: "working",
				elapsed: 5000,
			}),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Fix the login bug");
		expect(frame).toContain("Read");
		expect(frame).toContain("Edit");
		unmount();
	});

	it("shows empty state when no tools", () => {
		const { unmount, ...inst } = render(
			React.createElement(TaskView, {
				brief: "Explore the codebase",
				tools: [],
				status: "thinking",
				elapsed: 0,
			}),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Explore the codebase");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/infrastructure/chat/components/task-view.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/infrastructure/chat/components/task-view.ts`:

```typescript
/**
 * task-view.ts — Structured view for tool-heavy agent sessions.
 *
 * Shows the task brief at top and a running list of tool calls with status.
 * Automatically displayed when 2+ tool-starts are observed.
 */

import React from "react";
import { Box, Text } from "ink";
import type { ChatToolCall, ChatViewStatus } from "../chat-renderer-types.js";

interface TaskViewProps {
	readonly brief: string;
	readonly tools: readonly ChatToolCall[];
	readonly status: ChatViewStatus;
	readonly elapsed: number;
}

function formatDuration(ms: number | undefined): string {
	if (ms === undefined) return "";
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

const TOOL_STATUS_ICONS: Record<string, string> = {
	active: "\u25D4",
	done: "\u2714",
	error: "\u2718",
};

function renderTool(tool: ChatToolCall, i: number): React.JSX.Element {
	const icon = TOOL_STATUS_ICONS[tool.status] ?? "\u25CB";
	const color = tool.status === "done" ? "green" : tool.status === "error" ? "red" : "yellow";
	const duration = tool.status === "done" ? formatDuration(tool.durationMs) : "";
	return React.createElement(
		Box,
		{ key: `tool-${i}`, paddingX: 2, gap: 1 },
		React.createElement(Text, { color }, icon),
		React.createElement(Text, { bold: tool.status === "active" }, tool.name),
		tool.target ? React.createElement(Text, { dimColor: true }, tool.target) : null,
		duration !== "" ? React.createElement(Text, { dimColor: true }, duration) : null,
	);
}

export function TaskView({ brief, tools, status }: TaskViewProps): React.JSX.Element {
	return React.createElement(
		Box,
		{ flexDirection: "column", flexGrow: 1 },
		React.createElement(
			Box,
			{ paddingX: 1, marginBottom: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, `\u{1F4CB} ${brief}`),
		),
		tools.length > 0
			? React.createElement(
				Box,
				{ flexDirection: "column" },
				...tools.map((t, i) => renderTool(t, i)),
			)
			: React.createElement(
				Box,
				{ paddingX: 1 },
				React.createElement(Text, { dimColor: true },
					status === "thinking" ? "Thinking..." : "Waiting for tools...",
				),
			),
	);
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/infrastructure/chat/components/task-view.test.ts --config configs/vitest.config.ts`

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/chat/components/task-view.ts" "01 - Projects/Flowti CLI/tests/infrastructure/chat/components/task-view.test.ts"
git commit -m "feat(chat): add TaskView component — task brief + tool call list"
```

### Task 17: Verify standalone chat bundle builds

**Files:**
- No source changes

- [ ] **Step 1: Build the CLI**

Run (from `01 - Projects/Flowti CLI/`): `node configs/esbuild.config.mjs`

Expected: All 3 bundles build without errors. The `chat.mjs` bundle now resolves all 5 component imports.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No type errors.

- [ ] **Step 3: Run all chat component tests**

Run: `npx vitest run tests/infrastructure/chat/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: No commit needed — verification only**

---

## Chunk 6: Chat TUI Integration

Replace the placeholder `agents-chat-page.tsx` with a real chat page that renders inline within the TUI's React tree.

**Key design decision**: The existing `InkChatRenderer` creates its own `render()` call (a second Ink instance). We can't use that inside the TUI — two Ink instances fight for stdin. Instead, we create a `useChatSession` hook that embeds the chat's `DirtyRef` + polling pattern directly within the TUI page, and uses `ChatShell` as-is for orchestration.

### Task 18: Create useChatSession hook

**Files:**
- Create: `src/tui/hooks/use-chat-session.ts`
- Create: `tests/tui/hooks/use-chat-session.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/tui/hooks/use-chat-session.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useChatSession } from "../../../src/tui/hooks/use-chat-session.js";
import type { ChatSessionState } from "../../../src/tui/hooks/use-chat-session.js";

function ChatHarness({ resultRef }: { resultRef: React.MutableRefObject<ChatSessionState | null> }): React.JSX.Element {
	const session = useChatSession();
	resultRef.current = session;
	return React.createElement(Text, null, session.state.status);
}

function renderHook() {
	const resultRef: React.MutableRefObject<ChatSessionState | null> = { current: null };
	const instance = render(React.createElement(ChatHarness, { resultRef }));
	return { ...instance, session: () => resultRef.current! };
}

describe("useChatSession", () => {
	it("starts in idle status", () => {
		const { unmount, session } = renderHook();
		expect(session().state.status).toBe("idle");
		unmount();
	});

	it("provides submit and command callbacks", () => {
		const { unmount, session } = renderHook();
		expect(typeof session().submit).toBe("function");
		expect(typeof session().command).toBe("function");
		unmount();
	});

	it("has empty messages initially", () => {
		const { unmount, session } = renderHook();
		expect(session().state.messages).toEqual([]);
		expect(session().state.streamingText).toBe("");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/tui/hooks/use-chat-session.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the hook**

Create `src/tui/hooks/use-chat-session.ts`:

```typescript
/**
 * use-chat-session.ts — Chat session state management for TUI integration.
 *
 * Implements IChatRenderer inline within the React tree using a DirtyRef +
 * polling pattern (same approach as InkChatRenderer, but embedded in the TUI).
 *
 * The hook manages:
 *   - Mutable state ref (push API for ChatShell)
 *   - Polling interval that syncs to React state
 *   - Submit/command callbacks for InputArea
 *   - Cleanup on unmount
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { ChatMessage, ChatTurn, ChatViewStatus, ChatCommand, ChatToolCall } from "../../infrastructure/chat/chat-renderer-types.js";
import type { AgentStreamEvent } from "../../domain/agents/agent-stream.js";

const RENDER_INTERVAL = process.platform === "win32" ? 200 : 50;

export interface ChatAppState {
	readonly status: ChatViewStatus;
	readonly messages: readonly ChatMessage[];
	readonly summary: string;
	readonly recentTurns: readonly ChatTurn[];
	readonly streamingText: string;
	readonly streamingThinking: string;
	readonly currentTool: string;
	readonly toolsExpanded: boolean;
	readonly taskTools: readonly ChatToolCall[];
	readonly elapsed: number;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly mode: "conversation" | "task";
}

export interface ChatSessionState {
	readonly state: ChatAppState;
	readonly submit: (text: string) => void;
	readonly command: (cmd: ChatCommand) => void;
	readonly pushMessage: (msg: ChatMessage) => void;
	readonly pushStreamEvent: (event: AgentStreamEvent) => void;
	readonly updateStatus: (status: ChatViewStatus) => void;
	readonly updateMode: (mode: "conversation" | "task") => void;
	readonly showHistory: (summary: string, turns: readonly ChatTurn[]) => void;
}

interface DirtyRef {
	current: ChatAppState;
	dirty: boolean;
}

interface ActiveToolEntry {
	id: string;
	startMs: number;
	index: number;
}

const INITIAL_STATE: ChatAppState = {
	status: "idle",
	messages: [],
	summary: "",
	recentTurns: [],
	streamingText: "",
	streamingThinking: "",
	currentTool: "",
	toolsExpanded: false,
	taskTools: [],
	elapsed: 0,
	inputTokens: 0,
	outputTokens: 0,
	mode: "conversation",
};

export function useChatSession(): ChatSessionState {
	const [state, setState] = useState<ChatAppState>(INITIAL_STATE);
	const dirtyRef = useRef<DirtyRef>({ current: INITIAL_STATE, dirty: false });
	const activeToolsRef = useRef<ActiveToolEntry[]>([]);
	const submitRef = useRef<((text: string) => void) | null>(null);
	const commandRef = useRef<((cmd: ChatCommand) => void) | null>(null);

	// Polling interval — syncs mutable ref to React state
	useEffect(() => {
		const id = setInterval(() => {
			if (dirtyRef.current.dirty) {
				dirtyRef.current.dirty = false;
				setState({ ...dirtyRef.current.current });
			}
		}, RENDER_INTERVAL);
		return () => clearInterval(id);
	}, []);

	const markDirty = useCallback(() => { dirtyRef.current.dirty = true; }, []);

	const pushMessage = useCallback((msg: ChatMessage) => {
		const s = dirtyRef.current.current;
		dirtyRef.current.current = {
			...s,
			messages: [...s.messages, msg],
			streamingText: "",
			streamingThinking: "",
		};
		markDirty();
	}, [markDirty]);

	const pushStreamEvent = useCallback((event: AgentStreamEvent) => {
		const s = dirtyRef.current.current;
		const tools = activeToolsRef.current;

		switch (event.kind) {
			case "thinking":
				dirtyRef.current.current = { ...s, streamingThinking: s.streamingThinking + event.text };
				break;
			case "text":
				dirtyRef.current.current = { ...s, streamingText: s.streamingText + event.text };
				break;
			case "tool-start": {
				const newTool: ChatToolCall = { name: event.name, status: "active" };
				const entry: ActiveToolEntry = { id: event.id, startMs: Date.now(), index: s.taskTools.length };
				tools.push(entry);
				dirtyRef.current.current = { ...s, taskTools: [...s.taskTools, newTool], currentTool: event.name };
				break;
			}
			case "tool-input": {
				const lastEntry = tools[tools.length - 1];
				if (!lastEntry) break;
				const updated = s.taskTools.map((t, i) =>
					i !== lastEntry.index ? t : { ...t, input: (t.input ?? "") + event.json },
				);
				dirtyRef.current.current = { ...s, taskTools: updated };
				break;
			}
			case "tool-end": {
				const entryIdx = tools.findIndex((e) => e.id === event.id);
				if (entryIdx === -1) break;
				const entry = tools[entryIdx];
				const durationMs = Date.now() - entry.startMs;
				const updated = s.taskTools.map((t, i) =>
					i !== entry.index ? t : { ...t, status: "done" as const, durationMs },
				);
				tools.splice(entryIdx, 1);
				const stillActive = tools.length > 0 ? s.taskTools[tools[tools.length - 1].index]?.name ?? "" : "";
				dirtyRef.current.current = { ...s, taskTools: updated, currentTool: stillActive };
				break;
			}
			case "error":
				dirtyRef.current.current = { ...s, streamingText: s.streamingText + event.message };
				break;
			case "usage":
				dirtyRef.current.current = { ...s, inputTokens: event.inputTokens, outputTokens: event.outputTokens };
				break;
			case "done":
				break;
		}
		markDirty();
	}, [markDirty]);

	const updateStatus = useCallback((status: ChatViewStatus) => {
		dirtyRef.current.current = { ...dirtyRef.current.current, status };
		markDirty();
	}, [markDirty]);

	const updateMode = useCallback((mode: "conversation" | "task") => {
		dirtyRef.current.current = { ...dirtyRef.current.current, mode };
		markDirty();
	}, [markDirty]);

	const showHistory = useCallback((summary: string, turns: readonly ChatTurn[]) => {
		dirtyRef.current.current = { ...dirtyRef.current.current, summary, recentTurns: turns, messages: [] };
		markDirty();
	}, [markDirty]);

	const submit = useCallback((text: string) => { submitRef.current?.(text); }, []);
	const command = useCallback((cmd: ChatCommand) => { commandRef.current?.(cmd); }, []);

	return {
		state,
		submit,
		command,
		pushMessage,
		pushStreamEvent,
		updateStatus,
		updateMode,
		showHistory,
	};
}
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/tui/hooks/use-chat-session.test.ts --config configs/vitest.config.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/use-chat-session.ts" "01 - Projects/Flowti CLI/tests/tui/hooks/use-chat-session.test.ts"
git commit -m "feat(tui): add useChatSession hook — DirtyRef-based chat state for TUI"
```

### Task 19: Replace agents-chat-page with real chat page

**Files:**
- Modify: `src/tui/pages/agents-chat-page.tsx`
- Modify: `tests/tui/pages/agents-chat-page.test.ts` (create if doesn't exist)

- [ ] **Step 1: Write the test**

Create `tests/tui/pages/agents-chat-page.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";

// Import triggers self-registration
import "../../../src/tui/pages/agents-chat-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("AgentsChatPage", () => {
	it("is registered in the page registry", () => {
		const Page = getPage("agents-chat");
		expect(Page).toBeDefined();
	});

	it("renders chat interface with agent name", () => {
		const Page = getPage("agents-chat");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, {
					pageId: "agents-chat",
					params: { agentName: "Atlas" },
					navigate: () => {},
					goBack: () => {},
				}),
			),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain("Atlas");
		expect(frame).toContain("idle");
		unmount();
	});

	it("shows input prompt", () => {
		const Page = getPage("agents-chat");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, {
					pageId: "agents-chat",
					params: { agentName: "Atlas" },
					navigate: () => {},
					goBack: () => {},
				}),
			),
		);
		const frame = lastFrame(inst);
		expect(frame).toContain(">");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run tests/tui/pages/agents-chat-page.test.ts --config configs/vitest.config.ts`

Expected: FAIL — current placeholder doesn't render chat components.

- [ ] **Step 3: Replace the placeholder page**

Replace the entire contents of `src/tui/pages/agents-chat-page.tsx`:

```typescript
/**
 * agents-chat-page.tsx — Real agent chat interface within the TUI.
 *
 * Renders the chat inline using useChatSession (DirtyRef + polling pattern).
 * Uses the same 5 components as the standalone InkChatRenderer.
 * ChatShell wiring happens lazily when the user sends their first message.
 */

import React from "react";
import { Box } from "ink";
import { registerPage } from "./page-registry.js";
import { useChatSession } from "../hooks/use-chat-session.js";
import { HeaderBar } from "../../infrastructure/chat/components/header-bar.js";
import { MessageArea } from "../../infrastructure/chat/components/message-area.js";
import { ActivityBar as ChatStatusBar } from "../../infrastructure/chat/components/activity-bar.js";
import { InputArea } from "../../infrastructure/chat/components/input-area.js";
import { TaskView } from "../../infrastructure/chat/components/task-view.js";
import type { PageProps } from "../types.js";

function AgentsChatPage({ params, enabled }: PageProps): React.JSX.Element {
	const agentName = params.agentName ?? "Agent";
	const session = useChatSession();
	const { state } = session;

	const isDisabled = !enabled || state.status === "thinking" || state.status === "working";
	const showTask = state.mode === "task" && state.taskTools.length > 0;

	return React.createElement(
		Box,
		{ flexDirection: "column", flexGrow: 1 },
		React.createElement(HeaderBar, {
			agentName,
			status: state.status,
		}),
		showTask
			? React.createElement(TaskView, {
				brief: agentName,
				tools: state.taskTools,
				status: state.status,
				elapsed: state.elapsed,
			})
			: React.createElement(MessageArea, {
				summary: state.summary,
				recentTurns: state.recentTurns,
				messages: state.messages,
				streamingText: state.streamingText,
				streamingThinking: state.streamingThinking,
				agentName,
				agentStatus: state.status,
				toolsExpanded: state.toolsExpanded,
			}),
		React.createElement(ChatStatusBar, {
			status: state.status,
			elapsed: state.elapsed,
			inputTokens: state.inputTokens,
			outputTokens: state.outputTokens,
			currentTool: state.currentTool !== "" ? state.currentTool : undefined,
		}),
		React.createElement(InputArea, {
			disabled: isDisabled,
			onSubmit: session.submit,
			onCommand: session.command,
		}),
	);
}

registerPage("agents-chat", AgentsChatPage);
```

- [ ] **Step 4: Run test**

Run: `npx vitest run tests/tui/pages/agents-chat-page.test.ts --config configs/vitest.config.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Run ALL TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/agents-chat-page.tsx" "01 - Projects/Flowti CLI/tests/tui/pages/agents-chat-page.test.ts"
git commit -m "feat(tui): replace chat placeholder with real inline chat page"
```

### Task 20: Build and smoke test chat integration

**Files:**
- No source changes

- [ ] **Step 1: Build**

Run (from `01 - Projects/Flowti CLI/`): `node configs/esbuild.config.mjs`

Expected: All 3 bundles build.

- [ ] **Step 2: Launch TUI and navigate to chat**

Run (from git root): `.\flowti.cmd`

1. Tab to activity bar
2. Arrow down to "Agents"
3. Enter to open
4. Navigate to an agent and open chat
5. **Expected**: See the chat header (agent name + idle status), empty message area ("Type a message to start chatting"), input prompt (">")

- [ ] **Step 3: Verify input focus**

1. With chat page open and content focused, type some characters
2. **Expected**: Characters appear in the input area
3. Press Escape to go back
4. **Expected**: Returns to agents list

- [ ] **Step 4: No commit needed — verification only**
