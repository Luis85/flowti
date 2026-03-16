# Ink TUI Phase 1: Core Primitives — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable component library (10 primitives, 3 page patterns, 4 hooks, loader infrastructure) that all 32 pages will compose from. Refactor Phase 0's `useKeyboard` to support focus zones.

**Architecture:** Primitives are stateless Ink components taking typed props. Page patterns (ListPage, DashboardPage, FormPage) compose primitives into full-page layouts. Hooks manage data loading (`useLoader`), mutation routing (`useActionBridge`), focus management (`useFocusZone`), and streaming processes (`useStreamingProcess`). Loaders are pure functions receiving `LoaderContext` — no singleton imports. `ContentArea` is upgraded to orchestrate loaders, handle action errors, and manage focus zones.

**Tech Stack:** React 19, Ink 6, TypeScript (strict, react-jsx), Vitest + ink-testing-library

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-ink-tui-full-migration-design.md`

**All paths relative to:** `01 - Projects/Flowti CLI/`

**Test command:** `npx vitest run <path> --config configs/vitest.config.ts`

**Full suite:** `npm test`

**Convention:** CLI uses ESM with `.js` extensions in imports. Tabs for indentation. TSX for components, `.ts` for hooks/logic. No `any` types. Domain purity — loaders receive all deps via `LoaderContext`, never import singletons.

---

## File Structure

### New Files (22)

| File | Responsibility |
|------|---------------|
| `src/tui/loaders/loader-types.ts` | `LoaderDeps`, `LoaderContext`, `LoaderFn<T>` types |
| `src/tui/hooks/use-loader.ts` | Data loading hook — calls loader, manages loading/error/data/refresh |
| `src/tui/hooks/use-action-bridge.ts` | Mutation routing — `executeAction(id, ctx)` with error propagation |
| `src/tui/hooks/action-map.ts` | Lightweight action dispatch map (replaces handler-registry long-term) |
| `src/tui/hooks/use-focus-zone.ts` | Tab cycling between activity-bar / content / actions zones |
| `src/tui/hooks/use-streaming-process.ts` | Spawn shell process, stream stdout lines into state |
| `src/tui/primitives/badge.tsx` | Colored inline label |
| `src/tui/primitives/stat-card.tsx` | Single KPI box |
| `src/tui/primitives/stat-grid.tsx` | Responsive grid of StatCards |
| `src/tui/primitives/section.tsx` | Titled content block with optional collapse |
| `src/tui/primitives/scrollable-list.tsx` | Arrow-key navigable list with virtualization |
| `src/tui/primitives/master-detail.tsx` | Split panel layout |
| `src/tui/primitives/action-bar.tsx` | Bottom contextual action buttons |
| `src/tui/primitives/search-input.tsx` | Inline filter input |
| `src/tui/primitives/form-field.tsx` | Text, select, toggle input field |
| `src/tui/primitives/key-hints.tsx` | Key legend row |
| `src/tui/pages/list-page.tsx` | Generic list+detail page pattern |
| `src/tui/pages/dashboard-page.tsx` | Generic dashboard page pattern |
| `src/tui/pages/form-page.tsx` | Generic form page pattern |
| `tests/tui/hooks/use-loader.test.ts` | useLoader hook tests |
| `tests/tui/hooks/use-focus-zone.test.ts` | useFocusZone hook tests |
| `tests/tui/primitives/primitives.test.ts` | All primitive component tests |

### Modified Files (3)

| File | Change |
|------|--------|
| `src/tui/types.ts` | Add `PageDataProps`, `ActionHandler`, loader-related types |
| `src/tui/navigation/use-keyboard.ts` | Add `enabled` guard for focus zone gating |
| `src/tui/shell/content-area.tsx` | Wire `useLoader`, error handling, `onAction` prop flow |

---

## Chunk 1: Loader Infrastructure + Types

### Task 1: Define loader types

**Files:**
- Create: `src/tui/loaders/loader-types.ts`
- Modify: `src/tui/types.ts`

- [ ] **Step 1: Create loader types file**

```typescript
/**
 * loader-types.ts — Type definitions for the TUI loader pattern.
 *
 * Loaders are pure functions that receive a LoaderContext and return typed data.
 * They follow the existing ISP pattern — no singleton imports.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types-config.js";

/** Dependencies available to loaders — ISP subset of CliDeps. */
export type LoaderDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">;

/** Full context passed to every loader function. */
export interface LoaderContext {
	readonly deps: LoaderDeps;
	readonly vaultRoot: string;
	readonly projectPath: string | undefined;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly params: Readonly<Record<string, string>>;
}

/** A loader function — pure, sync, returns typed data. */
export type LoaderFn<T> = (ctx: LoaderContext) => T;
```

- [ ] **Step 2: Add PageDataProps to types.ts**

Modify `src/tui/types.ts`:

First, add optional `onAction` to the existing `PageProps` (backward-compatible — Phase 0 pages ignore it, Phase 2+ pages use it):

```typescript
export interface PageProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly onAction?: (actionId: string, params?: Record<string, string>) => void;
}
```

Then add `PageDataProps` after it:

```typescript
/** Extended page props for data-driven pages. Data comes from loader, onAction handles mutations. */
export interface PageDataProps<T = unknown> extends PageProps {
	readonly data: T;
	readonly onAction: (actionId: string, params?: Record<string, string>) => void;
}
```

- [ ] **Step 3: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/loaders/loader-types.ts" "01 - Projects/Flowti CLI/src/tui/types.ts"
git commit -m "feat(tui): add LoaderContext types and PageDataProps"
```

### Task 2: Build useLoader hook (TDD)

