# Ink TUI Phase 0: Shell Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Boot the Flowti CLI as a persistent Ink application with an activity bar, header, status bar, and page switcher. All pages show placeholders except chat (which already works). The legacy ANSI router remains available via `--legacy` flag during migration.

**Architecture:** A single `<App>` Ink component tree renders the shell layout. Navigation state is managed by a `useNavigation` hook driving a section/page stack. The activity bar maps sitemap pages to 8 sections. Pages are registered in a `page-registry.ts` map and switched by the content area. The existing chat components are wrapped as a page within the new shell.

**Tech Stack:** React 19, Ink 6, TypeScript (strict, react-jsx), Vitest + ink-testing-library

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-ink-tui-migration-design.md`

**All paths relative to:** `01 - Projects/Flowti CLI/`

**Test command:** `npx vitest run <path> --config configs/vitest.config.ts`

**Full suite:** `npm test`

**Convention:** CLI uses ESM with `.js` extensions in imports. Tabs for indentation. TSX for components, `.ts` for hooks/logic.

---

## File Structure

### New Files (12)

| File | Responsibility |
|------|---------------|
| `src/tui/app.tsx` | Root Ink component — layout shell (activity bar + header + content + status) |
| `src/tui/shell/activity-bar.tsx` | Left icon column — section switching via arrow keys |
| `src/tui/shell/header-bar.tsx` | Top bar — breadcrumb path + project name |
| `src/tui/shell/status-bar.tsx` | Bottom bar — key hints + agent status |
| `src/tui/shell/content-area.tsx` | Page switcher — renders active page component |
| `src/tui/navigation/use-navigation.ts` | React hook — navigation state machine (section, page stack, params) |
| `src/tui/navigation/use-keyboard.ts` | React hook — global keyboard handler (Tab focus cycling, Esc back, ? help) |
| `src/tui/navigation/section-map.ts` | Pure function — maps sitemap pages to activity bar sections |
| `src/tui/pages/placeholder-page.tsx` | Generic "Coming soon" placeholder for unmigrated pages |
| `src/tui/pages/page-registry.ts` | Map of pageId → React component (static registry) |
| `src/tui/tui-entry.ts` | Entry point — creates Ink instance, injects deps, mounts `<App>` |
| `src/tui/types.ts` | Shared TUI types (Section, PageDef, NavigationState, FocusZone) |

### Test Files (7)

| File | What It Tests |
|------|--------------|
| `tests/tui/shell/activity-bar.test.ts` | Section rendering, arrow-key navigation, selection callback |
| `tests/tui/shell/header-bar.test.ts` | Breadcrumb rendering, project name display |
| `tests/tui/shell/status-bar.test.ts` | Key hints display, agent status |
| `tests/tui/shell/content-area.test.ts` | Page switching based on active page ID |
| `tests/tui/navigation/use-navigation.test.ts` | Navigate, back, section switch, param passing |
| `tests/tui/navigation/section-map.test.ts` | Sitemap → section grouping logic |
| `tests/tui/app.test.ts` | Full shell renders, activity bar visible, navigation works |

### Modified Files (2)

| File | Change |
|------|--------|
| `src/main.ts` | Add `--tui` flag to launch Ink app instead of SitemapRouter |
| `configs/esbuild.config.mjs` | Ensure `.tsx` entry points are handled (already works) |

---

## Chunk 1: Types + Section Map

### Task 1: Define TUI types

**Files:**
- Create: `src/tui/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
/**
 * types.ts — Shared types for the Ink TUI shell.
 */

export interface Section {
	readonly id: string;
	readonly label: string;
	readonly icon: string;
	readonly pages: readonly string[];
}

export interface NavigationState {
	readonly section: string;
	readonly pageStack: readonly string[];
	readonly params: Readonly<Record<string, string>>;
}

export type FocusZone = "activity-bar" | "content" | "actions";

export interface PageProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/types.ts" && git commit -m "feat(tui): add shared TUI types"
```

### Task 2: Build section-map (TDD)

**Files:**
- Create: `tests/tui/navigation/section-map.test.ts`
- Create: `src/tui/navigation/section-map.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/navigation/section-map.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildSections, findSectionForPage } from "../../../src/tui/navigation/section-map.js";