**Files:**
- Create: `tests/tui/hooks/use-loader.test.ts`
- Create: `src/tui/hooks/use-loader.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/hooks/use-loader.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useLoader } from "../../../src/tui/hooks/use-loader.js";
import type { LoaderContext, LoaderFn } from "../../../src/tui/loaders/loader-types.js";

interface TestData { items: string[] }

const mockCtx: LoaderContext = {
	deps: { disk: {} as never, paths: {} as never, clock: {} as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	params: {},
};

function LoaderHarness({ loader, ctx, resultRef }: {
	loader: LoaderFn<TestData>;
	ctx: LoaderContext;
	resultRef: React.MutableRefObject<ReturnType<typeof useLoader<TestData>> | null>;
}): React.JSX.Element {
	const result = useLoader(loader, ctx);
	resultRef.current = result;
	return React.createElement(Text, null, result.data ? JSON.stringify(result.data) : result.error ?? "loading");
}

function renderLoader(loader: LoaderFn<TestData>, ctx = mockCtx) {
	const resultRef: React.MutableRefObject<ReturnType<typeof useLoader<TestData>> | null> = { current: null };
	const instance = render(React.createElement(LoaderHarness, { loader, ctx, resultRef }));
	return { ...instance, result: () => resultRef.current! };
}

describe("useLoader", () => {
	it("returns data from successful loader", () => {
		const loader: LoaderFn<TestData> = () => ({ items: ["a", "b"] });
		const { unmount, result } = renderLoader(loader);
		expect(result().data).toEqual({ items: ["a", "b"] });
		expect(result().loading).toBe(false);
		expect(result().error).toBeNull();
		unmount();
	});

	it("returns error when loader throws", () => {
		const loader: LoaderFn<TestData> = () => { throw new Error("fail"); };
		const { unmount, result } = renderLoader(loader);
		expect(result().data).toBeNull();
		expect(result().error).toBe("fail");
		expect(result().loading).toBe(false);
		unmount();
	});

	it("refresh re-calls the loader", async () => {
		let callCount = 0;
		const loader: LoaderFn<TestData> = () => { callCount++; return { items: [`call-${callCount}`] }; };
		const { unmount, result } = renderLoader(loader);
		expect(callCount).toBe(1);
		result().refresh();
		await new Promise((r) => setTimeout(r, 0));
		expect(callCount).toBe(2);
		unmount();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/hooks/use-loader.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement useLoader**

Create `src/tui/hooks/use-loader.ts`:

```typescript
/**
 * use-loader.ts — Data loading hook for TUI pages.
 *
 * Calls the loader function on mount and exposes refresh().
 * Loaders are synchronous (domain functions are sync) — no async needed.
 */

import { useState, useCallback, useMemo } from "react";
import type { LoaderContext, LoaderFn } from "../loaders/loader-types.js";

interface UseLoaderResult<T> {
	readonly data: T | null;
	readonly loading: boolean;
	readonly error: string | null;
	readonly refresh: () => void;
}

export function useLoader<T>(loader: LoaderFn<T>, ctx: LoaderContext): UseLoaderResult<T> {
	const [revision, setRevision] = useState(0);

	const { data, error } = useMemo(() => {
		try {
			return { data: loader(ctx), error: null };
		} catch (err) {
			return { data: null, error: err instanceof Error ? err.message : String(err) };
		}
	}, [loader, ctx, revision]);

	const refresh = useCallback(() => {
		setRevision((r) => r + 1);
	}, []);

	return { data, loading: false, error, refresh };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/hooks/use-loader.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/use-loader.ts" "01 - Projects/Flowti CLI/tests/tui/hooks/use-loader.test.ts"
git commit -m "feat(tui): add useLoader hook — sync data loading with refresh"
```

### Task 3: Build action bridge

**Files:**
- Create: `src/tui/hooks/action-map.ts`
- Create: `src/tui/hooks/use-action-bridge.ts`

- [ ] **Step 1: Create action-map**

Create `src/tui/hooks/action-map.ts`:

```typescript
/**
 * action-map.ts — Lightweight action dispatch map.
 *
 * Replaces handler-registry for TUI pages. Actions are registered as
 * simple async functions keyed by action ID. Pages call executeAction()
 * through useActionBridge, which routes here.
 */

export interface ActionContext {
	readonly actionId: string;
	readonly params: Readonly<Record<string, string>>;
}

type ActionFn = (ctx: ActionContext) => Promise<void> | void;

const actions = new Map<string, ActionFn>();

export function registerTuiAction(id: string, fn: ActionFn): void {
	actions.set(id, fn);
}

export async function executeAction(id: string, ctx: ActionContext): Promise<void> {
	const fn = actions.get(id);
	if (!fn) throw new Error(`Unknown action: ${id}`);
	await fn(ctx);
}

export function hasAction(id: string): boolean {
	return actions.has(id);
}
```

- [ ] **Step 2: Create useActionBridge hook**

Create `src/tui/hooks/use-action-bridge.ts`:

```typescript
/**
 * use-action-bridge.ts — Hook that provides executeAction to page components.
 *
 * Wraps action-map dispatch with error handling.
 * ContentArea uses this to build the onAction callback passed to pages.
 */

import { useCallback } from "react";
import { executeAction as dispatch } from "./action-map.js";

interface UseActionBridgeResult {
	readonly executeAction: (actionId: string, params?: Record<string, string>) => Promise<void>;
}

export function useActionBridge(): UseActionBridgeResult {
	const executeAction = useCallback(async (actionId: string, params?: Record<string, string>) => {
		await dispatch(actionId, { actionId, params: params ?? {} });
	}, []);

	return { executeAction };
}
```

- [ ] **Step 3: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/action-map.ts" "01 - Projects/Flowti CLI/src/tui/hooks/use-action-bridge.ts"
git commit -m "feat(tui): add action bridge — lightweight mutation dispatch"
```

### Task 4: Build useFocusZone hook (TDD)

**Files:**
- Create: `tests/tui/hooks/use-focus-zone.test.ts`
- Create: `src/tui/hooks/use-focus-zone.ts`
- Modify: `src/tui/navigation/use-keyboard.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/tui/hooks/use-focus-zone.test.ts`:

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
	const result = useFocusZone(["activity-bar", "content", "actions"]);
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
	it("starts at content zone", () => {
		const { unmount, focus } = renderFocus();
		expect(focus().active).toBe("content");
		unmount();
	});

	it("next cycles to next zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		expect(focus().active).toBe("actions");
		unmount();
	});

	it("next wraps around", async () => {
		const { unmount, focus } = renderFocus();
		focus().next();
		await flush();
		focus().next();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("prev cycles backward", async () => {
		const { unmount, focus } = renderFocus();
		focus().prev();
		await flush();
		expect(focus().active).toBe("activity-bar");
		unmount();
	});

	it("setActive jumps to a zone", async () => {
		const { unmount, focus } = renderFocus();
		focus().setActive("actions");
		await flush();
		expect(focus().active).toBe("actions");
		unmount();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/hooks/use-focus-zone.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement useFocusZone**

Create `src/tui/hooks/use-focus-zone.ts`:

```typescript
/**
 * use-focus-zone.ts — Focus management for the TUI shell.
 *
 * Tab cycles between zones. Components check the active zone
 * to decide whether they should consume keyboard input.
 */

import { useState, useCallback } from "react";
import type { FocusZone } from "../types.js";

interface UseFocusZoneResult {
	readonly active: FocusZone;
	readonly next: () => void;
	readonly prev: () => void;
	readonly setActive: (zone: FocusZone) => void;
}

export function useFocusZone(zones: readonly FocusZone[]): UseFocusZoneResult {
	const [active, setActive] = useState<FocusZone>(zones[1] ?? zones[0]);

	const next = useCallback(() => {
		setActive((current) => {
			const idx = zones.indexOf(current);
			return zones[(idx + 1) % zones.length];
		});
	}, [zones]);

	const prev = useCallback(() => {
		setActive((current) => {
			const idx = zones.indexOf(current);
			return zones[(idx - 1 + zones.length) % zones.length];
		});
	}, [zones]);

	return { active, next, prev, setActive };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/hooks/use-focus-zone.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Refactor useKeyboard with enabled guard**

Modify `src/tui/navigation/use-keyboard.ts` — add `enabled` prop so it only handles keys when the activity bar has focus:

Replace the entire file content with:

```typescript
/**
 * use-keyboard.ts — Keyboard handler for activity bar section navigation.
 *
 * Only active when the activity bar focus zone is active.
 * Escape is NOT handled here — it is handled exclusively in App.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly enabled: boolean;
}

export function useKeyboard({ sections, activeSection, onSectionChange, enabled }: UseKeyboardOptions): void {
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
	});
}
```

- [ ] **Step 6: Verify full test suite passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -5
```

Note: The `App` component currently passes `onBack` to `useKeyboard`. Since we removed `onBack`, update `src/tui/app.tsx` to pass `enabled: true` instead (temporary — will be wired to focus zone in Chunk 4). Find the `useKeyboard` call in `app.tsx` and note it is not called there — `useKeyboard` is not used in `app.tsx` currently, so no update needed. The hook export signature changed, but it is not imported by any file other than itself. Verify with type-check.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/use-focus-zone.ts" "01 - Projects/Flowti CLI/tests/tui/hooks/use-focus-zone.test.ts" "01 - Projects/Flowti CLI/src/tui/navigation/use-keyboard.ts"
git commit -m "feat(tui): add useFocusZone hook — Tab cycling between zones, refactor useKeyboard with enabled guard"
```

### Task 5: Build useStreamingProcess hook

**Files:**
- Create: `src/tui/hooks/use-streaming-process.ts`

- [ ] **Step 1: Create useStreamingProcess**

Create `src/tui/hooks/use-streaming-process.ts`:

Note: `IShell.runCapture` is synchronous and blocks until the process exits. True line-by-line streaming requires `IShell.spawnBackground` with a line callback, which may need an infrastructure addition in Phase 4 when build/test pages are implemented. For Phase 1, this hook provides the contract and a working implementation that captures output post-completion. The interface (`lines`, `running`, `exitCode`) is streaming-ready — the internals can be upgraded to use `spawnBackground` without changing any page code.

```typescript
/**
 * use-streaming-process.ts — Run a shell command and capture output into state.
 *
 * Used by build, test, and devtools pages for output rendering.
 * Currently runs synchronously via IShell.runCapture — lines are set on completion.
 * The interface is streaming-ready: when IShell gets a line-callback spawn method,
 * this hook can be upgraded without changing any page component.
 */

import { useState, useCallback } from "react";
import type { LoaderDeps } from "../loaders/loader-types.js";

interface UseStreamingProcessResult {
	readonly lines: readonly string[];
	readonly running: boolean;
	readonly exitCode: number | null;
	readonly start: () => void;
}

export function useStreamingProcess(command: string, cwd: string, deps: LoaderDeps): UseStreamingProcessResult {
	const [lines, setLines] = useState<string[]>([]);
	const [running, setRunning] = useState(false);
	const [exitCode, setExitCode] = useState<number | null>(null);

	const start = useCallback(() => {
		setLines([]);
		setRunning(true);
		setExitCode(null);

		try {
			const result = deps.shell.runCapture(command, { cwd });
			setLines(result.stdout.split("\n"));
			setExitCode(result.exitCode);
		} catch (err) {
			setLines([`Error: ${err instanceof Error ? err.message : String(err)}`]);
			setExitCode(1);
		} finally {
			setRunning(false);
		}
	}, [command, cwd, deps.shell]);

	return { lines, running, exitCode, start };
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/hooks/use-streaming-process.ts"
git commit -m "feat(tui): add useStreamingProcess hook — shell output into state"
```

---

## Chunk 2: Primitive Components

### Task 6: Badge + StatCard + StatGrid + Section

**Files:**
- Create: `src/tui/primitives/badge.tsx`
- Create: `src/tui/primitives/stat-card.tsx`
- Create: `src/tui/primitives/stat-grid.tsx`
- Create: `src/tui/primitives/section.tsx`
- Create: `tests/tui/primitives/primitives.test.ts`

- [ ] **Step 1: Create Badge**

Create `src/tui/primitives/badge.tsx`:

```tsx
/**
 * badge.tsx — Colored inline label for status, type, domain indicators.
 */

import React from "react";
import { Text } from "ink";

interface BadgeProps {
	readonly text: string;
	readonly color?: string;
}

export function Badge({ text, color }: BadgeProps): React.JSX.Element {
	return <Text color={color ?? "gray"}>[{text}]</Text>;
}
```

- [ ] **Step 2: Create StatCard**

Create `src/tui/primitives/stat-card.tsx`:

```tsx
/**
 * stat-card.tsx — Single KPI box showing a label, value, and optional trend.
 */

import React from "react";
import { Box, Text } from "ink";

export interface StatCardData {
	readonly label: string;
	readonly value: string | number;
	readonly trend?: string;
	readonly color?: string;
}

export function StatCard({ label, value, trend, color }: StatCardData): React.JSX.Element {
	return (
		<Box flexDirection="column" borderStyle="round" paddingX={1} minWidth={16}>
			<Text dimColor>{label}</Text>
			<Text bold color={color}>{String(value)}</Text>
			{trend !== undefined && <Text dimColor>{trend}</Text>}
		</Box>
	);
}
```

- [ ] **Step 3: Create StatGrid**

Create `src/tui/primitives/stat-grid.tsx`:

```tsx
/**
 * stat-grid.tsx — Responsive grid of StatCards.
 *
 * Uses useStdout() to determine column count from terminal width.
 */

import React from "react";
import { Box, useStdout } from "ink";
import { StatCard } from "./stat-card.js";
import type { StatCardData } from "./stat-card.js";

interface StatGridProps {
	readonly stats: readonly StatCardData[];
}

export function StatGrid({ stats }: StatGridProps): React.JSX.Element {
	const { stdout } = useStdout();
	const termWidth = stdout?.columns ?? 80;
	const cardWidth = 18;
	const columns = Math.max(1, Math.floor(termWidth / cardWidth));

	const rows: StatCardData[][] = [];
	for (let i = 0; i < stats.length; i += columns) {
		rows.push(stats.slice(i, i + columns) as StatCardData[]);
	}

	return (
		<Box flexDirection="column">
			{rows.map((row, ri) => (
				<Box key={ri} gap={1}>
					{row.map((stat) => (
						<StatCard key={stat.label} {...stat} />
					))}
				</Box>
			))}
		</Box>
	);
}
```

- [ ] **Step 4: Create Section**

Create `src/tui/primitives/section.tsx`:

```tsx
/**
 * section.tsx — Titled content block with optional collapse.
 */

import React, { useState } from "react";
import { Box, Text } from "ink";

interface SectionProps {
	readonly title: string;
	readonly collapsible?: boolean;
	readonly children: React.ReactNode;
}

export function Section({ title, collapsible, children }: SectionProps): React.JSX.Element {
	const [collapsed, setCollapsed] = useState(false);

	const toggle = collapsible ? () => setCollapsed((c) => !c) : undefined;
	const prefix = collapsible ? (collapsed ? "\u25B6" : "\u25BC") : "\u2500";

	return (
		<Box flexDirection="column" marginY={0}>
			<Box>
				<Text bold color="cyan" dimColor={collapsed}>
					{prefix} {title}
				</Text>
			</Box>
			{!collapsed && (
				<Box flexDirection="column" paddingLeft={2}>
					{children}
				</Box>
			)}
		</Box>
	);
}
```

- [ ] **Step 5: Write tests for all four**

Create `tests/tui/primitives/primitives.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { Badge } from "../../../src/tui/primitives/badge.js";
import { StatCard } from "../../../src/tui/primitives/stat-card.js";
import { StatGrid } from "../../../src/tui/primitives/stat-grid.js";
import { Section } from "../../../src/tui/primitives/section.js";

function frame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

describe("Badge", () => {
	it("renders text in brackets", () => {
		const inst = render(React.createElement(Badge, { text: "active" }));
		expect(frame(inst)).toContain("[active]");
		inst.unmount();
	});
});

describe("StatCard", () => {
	it("renders label and value", () => {
		const inst = render(React.createElement(StatCard, { label: "Tests", value: 42 }));
		const f = frame(inst);
		expect(f).toContain("Tests");
		expect(f).toContain("42");
		inst.unmount();
	});

	it("renders trend when provided", () => {
		const inst = render(React.createElement(StatCard, { label: "Coverage", value: "84%", trend: "+2%" }));
		expect(frame(inst)).toContain("+2%");
		inst.unmount();
	});
});

describe("StatGrid", () => {
	it("renders all stats", () => {
		const stats = [
			{ label: "Files", value: 100 },
			{ label: "Tests", value: 200 },
		];
		const inst = render(React.createElement(StatGrid, { stats }));
		const f = frame(inst);
		expect(f).toContain("Files");
		expect(f).toContain("Tests");
		inst.unmount();
	});
});

describe("Section", () => {
	it("renders title and children", () => {
		const inst = render(
			React.createElement(Section, { title: "Skills" },
				React.createElement(Text, null, "TDD"),
			),
		);
		const f = frame(inst);
		expect(f).toContain("Skills");
		expect(f).toContain("TDD");
		inst.unmount();
	});
});
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/badge.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/stat-card.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/stat-grid.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/section.tsx" "01 - Projects/Flowti CLI/tests/tui/primitives/primitives.test.ts"
git commit -m "feat(tui): add Badge, StatCard, StatGrid, Section primitives"
```

### Task 7: ActionBar + KeyHints + SearchInput

**Files:**
- Create: `src/tui/primitives/action-bar.tsx`
- Create: `src/tui/primitives/key-hints.tsx`
- Create: `src/tui/primitives/search-input.tsx`

- [ ] **Step 1: Create ActionBar**

Create `src/tui/primitives/action-bar.tsx`:

```tsx
/**
 * action-bar.tsx — Bottom contextual action buttons.
 *
 * Renders a row of key+label pairs. Used at the bottom of list and dashboard pages.
 */

import React from "react";
import { Box, Text } from "ink";

export interface ActionDef {
	readonly key: string;
	readonly label: string;
}

interface ActionBarProps {
	readonly actions: readonly ActionDef[];
}

export function ActionBar({ actions }: ActionBarProps): React.JSX.Element {
	if (actions.length === 0) return React.createElement(React.Fragment);
	return (
		<Box gap={2} paddingX={1}>
			{actions.map((action) => (
				<Text key={action.key} dimColor>
					<Text bold color="cyan">{action.key}</Text> {action.label}
				</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 2: Create KeyHints**

Create `src/tui/primitives/key-hints.tsx`:

```tsx
/**
 * key-hints.tsx — Key legend row for the status bar.
 */

import React from "react";
import { Box, Text } from "ink";

interface KeyHintDef {
	readonly key: string;
	readonly label: string;
}

interface KeyHintsProps {
	readonly hints: readonly KeyHintDef[];
}

export function KeyHints({ hints }: KeyHintsProps): React.JSX.Element {
	return (
		<Box gap={2}>
			{hints.map((hint) => (
				<Text key={hint.key} dimColor>
					<Text bold>{hint.key}</Text> {hint.label}
				</Text>
			))}
		</Box>
	);
}
```

- [ ] **Step 3: Create SearchInput**

Create `src/tui/primitives/search-input.tsx`:

```tsx
/**
 * search-input.tsx — Inline filter input activated by '/'.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";

interface SearchInputProps {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly placeholder?: string;
	readonly active: boolean;
}

export function SearchInput({ value, onChange, placeholder, active }: SearchInputProps): React.JSX.Element {
	if (!active) return React.createElement(React.Fragment);
	return (
		<Box paddingX={1}>
			<Text dimColor>/ </Text>
			<Text>{value || placeholder || "Type to filter..."}</Text>
			<Text dimColor>\u2588</Text>
		</Box>
	);
}
```

- [ ] **Step 4: Add tests**

Append to `tests/tui/primitives/primitives.test.ts`. **Important:** Place all new `import` statements at the top of the file alongside existing imports (ESM requires imports before any executable code). Only the `describe` blocks go at the end.

Add these imports at the top of the file:

```typescript
import { ActionBar } from "../../../src/tui/primitives/action-bar.js";
import { KeyHints } from "../../../src/tui/primitives/key-hints.js";
import { SearchInput } from "../../../src/tui/primitives/search-input.js";

describe("ActionBar", () => {
	it("renders action keys and labels", () => {
		const actions = [{ key: "n", label: "New" }, { key: "d", label: "Delete" }];
		const inst = render(React.createElement(ActionBar, { actions }));
		const f = frame(inst);
		expect(f).toContain("n");
		expect(f).toContain("New");
		expect(f).toContain("d");
		expect(f).toContain("Delete");
		inst.unmount();
	});

	it("renders nothing for empty actions", () => {
		const inst = render(React.createElement(ActionBar, { actions: [] }));
		expect(frame(inst)).toBe("");
		inst.unmount();
	});
});

describe("KeyHints", () => {
	it("renders hint keys and labels", () => {
		const hints = [{ key: "Enter", label: "Select" }];
		const inst = render(React.createElement(KeyHints, { hints }));
		expect(frame(inst)).toContain("Enter");
		expect(frame(inst)).toContain("Select");
		inst.unmount();
	});
});

describe("SearchInput", () => {
	it("renders filter text when active", () => {
		const inst = render(React.createElement(SearchInput, { value: "bob", onChange: () => {}, active: true }));
		expect(frame(inst)).toContain("bob");
		inst.unmount();
	});

	it("renders nothing when inactive", () => {
		const inst = render(React.createElement(SearchInput, { value: "", onChange: () => {}, active: false }));
		expect(frame(inst)).toBe("");
		inst.unmount();
	});
});
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/action-bar.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/key-hints.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/search-input.tsx" "01 - Projects/Flowti CLI/tests/tui/primitives/primitives.test.ts"
git commit -m "feat(tui): add ActionBar, KeyHints, SearchInput primitives"
```

### Task 8: ScrollableList + MasterDetail

**Files:**
- Create: `src/tui/primitives/scrollable-list.tsx`
- Create: `src/tui/primitives/master-detail.tsx`

- [ ] **Step 1: Create ScrollableList**

Create `src/tui/primitives/scrollable-list.tsx`:

```tsx
/**
 * scrollable-list.tsx — Arrow-key navigable list with virtualization.
 *
 * Uses useStdout() for dynamic height. Only renders the visible window.
 */

import React, { useState } from "react";
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

	const scrollStart = Math.max(0, Math.min(selected - Math.floor(visibleCount / 2), items.length - visibleCount));
	const visibleItems = items.slice(scrollStart, scrollStart + visibleCount);

	if (items.length === 0) {
		return (
			<Box paddingX={1}>
				<Text dimColor>No items</Text>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			{scrollStart > 0 && <Text dimColor> {"  \u25B2 more"}</Text>}
			{visibleItems.map((item, vi) => {
				const actualIndex = scrollStart + vi;
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
			{scrollStart + visibleCount < items.length && <Text dimColor> {"  \u25BC more"}</Text>}
		</Box>
	);
}
```

- [ ] **Step 2: Create MasterDetail**

Create `src/tui/primitives/master-detail.tsx`:

```tsx
/**
 * master-detail.tsx — Split panel layout.
 *
 * Renders master (left) and detail (right) panes side by side.
 */

import React from "react";
import { Box } from "ink";

interface MasterDetailProps {
	readonly masterWidth?: number;
	readonly master: React.ReactNode;
	readonly detail?: React.ReactNode;
}

export function MasterDetail({ masterWidth, master, detail }: MasterDetailProps): React.JSX.Element {
	return (
		<Box flexDirection="row" flexGrow={1}>
			<Box flexDirection="column" width={masterWidth ?? 30} borderStyle="single" borderRight borderTop={false} borderBottom={false} borderLeft={false}>
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

- [ ] **Step 3: Add tests**

Append to `tests/tui/primitives/primitives.test.ts`. **Important:** Place new `import` statements at the top of the file alongside existing imports.

Add these imports at the top:

```typescript
import { ScrollableList } from "../../../src/tui/primitives/scrollable-list.js";
import { MasterDetail } from "../../../src/tui/primitives/master-detail.js";

describe("ScrollableList", () => {
	it("renders items with selection indicator", () => {
		const items = ["Alice", "Bob", "Charlie"];
		const inst = render(
			React.createElement(ScrollableList, {
				items,
				selected: 1,
				renderItem: (item: string, _i: number, sel: boolean) => React.createElement(Text, { bold: sel }, item),
			}),
		);
		const f = frame(inst);
		expect(f).toContain("Bob");
		expect(f).toContain("\u25B6");
		inst.unmount();
	});

	it("renders empty state", () => {
		const inst = render(
			React.createElement(ScrollableList, {
				items: [],
				selected: 0,
				renderItem: () => React.createElement(Text, null, "x"),
			}),
		);
		expect(frame(inst)).toContain("No items");
		inst.unmount();
	});
});

describe("MasterDetail", () => {
	it("renders master and detail panes", () => {
		const inst = render(
			React.createElement(MasterDetail, {
				master: React.createElement(Text, null, "LIST"),
				detail: React.createElement(Text, null, "DETAIL"),
			}),
		);
		const f = frame(inst);
		expect(f).toContain("LIST");
		expect(f).toContain("DETAIL");
		inst.unmount();
	});

	it("renders without detail pane", () => {
		const inst = render(
			React.createElement(MasterDetail, {
				master: React.createElement(Text, null, "LIST"),
			}),
		);
		expect(frame(inst)).toContain("LIST");
		inst.unmount();
	});
});
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/scrollable-list.tsx" "01 - Projects/Flowti CLI/src/tui/primitives/master-detail.tsx" "01 - Projects/Flowti CLI/tests/tui/primitives/primitives.test.ts"
git commit -m "feat(tui): add ScrollableList and MasterDetail primitives"
```

### Task 9: FormField

**Files:**
- Create: `src/tui/primitives/form-field.tsx`

- [ ] **Step 1: Create FormField**

Create `src/tui/primitives/form-field.tsx`:

```tsx
/**
 * form-field.tsx — Form input field supporting text, select, and toggle types.
 */

import React from "react";
import { Box, Text } from "ink";

interface FormFieldBaseProps {
	readonly label: string;
	readonly focused?: boolean;
	readonly error?: string;
}

interface TextFieldProps extends FormFieldBaseProps {
	readonly type: "text";
	readonly value: string;
	readonly placeholder?: string;
}

interface SelectFieldProps extends FormFieldBaseProps {
	readonly type: "select";
	readonly value: string;
	readonly options: readonly string[];
}

interface ToggleFieldProps extends FormFieldBaseProps {
	readonly type: "toggle";
	readonly value: boolean;
}

export type FormFieldProps = TextFieldProps | SelectFieldProps | ToggleFieldProps;

export function FormField(props: FormFieldProps): React.JSX.Element {
	const { label, focused, error } = props;
	const indicator = focused ? "\u25B6 " : "  ";

	let valueDisplay: React.ReactNode;
	switch (props.type) {
		case "text":
			valueDisplay = <Text>{props.value || props.placeholder || ""}{focused ? "\u2588" : ""}</Text>;
			break;
		case "select":
			valueDisplay = <Text>{props.value}</Text>;
			break;
		case "toggle":
			valueDisplay = <Text color={props.value ? "green" : "red"}>{props.value ? "Yes" : "No"}</Text>;
			break;
	}

	return (
		<Box>
			<Text color={focused ? "cyan" : undefined} bold={focused}>{indicator}{label}: </Text>
			{valueDisplay}
			{error !== undefined && <Text color="red"> {error}</Text>}
		</Box>
	);
}
```

- [ ] **Step 2: Add tests**

Append to `tests/tui/primitives/primitives.test.ts`. **Important:** Place new `import` at the top of the file alongside existing imports.

Add this import at the top:

```typescript
import { FormField } from "../../../src/tui/primitives/form-field.js";

describe("FormField", () => {
	it("renders text field with value", () => {
		const inst = render(React.createElement(FormField, { type: "text", label: "Name", value: "Bob" }));
		const f = frame(inst);
		expect(f).toContain("Name");
		expect(f).toContain("Bob");
		inst.unmount();
	});

	it("renders toggle field", () => {
		const inst = render(React.createElement(FormField, { type: "toggle", label: "Active", value: true }));
		expect(frame(inst)).toContain("Yes");
		inst.unmount();
	});

	it("renders select field", () => {
		const inst = render(React.createElement(FormField, { type: "select", label: "Type", value: "ai", options: ["ai", "human"] }));
		expect(frame(inst)).toContain("ai");
		inst.unmount();
	});

	it("renders error message", () => {
		const inst = render(React.createElement(FormField, { type: "text", label: "Name", value: "", error: "Required" }));
		expect(frame(inst)).toContain("Required");
		inst.unmount();
	});
});
```

- [ ] **Step 3: Run tests — expect PASS**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/primitives/primitives.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/primitives/form-field.tsx" "01 - Projects/Flowti CLI/tests/tui/primitives/primitives.test.ts"
git commit -m "feat(tui): add FormField primitive — text, select, toggle inputs"
```

---

## Chunk 3: Page Patterns

### Task 10: DashboardPage pattern

**Files:**
- Create: `src/tui/pages/dashboard-page.tsx`

- [ ] **Step 1: Create DashboardPage**

Create `src/tui/pages/dashboard-page.tsx`:

```tsx
/**
 * dashboard-page.tsx — Generic dashboard page pattern.
 *
 * Renders a StatGrid at top + scrollable Section list below.
 * Used by start, project-detail, health, agent-detail, build, test pages.
 */

import React from "react";
import { Box } from "ink";
import { StatGrid } from "../primitives/stat-grid.js";
import { Section } from "../primitives/section.js";
import { ActionBar } from "../primitives/action-bar.js";
import type { StatCardData } from "../primitives/stat-card.js";
import type { ActionDef } from "../primitives/action-bar.js";

export interface DashboardSection {
	readonly title: string;
	readonly content: React.ReactNode;
	readonly collapsible?: boolean;
}

interface DashboardPageProps {
	readonly stats?: readonly StatCardData[];
	readonly sections: readonly DashboardSection[];
	readonly actions?: readonly ActionDef[];
}

export function DashboardPage({ stats, sections, actions }: DashboardPageProps): React.JSX.Element {
	return (
		<Box flexDirection="column" flexGrow={1}>
			{stats && stats.length > 0 && (
				<Box marginBottom={1}>
					<StatGrid stats={stats} />
				</Box>
			)}
			<Box flexDirection="column" flexGrow={1}>
				{sections.map((section) => (
					<Section key={section.title} title={section.title} collapsible={section.collapsible}>
						{section.content}
					</Section>
				))}
			</Box>
			{actions && actions.length > 0 && <ActionBar actions={actions} />}
		</Box>
	);
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/dashboard-page.tsx"
git commit -m "feat(tui): add DashboardPage pattern — stats grid + sections"
```

### Task 11: ListPage pattern

**Files:**
- Create: `src/tui/pages/list-page.tsx`

- [ ] **Step 1: Create ListPage**

Create `src/tui/pages/list-page.tsx`:

```tsx
/**
 * list-page.tsx — Generic list+detail page pattern.
 *
 * Renders a ScrollableList with optional MasterDetail panel.
 * Handles arrow-key navigation and item selection.
 * Used by agents, iterations, resources, deliverables, and many CRUD pages.
 */

import React, { useState } from "react";
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
	readonly masterWidth?: number;
	readonly enabled?: boolean;
}

export function ListPage<T>({ items, renderItem, renderDetail, actions, onSelect, masterWidth, enabled = true }: ListPageProps<T>): React.JSX.Element {
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

	const detail = renderDetail && items[selected] ? renderDetail(items[selected]) : undefined;

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box flexGrow={1}>
				{renderDetail ? (
					<MasterDetail masterWidth={masterWidth} master={list} detail={detail} />
				) : (
					list
				)}
			</Box>
			{actions && actions.length > 0 && <ActionBar actions={actions} />}
		</Box>
	);
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/list-page.tsx"
git commit -m "feat(tui): add ListPage pattern — scrollable list with optional master-detail"
```

### Task 12: FormPage pattern

**Files:**
- Create: `src/tui/pages/form-page.tsx`

- [ ] **Step 1: Create FormPage**

Create `src/tui/pages/form-page.tsx`:

```tsx
/**
 * form-page.tsx — Generic form page pattern.
 *
 * Renders a vertical list of FormFields with Tab navigation between fields.
 * Used by scaffold, make, capture, publish pages.
 */

import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { FormField } from "../primitives/form-field.js";
import type { FormFieldProps } from "../primitives/form-field.js";

export interface FormFieldDef {
	readonly name: string;
	readonly label: string;
	readonly type: "text" | "select" | "toggle";
	readonly options?: readonly string[];
	readonly required?: boolean;
	readonly placeholder?: string;
}

interface FormPageProps {
	readonly title: string;
	readonly fields: readonly FormFieldDef[];
	readonly values: Readonly<Record<string, string | boolean>>;
	readonly onValueChange: (name: string, value: string | boolean) => void;
	readonly onSubmit: () => void;
	readonly onCancel: () => void;
	readonly enabled?: boolean;
}

export function FormPage({ title, fields, values, onValueChange, onSubmit, onCancel, enabled = true }: FormPageProps): React.JSX.Element {
	const [focusedField, setFocusedField] = useState(0);

	useInput((input, key) => {
		if (!enabled) return;
		if (key.downArrow || (key.tab && !key.shift)) {
			setFocusedField((f) => Math.min(f + 1, fields.length - 1));
		}
		if (key.upArrow || (key.tab && key.shift)) {
			setFocusedField((f) => Math.max(f - 1, 0));
		}
		if (key.return) {
			const field = fields[focusedField];
			if (field.type === "toggle") {
				onValueChange(field.name, !values[field.name]);
			} else if (focusedField === fields.length - 1) {
				onSubmit();
			}
		}
		if (key.escape) onCancel();

		// Text input for text fields
		const field = fields[focusedField];
		if (field?.type === "text" && input && !key.ctrl && !key.meta) {
			if (key.backspace || key.delete) {
				const current = String(values[field.name] ?? "");
				onValueChange(field.name, current.slice(0, -1));
			} else if (input.length === 1) {
				const current = String(values[field.name] ?? "");
				onValueChange(field.name, current + input);
			}
		}

		// Select cycling
		if (field?.type === "select" && field.options) {
			if (key.leftArrow || key.rightArrow) {
				const current = String(values[field.name] ?? field.options[0]);
				const idx = field.options.indexOf(current);
				const next = key.rightArrow
					? field.options[(idx + 1) % field.options.length]
					: field.options[(idx - 1 + field.options.length) % field.options.length];
				onValueChange(field.name, next);
			}
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1} paddingX={1}>
			<Text bold color="cyan">{title}</Text>
			<Box flexDirection="column" marginTop={1}>
				{fields.map((field, i) => {
					const val = values[field.name];
					const fieldProps: FormFieldProps = field.type === "toggle"
						? { type: "toggle", label: field.label, value: Boolean(val), focused: i === focusedField }
						: field.type === "select"
							? { type: "select", label: field.label, value: String(val ?? field.options?.[0] ?? ""), options: field.options ?? [], focused: i === focusedField }
							: { type: "text", label: field.label, value: String(val ?? ""), placeholder: field.placeholder, focused: i === focusedField };
					return <FormField key={field.name} {...fieldProps} />;
				})}
			</Box>
			<Box marginTop={1}>
				<Text dimColor>Enter submit | Esc cancel | Tab next field</Text>
			</Box>
		</Box>
	);
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/form-page.tsx"
git commit -m "feat(tui): add FormPage pattern — structured form with field navigation"
```

---

## Chunk 4: ContentArea Upgrade + Final Verification

### Task 13: Upgrade ContentArea with loader orchestration

**Files:**
- Modify: `src/tui/shell/content-area.tsx`

- [ ] **Step 1: Update ContentArea**

Replace `src/tui/shell/content-area.tsx` with the loader-aware version. The existing `ContentArea` just does page lookup — the upgraded version adds `useLoader`, error handling, and `onAction` flow. However, since no loaders are registered yet (that's Phase 2), the upgrade must be backward-compatible: pages without a registered loader get the existing `PageProps` flow.

Replace the entire file:

```tsx
/**
 * content-area.tsx — Renders the active page component from the page registry.
 *
 * For pages with registered loaders: calls loader, passes data + onAction as props.
 * For pages without loaders: passes basic PageProps (backward-compatible with Phase 0).
 */

import React, { useState } from "react";
import { Box, Text } from "ink";
import { getPage } from "../pages/page-registry.js";

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
}

export function ContentArea({ pageId, params, navigate, goBack }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const Page = getPage(pageId);

	const handleAction = (_actionId: string, _params?: Record<string, string>) => {
		setActionError(null);
		// Action bridge will be wired in Phase 2 when loaders are registered
	};

	return (
		<Box flexGrow={1} flexDirection="column">
			{actionError !== null && (
				<Box paddingX={1} marginBottom={1}>
					<Text color="red" bold>Error: {actionError} </Text>
					<Text dimColor>(press any key to dismiss)</Text>
				</Box>
			)}
			{React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction })}
		</Box>
	);
}
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/ --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/content-area.tsx"
git commit -m "feat(tui): upgrade ContentArea with action error handling"
```

### Task 14: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npm test
```

Expected: All existing tests pass + all new TUI tests pass.

- [ ] **Step 2: Count new tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/ --config configs/vitest.config.ts --reporter=verbose 2>&1 | tail -20
```

Expected: 45-55 tests across 10+ files.

- [ ] **Step 3: Verify build**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

Expected: Clean build.

- [ ] **Step 4: Verify lint**

```bash
cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs
```

Expected: Clean lint.

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `src/tui/loaders/loader-types.ts` — LoaderDeps, LoaderContext, LoaderFn types
- [ ] `src/tui/hooks/use-loader.ts` — data loading hook with refresh
- [ ] `src/tui/hooks/use-action-bridge.ts` — mutation routing hook
- [ ] `src/tui/hooks/action-map.ts` — lightweight action dispatch
- [ ] `src/tui/hooks/use-focus-zone.ts` — Tab cycling between zones
- [ ] `src/tui/hooks/use-streaming-process.ts` — shell output streaming
- [ ] `src/tui/primitives/badge.tsx` — colored inline label
- [ ] `src/tui/primitives/stat-card.tsx` — KPI box
- [ ] `src/tui/primitives/stat-grid.tsx` — responsive stat grid
- [ ] `src/tui/primitives/section.tsx` — titled content block
- [ ] `src/tui/primitives/scrollable-list.tsx` — virtualized list
- [ ] `src/tui/primitives/master-detail.tsx` — split panel layout
- [ ] `src/tui/primitives/action-bar.tsx` — contextual actions
- [ ] `src/tui/primitives/key-hints.tsx` — key legend
- [ ] `src/tui/primitives/search-input.tsx` — inline filter
- [ ] `src/tui/primitives/form-field.tsx` — text/select/toggle input
- [ ] `src/tui/pages/dashboard-page.tsx` — dashboard pattern
- [ ] `src/tui/pages/list-page.tsx` — list+detail pattern
- [ ] `src/tui/pages/form-page.tsx` — form pattern
- [ ] `src/tui/navigation/use-keyboard.ts` — refactored with enabled guard
- [ ] `src/tui/shell/content-area.tsx` — upgraded with error handling
- [ ] `npm test` passes (tsc + eslint + vitest)
- [ ] `node configs/esbuild.config.mjs` builds cleanly