describe("buildSections", () => {
	it("returns 8 sections", () => {
		const sections = buildSections();
		expect(sections).toHaveLength(8);
	});

	it("home section contains start page", () => {
		const sections = buildSections();
		const home = sections.find((s) => s.id === "home");
		expect(home).toBeDefined();
		expect(home!.pages).toContain("start");
	});

	it("agents section contains agents and agents-chat", () => {
		const sections = buildSections();
		const agents = sections.find((s) => s.id === "agents");
		expect(agents!.pages).toContain("agents");
		expect(agents!.pages).toContain("agents-chat");
	});

	it("every section has at least one page", () => {
		const sections = buildSections();
		for (const section of sections) {
			expect(section.pages.length).toBeGreaterThan(0);
		}
	});
});

describe("findSectionForPage", () => {
	it("returns home for start page", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "start")).toBe("home");
	});

	it("returns agents for agents-chat", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "agents-chat")).toBe("agents");
	});

	it("returns null for unknown page", () => {
		const sections = buildSections();
		expect(findSectionForPage(sections, "nonexistent")).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/navigation/section-map.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement section-map**

Create `src/tui/navigation/section-map.ts`:

```typescript
/**
 * section-map.ts — Maps sitemap pages to activity bar sections.
 *
 * The section list is static — derived from the spec's activity bar design.
 * Pages are grouped by domain affinity, not by sitemap.json structure.
 */

import type { Section } from "../types.js";

export function buildSections(): Section[] {
	return [
		{ id: "home", label: "Home", icon: "🏠", pages: ["start"] },
		{ id: "agents", label: "Agents", icon: "👤", pages: ["ai-tools", "agents", "agent-detail", "agents-chat", "agents-run", "roster-task"] },
		{ id: "project", label: "Project", icon: "📋", pages: ["project-detail", "build", "test", "health", "scaffold", "make", "review", "devtools"] },
		{ id: "reports", label: "Reports", icon: "📊", pages: ["reports", "report-archive"] },
		{ id: "events", label: "Events", icon: "⚡", pages: ["event-catalog", "event-config"] },
		{ id: "management", label: "Manage", icon: "🔧", pages: ["iterations", "iteration-detail", "lifecycle", "resources", "timelog", "deliverables", "raid", "requirements", "capa"] },
		{ id: "publish", label: "Publish", icon: "📦", pages: ["publish", "plugins"] },
		{ id: "help", label: "Help", icon: "❓", pages: ["help", "onboarding", "knowledgebase", "capture"] },
	];
}

export function findSectionForPage(sections: readonly Section[], pageId: string): string | null {
	for (const section of sections) {
		if (section.pages.includes(pageId)) return section.id;
	}
	return null;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/navigation/section-map.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/navigation/section-map.ts" "01 - Projects/Flowti CLI/tests/tui/navigation/section-map.test.ts" && git commit -m "feat(tui): add section-map — sitemap pages to activity bar sections"
```

---

## Chunk 2: Navigation Hook

### Task 3: Build useNavigation hook (TDD)

**Files:**
- Create: `tests/tui/navigation/use-navigation.test.ts`
- Create: `src/tui/navigation/use-navigation.ts`

The hook manages navigation state: which section is active, the page stack for breadcrumbs, and page params.

- [ ] **Step 1: Write failing tests**

Create `tests/tui/navigation/use-navigation.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { renderHook, act } from "ink-testing-library";
import React from "react";
import { useNavigation } from "../../../src/tui/navigation/use-navigation.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";
```

Note: `ink-testing-library` does NOT export `renderHook`. For hooks, test them through a wrapper component instead. Create a test harness:

```typescript
import { describe, it, expect } from "vitest";
import React, { useRef, useEffect } from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useNavigation } from "../../../src/tui/navigation/use-navigation.js";
import { buildSections } from "../../../src/tui/navigation/section-map.js";
import type { NavigationState } from "../../../src/tui/types.js";

// Test harness: renders navigation state as text, exposes actions via ref
interface HarnessResult {
	state: NavigationState;
	navigate: (pageId: string, params?: Record<string, string>) => void;
	goBack: () => void;
	setSection: (sectionId: string) => void;
}

function NavigationHarness({ resultRef }: { resultRef: React.MutableRefObject<HarnessResult | null> }): React.JSX.Element {
	const sections = buildSections();
	const nav = useNavigation(sections);
	useEffect(() => { resultRef.current = nav; });
	return React.createElement(Text, null, JSON.stringify(nav.state));
}

function renderNav() {
	const resultRef: React.MutableRefObject<HarnessResult | null> = { current: null };
	const instance = render(React.createElement(NavigationHarness, { resultRef }));
	return { ...instance, nav: () => resultRef.current! };
}

describe("useNavigation", () => {
	it("starts at home section with start page", () => {
		const { unmount, nav } = renderNav();
		expect(nav().state.section).toBe("home");
		expect(nav().state.pageStack).toEqual(["start"]);
		unmount();
	});

	it("navigate pushes page onto stack", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().navigate("agents"); });
		expect(nav().state.pageStack).toEqual(["start", "agents"]);
		expect(nav().state.section).toBe("agents");
		unmount();
	});

	it("goBack pops the stack", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().navigate("agents"); });
		act(() => { nav().goBack(); });
		expect(nav().state.pageStack).toEqual(["start"]);
		expect(nav().state.section).toBe("home");
		unmount();
	});

	it("goBack at root does nothing", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().goBack(); });
		expect(nav().state.pageStack).toEqual(["start"]);
		unmount();
	});

	it("setSection resets stack to section root page", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().navigate("agents"); });
		act(() => { nav().navigate("agent-detail", { name: "bob" }); });
		act(() => { nav().setSection("reports"); });
		expect(nav().state.section).toBe("reports");
		expect(nav().state.pageStack).toEqual(["reports"]);
		unmount();
	});

	it("navigate passes params", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().navigate("agent-detail", { name: "bob" }); });
		expect(nav().state.params).toEqual({ name: "bob" });
		unmount();
	});

	it("navigate auto-switches section when target is in different section", () => {
		const { unmount, nav } = renderNav();
		act(() => { nav().navigate("iterations"); });
		expect(nav().state.section).toBe("management");
		unmount();
	});
});
```

Note: `act` might not be directly available from `ink-testing-library`. If it throws, call the nav functions directly — Ink re-renders synchronously for state updates. Adjust the test approach if needed during implementation.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/navigation/use-navigation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement useNavigation**

Create `src/tui/navigation/use-navigation.ts`:

```typescript
/**
 * use-navigation.ts — Navigation state machine hook for the TUI shell.
 *
 * Manages section selection, page stack (for breadcrumbs/back), and page params.
 */

import { useState, useCallback } from "react";
import type { Section, NavigationState } from "../types.js";
import { findSectionForPage } from "./section-map.js";

interface UseNavigationResult {
	readonly state: NavigationState;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly setSection: (sectionId: string) => void;
}

export function useNavigation(sections: readonly Section[]): UseNavigationResult {
	const [state, setState] = useState<NavigationState>({
		section: "home",
		pageStack: ["start"],
		params: {},
	});

	const navigate = useCallback((pageId: string, params?: Record<string, string>) => {
		setState((prev) => {
			const targetSection = findSectionForPage(sections, pageId);
			return {
				section: targetSection ?? prev.section,
				pageStack: [...prev.pageStack, pageId],
				params: params ?? {},
			};
		});
	}, [sections]);

	const goBack = useCallback(() => {
		setState((prev) => {
			if (prev.pageStack.length <= 1) return prev;
			const newStack = prev.pageStack.slice(0, -1);
			const topPage = newStack[newStack.length - 1];
			const targetSection = findSectionForPage(sections, topPage);
			return {
				section: targetSection ?? prev.section,
				pageStack: newStack,
				params: {},
			};
		});
	}, [sections]);

	const setSection = useCallback((sectionId: string) => {
		const section = sections.find((s) => s.id === sectionId);
		if (!section) return;
		const rootPage = section.pages[0];
		setState({
			section: sectionId,
			pageStack: [rootPage],
			params: {},
		});
	}, [sections]);

	return { state, navigate, goBack, setSection };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/navigation/use-navigation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/navigation/use-navigation.ts" "01 - Projects/Flowti CLI/tests/tui/navigation/use-navigation.test.ts" && git commit -m "feat(tui): add useNavigation hook — section/page stack state machine"
```

---

## Chunk 3: Shell Components

### Task 4: ActivityBar component (TDD)

**Files:**
- Create: `tests/tui/shell/activity-bar.test.ts`
- Create: `src/tui/shell/activity-bar.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/shell/activity-bar.test.ts`:

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
			React.createElement(ActivityBar, { sections, activeSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("🏠");
		expect(frame).toContain("👤");
		expect(frame).toContain("📊");
		unmount();
	});

	it("highlights the active section", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "agents", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		// Active section should have visual distinction (bold, color, or indicator)
		expect(frame).toContain("👤");
		unmount();
	});

	it("renders section labels", () => {
		const { unmount, ...instance } = render(
			React.createElement(ActivityBar, { sections, activeSection: "home", onSelect: () => {} }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		unmount();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/shell/activity-bar.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement ActivityBar**

Create `src/tui/shell/activity-bar.tsx`:

```tsx
/**
 * activity-bar.tsx — Left icon column for section switching.
 *
 * Renders a vertical list of section icons. The active section is highlighted.
 * Arrow up/down navigation is handled by the parent via useKeyboard.
 */

import React from "react";
import { Box, Text } from "ink";
import type { Section } from "../types.js";

interface ActivityBarProps {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSelect: (sectionId: string) => void;
}

export function ActivityBar({ sections, activeSection }: ActivityBarProps): React.JSX.Element {
	return (
		<Box flexDirection="column" width={8} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
			{sections.map((section) => {
				const isActive = section.id === activeSection;
				return (
					<Box key={section.id} paddingX={1}>
						<Text bold={isActive} color={isActive ? "cyan" : undefined} dimColor={!isActive}>
							{section.icon} {isActive ? section.label.charAt(0) : ""}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/shell/activity-bar.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/activity-bar.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/activity-bar.test.ts" && git commit -m "feat(tui): add ActivityBar component — section icons with highlight"
```

### Task 5: HeaderBar component (TDD)

**Files:**
- Create: `tests/tui/shell/header-bar.test.ts`
- Create: `src/tui/shell/header-bar.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/shell/header-bar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { HeaderBar } from "../../../src/tui/shell/header-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("HeaderBar", () => {
	it("renders breadcrumb path", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home", "Agents", "Bob"], projectName: "Flowti CLI" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Home");
		expect(frame).toContain("Agents");
		expect(frame).toContain("Bob");
		unmount();
	});

	it("renders project name", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home"], projectName: "Flowti CLI" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Flowti CLI");
		unmount();
	});

	it("uses separator between breadcrumbs", () => {
		const { unmount, ...instance } = render(
			React.createElement(HeaderBar, { breadcrumbs: ["Home", "Agents"], projectName: "Test" }),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain(">");
		unmount();
	});
});
```

- [ ] **Step 2: Implement HeaderBar**

Create `src/tui/shell/header-bar.tsx`:

```tsx
/**
 * header-bar.tsx — Top bar showing breadcrumb navigation and project name.
 */

import React from "react";
import { Box, Text } from "ink";

interface HeaderBarProps {
	readonly breadcrumbs: readonly string[];
	readonly projectName?: string;
}

export function HeaderBar({ breadcrumbs, projectName }: HeaderBarProps): React.JSX.Element {
	return (
		<Box borderStyle="single" borderBottom borderTop={false} borderLeft={false} borderRight={false} paddingX={1}>
			<Box flexGrow={1} gap={0}>
				{breadcrumbs.map((crumb, i) => (
					<React.Fragment key={i}>
						{i > 0 && <Text dimColor> {">"} </Text>}
						<Text bold={i === breadcrumbs.length - 1} color={i === breadcrumbs.length - 1 ? "cyan" : undefined}>
							{crumb}
						</Text>
					</React.Fragment>
				))}
			</Box>
			{projectName !== undefined && (
				<Text dimColor>{projectName}</Text>
			)}
		</Box>
	);
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/shell/header-bar.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/header-bar.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/header-bar.test.ts" && git commit -m "feat(tui): add HeaderBar component — breadcrumb navigation"
```

### Task 6: StatusBar component (TDD)

**Files:**
- Create: `tests/tui/shell/status-bar.test.ts`
- Create: `src/tui/shell/status-bar.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/shell/status-bar.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { StatusBar } from "../../../src/tui/shell/status-bar.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("StatusBar", () => {
	it("renders key hints", () => {
		const { unmount, ...instance } = render(
			React.createElement(StatusBar, {
				hints: [
					{ key: "↑↓", label: "Navigate" },
					{ key: "Enter", label: "Select" },
					{ key: "Esc", label: "Back" },
				],
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Enter");
		expect(frame).toContain("Esc");
		unmount();
	});

	it("renders agent status when provided", () => {
		const { unmount, ...instance } = render(
			React.createElement(StatusBar, {
				hints: [],
				agentStatus: "Bob: busy",
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Bob: busy");
		unmount();
	});
});
```

- [ ] **Step 2: Implement StatusBar**

Create `src/tui/shell/status-bar.tsx`:

```tsx
/**
 * status-bar.tsx — Bottom bar showing key hints and agent status.
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyHint {
	readonly key: string;
	readonly label: string;
}

interface StatusBarProps {
	readonly hints: readonly KeyHint[];
	readonly agentStatus?: string;
}

export function StatusBar({ hints, agentStatus }: StatusBarProps): React.JSX.Element {
	return (
		<Box borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false} paddingX={1}>
			<Box flexGrow={1} gap={2}>
				{hints.map((hint) => (
					<Text key={hint.key} dimColor>
						<Text bold>{hint.key}</Text> {hint.label}
					</Text>
				))}
			</Box>
			{agentStatus !== undefined && (
				<Text color="yellow">{agentStatus}</Text>
			)}
		</Box>
	);
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/shell/status-bar.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/status-bar.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/status-bar.test.ts" && git commit -m "feat(tui): add StatusBar component — key hints and agent status"
```

---

## Chunk 4: Content Area + Page Registry + Placeholder

### Task 7: Placeholder page + page registry

**Files:**
- Create: `src/tui/pages/placeholder-page.tsx`
- Create: `src/tui/pages/page-registry.ts`
- Create: `src/tui/shell/content-area.tsx`
- Create: `tests/tui/shell/content-area.test.ts`

- [ ] **Step 1: Create placeholder page**

Create `src/tui/pages/placeholder-page.tsx`:

```tsx
/**
 * placeholder-page.tsx — Generic "Coming soon" page for unmigrated pages.
 */

import React from "react";
import { Box, Text } from "ink";
import type { PageProps } from "../types.js";

export function PlaceholderPage({ pageId }: PageProps): React.JSX.Element {
	return (
		<Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
			<Text bold color="yellow">🚧 {pageId}</Text>
			<Text dimColor>This page is being migrated to the new TUI.</Text>
			<Text dimColor>Press Esc to go back.</Text>
		</Box>
	);
}
```

- [ ] **Step 2: Create page registry**

Create `src/tui/pages/page-registry.ts`:

```typescript
/**
 * page-registry.ts — Static map of pageId → React component.
 *
 * During migration, most pages point to PlaceholderPage.
 * As pages are migrated, they replace their placeholder entry.
 */

import type { PageProps } from "../types.js";
import { PlaceholderPage } from "./placeholder-page.js";

type PageComponent = (props: PageProps) => React.JSX.Element;

const registry = new Map<string, PageComponent>();

export function registerPage(pageId: string, component: PageComponent): void {
	registry.set(pageId, component);
}

export function getPage(pageId: string): PageComponent {
	return registry.get(pageId) ?? PlaceholderPage;
}

export function getRegisteredPageIds(): string[] {
	return [...registry.keys()];
}
```

- [ ] **Step 3: Write content-area tests**

Create `tests/tui/shell/content-area.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ContentArea } from "../../../src/tui/shell/content-area.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("ContentArea", () => {
	it("renders placeholder for unknown page", () => {
		const { unmount, ...instance } = render(
			React.createElement(ContentArea, {
				pageId: "unknown-page",
				params: {},
				navigate: () => {},
				goBack: () => {},
			}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("unknown-page");
		expect(frame).toContain("migrated");
		unmount();
	});
});
```

- [ ] **Step 4: Implement ContentArea**

Create `src/tui/shell/content-area.tsx`:

```tsx
/**
 * content-area.tsx — Renders the active page component from the page registry.
 */

import React from "react";
import { Box } from "ink";
import { getPage } from "../pages/page-registry.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}

export function ContentArea({ pageId, params, navigate, goBack }: ContentAreaProps): React.JSX.Element {
	const Page = getPage(pageId);
	return (
		<Box flexGrow={1} flexDirection="column">
			{React.createElement(Page, { pageId, params, navigate, goBack })}
		</Box>
	);
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/shell/content-area.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/placeholder-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/page-registry.ts" "01 - Projects/Flowti CLI/src/tui/shell/content-area.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/content-area.test.ts" && git commit -m "feat(tui): add ContentArea, PageRegistry, and PlaceholderPage"
```

---

## Chunk 5: App Root + Entry Point + main.ts Integration

### Task 8: Build App root component (TDD)

**Files:**
- Create: `tests/tui/app.test.ts`
- Create: `src/tui/app.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/app.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { App } from "../../src/tui/app.js";

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("App", () => {
	it("renders activity bar with section icons", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("🏠");
		unmount();
	});

	it("renders header bar with breadcrumbs", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Start Menu");
		unmount();
	});

	it("renders status bar with key hints", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("Navigate");
		expect(frame).toContain("Esc");
		unmount();
	});

	it("renders content area with start page placeholder", () => {
		const { unmount, ...instance } = render(
			React.createElement(App, {}),
		);
		const frame = lastFrame(instance);
		expect(frame).toContain("start");
		unmount();
	});
});
```

- [ ] **Step 2: Implement App**

Create `src/tui/app.tsx`:

```tsx
/**
 * app.tsx — Root Ink component for the Flowti CLI TUI.
 *
 * Layout: ActivityBar (left) | Header + Content + StatusBar (right)
 * Navigation managed by useNavigation hook.
 * Pages resolved from page-registry.
 */

import React from "react";
import { Box, useInput } from "ink";
import { buildSections, findSectionForPage } from "./navigation/section-map.js";
import { useNavigation } from "./navigation/use-navigation.js";
import { ActivityBar } from "./shell/activity-bar.js";
import { HeaderBar } from "./shell/header-bar.js";
import { ContentArea } from "./shell/content-area.js";
import { StatusBar } from "./shell/status-bar.js";
import type { Section } from "./types.js";

function buildBreadcrumbs(sections: readonly Section[], pageStack: readonly string[]): string[] {
	return pageStack.map((pageId) => {
		const section = sections.find((s) => s.pages.includes(pageId));
		if (section && section.pages[0] === pageId) return section.label;
		return pageId.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
	});
}

const DEFAULT_HINTS = [
	{ key: "↑↓", label: "Navigate" },
	{ key: "Enter", label: "Select" },
	{ key: "Esc", label: "Back" },
	{ key: "Tab", label: "Focus" },
	{ key: "?", label: "Help" },
];

export function App(): React.JSX.Element {
	const sections = buildSections();
	const { state, navigate, goBack, setSection } = useNavigation(sections);

	// Global keyboard: Tab cycles focus (future), Esc goes back
	useInput((input, key) => {
		if (key.escape) {
			goBack();
		}
		// Activity bar navigation: Ctrl+1-8 for quick section switch
		if (key.ctrl && input >= "1" && input <= "8") {
			const idx = parseInt(input, 10) - 1;
			if (idx < sections.length) {
				setSection(sections[idx].id);
			}
		}
	});

	const activePage = state.pageStack[state.pageStack.length - 1];
	const breadcrumbs = buildBreadcrumbs(sections, state.pageStack);

	return (
		<Box flexDirection="row" width="100%" height="100%">
			<ActivityBar sections={sections} activeSection={state.section} onSelect={setSection} />
			<Box flexDirection="column" flexGrow={1}>
				<HeaderBar breadcrumbs={breadcrumbs} />
				<ContentArea pageId={activePage} params={state.params} navigate={navigate} goBack={goBack} />
				<StatusBar hints={DEFAULT_HINTS} />
			</Box>
		</Box>
	);
}
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/app.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/app.tsx" "01 - Projects/Flowti CLI/tests/tui/app.test.ts" && git commit -m "feat(tui): add App root component — full shell layout"
```

### Task 9: TUI entry point + main.ts integration

**Files:**
- Create: `src/tui/tui-entry.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create tui-entry.ts**

Create `src/tui/tui-entry.ts`:

```typescript
/**
 * tui-entry.ts — Boots the Ink TUI application.
 *
 * Creates an Ink render instance with the App component.
 * Returns a Promise that resolves when the user exits (Ctrl+C or quit action).
 */

import React from "react";
import { render } from "ink";
import { App } from "./app.js";

export async function runTui(): Promise<void> {
	const instance = render(React.createElement(App));
	await instance.waitUntilExit();
}
```

- [ ] **Step 2: Add --tui flag to main.ts**

In `src/main.ts`, find the interactive mode entry point (the `createRouter` call area). Add a conditional before it:

After the non-interactive command handling and before the router creation, add:

```typescript
// TUI mode — modern Ink-based terminal UI
if (proc.argv.includes("--tui")) {
	const { runTui } = await import("./tui/tui-entry.js");
	await runTui();
	proc.exit(0);
}
```

This keeps the legacy router as default during migration. Users opt into the new TUI with `flowti --tui`.

- [ ] **Step 3: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 4: Verify build**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

- [ ] **Step 5: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npm test
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/tui-entry.ts" "01 - Projects/Flowti CLI/src/main.ts" && git commit -m "feat(tui): add TUI entry point — launch with flowti --tui"
```

---

## Chunk 6: useKeyboard hook + Final Verification

### Task 10: Global keyboard hook

**Files:**
- Create: `src/tui/navigation/use-keyboard.ts`

This hook handles activity bar arrow-key navigation (up/down to switch sections when activity bar is focused).

- [ ] **Step 1: Create useKeyboard hook**

Create `src/tui/navigation/use-keyboard.ts`:

```typescript
/**
 * use-keyboard.ts — Global keyboard handler for activity bar section navigation.
 *
 * When the activity bar has focus, arrow up/down cycles through sections.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly onBack: () => void;
}

export function useKeyboard({ sections, activeSection, onSectionChange, onBack }: UseKeyboardOptions): void {
	useInput((input, key) => {
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
		if (key.escape) {
			onBack();
		}
	});
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/navigation/use-keyboard.ts" && git commit -m "feat(tui): add useKeyboard hook — arrow-key section navigation"
```

### Task 11: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npm test
```

Expected: All existing tests pass + new TUI tests pass.

- [ ] **Step 2: Count new tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/ --config configs/vitest.config.ts --reporter=verbose 2>&1 | tail -15
```

Expected: 20-30 new tests across 7 files.

- [ ] **Step 3: Verify build**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

Expected: Clean build with no errors.

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `src/tui/types.ts` — shared TUI types
- [ ] `src/tui/navigation/section-map.ts` — 8 sections mapping all sitemap pages
- [ ] `src/tui/navigation/use-navigation.ts` — navigation state machine hook
- [ ] `src/tui/navigation/use-keyboard.ts` — global keyboard handler
- [ ] `src/tui/shell/activity-bar.tsx` — left icon column
- [ ] `src/tui/shell/header-bar.tsx` — top breadcrumb bar
- [ ] `src/tui/shell/status-bar.tsx` — bottom key hints
- [ ] `src/tui/shell/content-area.tsx` — page switcher
- [ ] `src/tui/pages/placeholder-page.tsx` — "Coming soon" for unmigrated pages
- [ ] `src/tui/pages/page-registry.ts` — pageId → component map
- [ ] `src/tui/app.tsx` — root Ink component
- [ ] `src/tui/tui-entry.ts` — Ink boot + `--tui` flag
- [ ] 7 test files with 20-30 tests
- [ ] `npm test` passes (tsc + eslint + vitest)
- [ ] `node configs/esbuild.config.mjs` builds cleanly
- [ ] `flowti --tui` boots the Ink shell with activity bar navigation
