# Ink TUI Phase 2: High-Traffic Pages — Implementation Plan

**Goal:** Migrate the 6 most-used pages to Ink TUI (start, ai-tools, agent-detail, project-detail, health, iterations), wire the loader infrastructure from Phase 1, and flip `--tui` to be the default mode.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-ink-tui-full-migration-design.md`

**All paths relative to:** `01 - Projects/Flowti CLI/`

**Test command:** `npx vitest run <path> --config configs/vitest.config.ts`

**Full suite:** `npm test`

**Convention:** ESM with `.js` extensions in imports. Tabs for indentation. TSX for components, `.ts` for hooks/logic. No `any` types. Domain purity — loaders receive all deps via `LoaderContext`, never import singletons. Pages are pure presentation — they receive data from loaders via `useLoader` hook.

---

## File Structure

### New Files (16)

| File | Responsibility |
|------|---------------|
| `src/tui/context.tsx` | React Context providing LoaderContext building blocks to all pages |
| `src/tui/loaders/loader-registry.ts` | Maps pageId → LoaderFn for ContentArea orchestration |
| `src/tui/loaders/start-loader.ts` | Home dashboard data — projects, agents, iterations, health |
| `src/tui/loaders/ai-tools-loader.ts` | Agent list with live status |
| `src/tui/loaders/agent-detail-loader.ts` | Single agent deep view data |
| `src/tui/loaders/project-detail-loader.ts` | Project info + health snapshot |
| `src/tui/loaders/health-loader.ts` | Health metrics + trends |
| `src/tui/loaders/iterations-loader.ts` | Iteration list with scope progress |
| `src/tui/pages/start-page.tsx` | Home dashboard — DashboardPage pattern |
| `src/tui/pages/ai-tools-page.tsx` | Agent list — ListPage with MasterDetail |
| `src/tui/pages/agent-detail-page.tsx` | Single agent — DashboardPage |
| `src/tui/pages/project-detail-page.tsx` | Project dashboard — DashboardPage |
| `src/tui/pages/health-page.tsx` | Health dashboard — DashboardPage |
| `src/tui/pages/iterations-page.tsx` | Iteration list — ListPage with MasterDetail |
| `tests/tui/loaders/loaders.test.ts` | All loader tests |
| `tests/tui/pages/pages.test.ts` | All page component tests |

### Modified Files (5)

| File | Change |
|------|--------|
| `src/tui/tui-entry.ts` | Import infrastructure, wrap App in TuiProvider, import page modules |
| `src/tui/app.tsx` | Accept and pass TuiProvider context |
| `src/tui/shell/content-area.tsx` | Build LoaderContext, orchestrate loaders, wire action bridge |
| `src/tui/navigation/section-map.ts` | Remove invalid page references |
| `src/tui/pages/page-registry.ts` | No change needed — pages self-register on import |

---

## Chunk 1: TUI Context + ContentArea Wiring

### Task 1: Create TuiContext

**Files:**
- Create: `src/tui/context.tsx`
- Modify: `src/tui/tui-entry.ts`
- Modify: `src/tui/app.tsx`

- [ ] **Step 1: Create TuiContext**

Create `src/tui/context.tsx`:

```tsx
/**
 * context.tsx — React Context providing infrastructure deps to TUI pages.
 *
 * TuiProvider wraps the App component and provides LoaderContext building blocks.
 * Pages access deps via useTuiContext() to build LoaderContext for useLoader.
 */

import React, { createContext, useContext, useMemo } from "react";
import type { LoaderDeps, LoaderContext } from "./loaders/loader-types.js";
import type { AgentsConfig, IterationsConfig, ProjectConfig } from "../infrastructure/types-config.js";

export interface TuiContextValue {
	readonly deps: LoaderDeps;
	readonly vaultRoot: string;
	readonly projectPath: string;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly iterationsConfig: IterationsConfig | undefined;
	readonly projectConfig: ProjectConfig | undefined;
}

const TuiCtx = createContext<TuiContextValue | null>(null);

interface TuiProviderProps {
	readonly value: TuiContextValue;
	readonly children: React.ReactNode;
}

export function TuiProvider({ value, children }: TuiProviderProps): React.JSX.Element {
	return React.createElement(TuiCtx.Provider, { value }, children);
}

export function useTuiContext(): TuiContextValue {
	const ctx = useContext(TuiCtx);
	if (!ctx) throw new Error("useTuiContext must be used within TuiProvider");
	return ctx;
}

export function useLoaderContext(params: Readonly<Record<string, string>>): LoaderContext {
	const tui = useTuiContext();
	return useMemo(() => ({
		deps: tui.deps,
		vaultRoot: tui.vaultRoot,
		projectPath: tui.projectPath,
		agentsConfig: tui.agentsConfig,
		params,
	}), [tui, params]);
}
```

- [ ] **Step 2: Update tui-entry.ts**

Replace `src/tui/tui-entry.ts` with infrastructure-aware version. This imports infrastructure singletons and wraps App in TuiProvider — allowed because tui-entry is UI layer (UI → Infrastructure is legal).

```typescript
/**
 * tui-entry.ts — Boots the Ink TUI application.
 *
 * Imports infrastructure singletons and wraps App in TuiProvider.
 * Page modules are imported here to trigger self-registration.
 */

import React from "react";
import { render } from "ink";
import { App } from "./app.js";
import { TuiProvider } from "./context.js";
import type { TuiContextValue } from "./context.js";
import { disk } from "../infrastructure/filesystem.js";
import { shell } from "../infrastructure/shell.js";
import { paths } from "../infrastructure/paths.js";
import { clock } from "../infrastructure/clock.js";
import { log } from "../infrastructure/logger.js";
import { VAULT_ROOT, CLI_PROJECT, cliConfig } from "../infrastructure/config.js";

// Import page modules to trigger self-registration
import "./pages/start-page.js";
import "./pages/ai-tools-page.js";
import "./pages/agent-detail-page.js";
import "./pages/project-detail-page.js";
import "./pages/health-page.js";
import "./pages/iterations-page.js";

export async function runTui(): Promise<void> {
	const tuiContext: TuiContextValue = {
		deps: { disk, paths, clock, shell, log },
		vaultRoot: VAULT_ROOT,
		projectPath: CLI_PROJECT,
		agentsConfig: cliConfig.agents,
		iterationsConfig: cliConfig.management?.iterations,
		projectConfig: undefined,
	};

	const instance = render(
		React.createElement(TuiProvider, { value: tuiContext },
			React.createElement(App),
		),
	);
	await instance.waitUntilExit();
}
```

- [ ] **Step 3: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Note: Type-check will fail because page modules don't exist yet. Create stub files for them first (just export empty components that register themselves). These stubs will be replaced in later tasks.

- [ ] **Step 4: Create stub page files**

Create minimal stubs for each page module so tui-entry imports work:

For each of: `start-page.tsx`, `ai-tools-page.tsx`, `agent-detail-page.tsx`, `project-detail-page.tsx`, `health-page.tsx`, `iterations-page.tsx`:

```tsx
import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import type { PageProps } from "../types.js";

function <Name>Page({ pageId }: PageProps): React.JSX.Element {
	return React.createElement(Text, null, `${pageId} — loading...`);
}

registerPage("<page-id>", <Name>Page);
```

- [ ] **Step 5: Verify type-check passes**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/context.tsx" "01 - Projects/Flowti CLI/src/tui/tui-entry.ts" "01 - Projects/Flowti CLI/src/tui/pages/start-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/ai-tools-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/agent-detail-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/project-detail-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/health-page.tsx" "01 - Projects/Flowti CLI/src/tui/pages/iterations-page.tsx"
git commit -m "feat(tui): add TuiContext provider and stub page modules"
```

### Task 2: Upgrade ContentArea with loader orchestration

**Files:**
- Modify: `src/tui/shell/content-area.tsx`

- [ ] **Step 1: Update ContentArea to use TuiContext**

Replace `src/tui/shell/content-area.tsx`:

```tsx
/**
 * content-area.tsx — Renders the active page from the page registry.
 *
 * Builds LoaderContext from TuiContext + current page params.
 * Passes onAction callback for mutation handling.
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
}

export function ContentArea({ pageId, params, navigate, goBack }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const ctx = useLoaderContext(params);
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
			{React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction })}
		</Box>
	);
}
```

- [ ] **Step 2: Verify type-check + existing tests**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/tui/ --config configs/vitest.config.ts
```

Note: The content-area test creates ContentArea without TuiProvider, which will throw. Wrap it in a test TuiProvider. Update the test to provide a mock TuiContext.

- [ ] **Step 3: Fix content-area test**

Update `tests/tui/shell/content-area.test.ts` to wrap in mock TuiProvider:

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

- [ ] **Step 4: Verify tests pass**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/tui/ --config configs/vitest.config.ts
```

- [ ] **Step 5: Also update app.test.ts if it fails**

The App component test may fail because App now renders inside ContentArea which needs TuiProvider. Check if app.test.ts passes. If not, wrap the App render in TuiProvider mock.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/shell/content-area.tsx" "01 - Projects/Flowti CLI/tests/tui/shell/content-area.test.ts"
git commit -m "feat(tui): wire TuiContext into ContentArea for loader orchestration"
```

---

## Chunk 2: Loaders

### Task 3: Create all 6 loaders

**Files:**
- Create: `src/tui/loaders/start-loader.ts`
- Create: `src/tui/loaders/ai-tools-loader.ts`
- Create: `src/tui/loaders/agent-detail-loader.ts`
- Create: `src/tui/loaders/project-detail-loader.ts`
- Create: `src/tui/loaders/health-loader.ts`
- Create: `src/tui/loaders/iterations-loader.ts`

Loaders are pure functions that receive LoaderContext and return typed data models. They call domain functions for data. Loaders are in the UI layer — they CAN import domain functions (UI → Domain is the same direction as Controller → Domain).

Each loader must handle errors gracefully — if a domain function throws, the loader should return fallback/empty data rather than propagating the exception (useLoader will catch exceptions, but partial data is better than complete failure).

- [ ] **Step 1: Create start-loader.ts**

This loader aggregates data for the home dashboard. It calls domain functions for projects, agents, iterations.

```typescript
/**
 * start-loader.ts — Home dashboard loader.
 */

import type { LoaderContext } from "./loader-types.js";
import { listProjects } from "../../domain/project/project.js";
import { getProjectAgents } from "../../domain/agents/agent-store.js";
import { findCurrentIteration } from "../../domain/iterations/iteration-store.js";

export interface StartData {
	readonly projectCount: number;
	readonly agentCount: number;
	readonly activeIteration: { name: string; number: number; completion: number } | null;
	readonly agents: readonly { name: string; domain: string; agentType: string }[];
}

export function loadStart(ctx: LoaderContext): StartData {
	const { deps, vaultRoot, projectPath, agentsConfig } = ctx;

	let projectCount = 0;
	try {
		const projectsDir = deps.paths.join(vaultRoot, "01 - Projects");
		projectCount = listProjects(projectsDir, deps).length;
	} catch { /* empty */ }

	let agents: StartData["agents"] = [];
	try {
		const agentDir = deps.paths.join(vaultRoot, agentsConfig?.dir ?? "03 - Resources/Agents");
		const raw = getProjectAgents(deps, agentDir, agentsConfig, agentsConfig?.roster);
		agents = raw.map((a) => ({ name: a.name, domain: a.domain ?? "", agentType: a.agentType ?? "ai" }));
	} catch { /* empty */ }

	let activeIteration: StartData["activeIteration"] = null;
	try {
		if (projectPath) {
			const iter = findCurrentIteration(deps, projectPath);
			if (iter) {
				const done = iter.scopeItems?.filter((s) => s.done).length ?? 0;
				const total = iter.scopeItems?.length ?? 0;
				activeIteration = { name: iter.name, number: iter.number, completion: total > 0 ? Math.round((done / total) * 100) : 0 };
			}
		}
	} catch { /* empty */ }

	return { projectCount, agentCount: agents.length, activeIteration, agents };
}
```

- [ ] **Step 2: Create ai-tools-loader.ts**

```typescript
/**
 * ai-tools-loader.ts — Agent list loader.
 */

import type { LoaderContext } from "./loader-types.js";
import { getProjectAgents } from "../../domain/agents/agent-store.js";

export interface AgentListItem {
	readonly name: string;
	readonly agentType: string;
	readonly domain: string;
	readonly description: string;
	readonly skills: readonly string[];
	readonly file: string;
}

export interface AiToolsData {
	readonly agents: readonly AgentListItem[];
}

export function loadAiTools(ctx: LoaderContext): AiToolsData {
	const { deps, vaultRoot, agentsConfig } = ctx;

	try {
		const agentDir = deps.paths.join(vaultRoot, agentsConfig?.dir ?? "03 - Resources/Agents");
		const raw = getProjectAgents(deps, agentDir, agentsConfig, agentsConfig?.roster);
		const agents: AgentListItem[] = raw.map((a) => ({
			name: a.name,
			agentType: a.agentType ?? "ai",
			domain: a.domain ?? "",
			description: a.description ?? "",
			skills: (a.skills ?? []).map((s) => typeof s === "string" ? s : s.name ?? String(s)),
			file: a.file ?? "",
		}));
		return { agents };
	} catch {
		return { agents: [] };
	}
}
```

- [ ] **Step 3: Create agent-detail-loader.ts**

```typescript
/**
 * agent-detail-loader.ts — Single agent detail loader.
 */

import type { LoaderContext } from "./loader-types.js";
import { findAgent } from "../../domain/agents/agent-store.js";

export interface AgentDetailData {
	readonly found: boolean;
	readonly name: string;
	readonly agentType: string;
	readonly domain: string;
	readonly description: string;
	readonly skills: readonly { name: string; level: string }[];
	readonly tools: readonly string[];
	readonly roles: readonly string[];
	readonly behaviors: readonly string[];
	readonly persona: string;
	readonly mood: string;
}

export function loadAgentDetail(ctx: LoaderContext): AgentDetailData {
	const { deps, vaultRoot, agentsConfig, params } = ctx;
	const agentName = params.agentName ?? params.name ?? "";
	const agentDir = deps.paths.join(vaultRoot, agentsConfig?.dir ?? "03 - Resources/Agents");

	try {
		const agent = findAgent(deps, agentDir, agentName, agentsConfig);
		if (!agent) return { found: false, name: agentName, agentType: "", domain: "", description: "Agent not found", skills: [], tools: [], roles: [], behaviors: [], persona: "", mood: "" };

		return {
			found: true,
			name: agent.name,
			agentType: agent.agentType ?? "ai",
			domain: agent.domain ?? "",
			description: agent.description ?? "",
			skills: (agent.skills ?? []).map((s) => typeof s === "string" ? { name: s, level: "" } : { name: s.name ?? String(s), level: s.level ?? "" }),
			tools: (agent.tools ?? []).map((t) => typeof t === "string" ? t : String(t)),
			roles: (agent.roles ?? []).map(String),
			behaviors: (agent.behaviors ?? []).map(String),
			persona: typeof agent.persona === "string" ? agent.persona : "",
			mood: typeof agent.mood === "string" ? agent.mood : "",
		};
	} catch {
		return { found: false, name: agentName, agentType: "", domain: "", description: "Error loading agent", skills: [], tools: [], roles: [], behaviors: [], persona: "", mood: "" };
	}
}
```

- [ ] **Step 4: Create project-detail-loader.ts**

```typescript
/**
 * project-detail-loader.ts — Project info loader.
 */

import type { LoaderContext } from "./loader-types.js";

export interface ProjectDetailData {
	readonly name: string;
	readonly path: string;
	readonly sourceFiles: number;
	readonly testFiles: number;
}

export function loadProjectDetail(ctx: LoaderContext): ProjectDetailData {
	const { deps, projectPath } = ctx;
	if (!projectPath) return { name: "Unknown", path: "", sourceFiles: 0, testFiles: 0 };

	try {
		const srcDir = deps.paths.join(projectPath, "src");
		const testsDir = deps.paths.join(projectPath, "tests");
		const sourceFiles = deps.disk.existsSync(srcDir) ? countFiles(deps, srcDir) : 0;
		const testFiles = deps.disk.existsSync(testsDir) ? countFiles(deps, testsDir) : 0;
		const name = deps.paths.basename(projectPath);
		return { name, path: projectPath, sourceFiles, testFiles };
	} catch {
		return { name: deps.paths.basename(projectPath), path: projectPath, sourceFiles: 0, testFiles: 0 };
	}
}

function countFiles(deps: { disk: { readdirSync: (p: string, o: { withFileTypes: true }) => { isFile: () => boolean; isDirectory: () => boolean; name: string }[] } }, dir: string): number {
	try {
		const entries = deps.disk.readdirSync(dir, { withFileTypes: true });
		let count = 0;
		for (const entry of entries) {
			if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) count++;
			if (entry.isDirectory()) count += countFiles(deps, dir + "/" + entry.name);
		}
		return count;
	} catch { return 0; }
}
```

- [ ] **Step 5: Create health-loader.ts**

```typescript
/**
 * health-loader.ts — Health dashboard loader.
 *
 * Reads the most recent health reports from the reports directory.
 * Does NOT re-run health collection (that would be slow/blocking in the TUI).
 */

import type { LoaderContext } from "./loader-types.js";

export interface HealthData {
	readonly available: boolean;
	readonly tests: { total: number; passed: number; failed: number };
	readonly coverage: { lines: number; branches: number; functions: number };
	readonly lint: { errors: number; warnings: number };
}

export function loadHealth(ctx: LoaderContext): HealthData {
	const { deps, projectPath } = ctx;
	const empty: HealthData = { available: false, tests: { total: 0, passed: 0, failed: 0 }, coverage: { lines: 0, branches: 0, functions: 0 }, lint: { errors: 0, warnings: 0 } };
	if (!projectPath) return empty;

	try {
		const reportsDir = deps.paths.join(projectPath, "reports");
		if (!deps.disk.existsSync(reportsDir)) return empty;

		const testReport = tryReadReport(deps, deps.paths.join(reportsDir, "Test Report.md"));
		const coverageReport = tryReadReport(deps, deps.paths.join(reportsDir, "Coverage Report.md"));

		return {
			available: testReport !== null || coverageReport !== null,
			tests: parseTestMetrics(testReport),
			coverage: parseCoverageMetrics(coverageReport),
			lint: { errors: 0, warnings: 0 },
		};
	} catch {
		return empty;
	}
}

function tryReadReport(deps: { disk: { existsSync: (p: string) => boolean; readFileSync: (p: string, e: string) => string } }, path: string): string | null {
	try {
		if (deps.disk.existsSync(path)) return deps.disk.readFileSync(path, "utf-8");
	} catch { /* empty */ }
	return null;
}

function parseTestMetrics(report: string | null): HealthData["tests"] {
	if (!report) return { total: 0, passed: 0, failed: 0 };
	const totalMatch = report.match(/(\d+)\s+(?:tests?|total)/i);
	const passedMatch = report.match(/(\d+)\s+passed/i);
	const failedMatch = report.match(/(\d+)\s+failed/i);
	return {
		total: totalMatch ? parseInt(totalMatch[1], 10) : 0,
		passed: passedMatch ? parseInt(passedMatch[1], 10) : 0,
		failed: failedMatch ? parseInt(failedMatch[1], 10) : 0,
	};
}

function parseCoverageMetrics(report: string | null): HealthData["coverage"] {
	if (!report) return { lines: 0, branches: 0, functions: 0 };
	const linesMatch = report.match(/lines[^0-9]*(\d+(?:\.\d+)?)/i);
	const branchesMatch = report.match(/branches[^0-9]*(\d+(?:\.\d+)?)/i);
	const functionsMatch = report.match(/functions[^0-9]*(\d+(?:\.\d+)?)/i);
	return {
		lines: linesMatch ? parseFloat(linesMatch[1]) : 0,
		branches: branchesMatch ? parseFloat(branchesMatch[1]) : 0,
		functions: functionsMatch ? parseFloat(functionsMatch[1]) : 0,
	};
}
```

- [ ] **Step 6: Create iterations-loader.ts**

```typescript
/**
 * iterations-loader.ts — Iteration list loader.
 */

import type { LoaderContext } from "./loader-types.js";
import { listIterations } from "../../domain/iterations/iteration-store.js";

export interface IterationListItem {
	readonly name: string;
	readonly number: number;
	readonly status: string;
	readonly goal: string;
	readonly startDate: string;
	readonly endDate: string;
	readonly scopeDone: number;
	readonly scopeTotal: number;
}

export interface IterationsData {
	readonly iterations: readonly IterationListItem[];
}

export function loadIterations(ctx: LoaderContext): IterationsData {
	const { deps, projectPath } = ctx;
	if (!projectPath) return { iterations: [] };

	try {
		const raw = listIterations(deps, projectPath);
		const iterations: IterationListItem[] = raw.map((iter) => {
			const done = iter.scopeItems?.filter((s) => s.done).length ?? 0;
			const total = iter.scopeItems?.length ?? 0;
			return {
				name: iter.name,
				number: iter.number,
				status: iter.status ?? "new",
				goal: iter.goal ?? "",
				startDate: iter.startDate ?? "",
				endDate: iter.endDate ?? "",
				scopeDone: done,
				scopeTotal: total,
			};
		});
		return { iterations };
	} catch {
		return { iterations: [] };
	}
}
```

- [ ] **Step 7: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Note: Loaders import domain functions. The domain function signatures and types must match. If type-check fails, inspect the actual domain types and adjust loader code accordingly. Common adjustments: domain functions might use `StoreApi` patterns, field names might differ, config types might be needed.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/loaders/"
git commit -m "feat(tui): add 6 page loaders — start, agents, detail, project, health, iterations"
```

---

## Chunk 3: Page Components

### Task 4: Implement all 6 pages

**Files:**
- Replace stubs: `src/tui/pages/start-page.tsx`, `ai-tools-page.tsx`, `agent-detail-page.tsx`, `project-detail-page.tsx`, `health-page.tsx`, `iterations-page.tsx`

All pages follow the same pattern: import their loader, call `useLoaderContext(params)` to get `LoaderContext`, call `useLoader(loader, ctx)` to get data, render with Phase 1 primitives/patterns.

- [ ] **Step 1: Implement start-page.tsx**

```tsx
/**
 * start-page.tsx — Home dashboard page.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadStart } from "../loaders/start-loader.js";
import type { PageProps } from "../types.js";

function StartPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadStart, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const stats = [
		{ label: "Projects", value: data.projectCount },
		{ label: "Agents", value: data.agentCount },
		{ label: "Iteration", value: data.activeIteration ? `#${data.activeIteration.number}` : "None" },
		{ label: "Progress", value: data.activeIteration ? `${data.activeIteration.completion}%` : "—" },
	];

	const sections = [
		{
			title: "Active Iteration",
			content: data.activeIteration
				? React.createElement(Text, null, `#${data.activeIteration.number} ${data.activeIteration.name} — ${data.activeIteration.completion}% complete`)
				: React.createElement(Text, { dimColor: true }, "No active iteration"),
		},
		{
			title: "Agent Roster",
			content: data.agents.length > 0
				? React.createElement(React.Fragment, null, ...data.agents.map((a) =>
					React.createElement(Text, { key: a.name }, `  ${a.name} `, React.createElement(Badge, { text: a.agentType, color: a.agentType === "ai" ? "cyan" : "yellow" }), ` ${a.domain}`),
				))
				: React.createElement(Text, { dimColor: true }, "No agents configured"),
		},
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("start", StartPage);
```

- [ ] **Step 2: Implement ai-tools-page.tsx**

```tsx
/**
 * ai-tools-page.tsx — Agent list with detail panel.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { Section } from "../primitives/section.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadAiTools } from "../loaders/ai-tools-loader.js";
import type { AgentListItem } from "../loaders/ai-tools-loader.js";
import type { PageProps } from "../types.js";

function AiToolsPage({ params, navigate }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadAiTools, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (agent: AgentListItem, _i: number, sel: boolean) =>
		React.createElement(Text, { bold: sel },
			`${agent.name} `,
			React.createElement(Badge, { text: agent.agentType, color: agent.agentType === "ai" ? "cyan" : "yellow" }),
			agent.domain ? ` ${agent.domain}` : "",
		);

	const renderDetail = (agent: AgentListItem) =>
		React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, agent.name),
			React.createElement(Text, { dimColor: true }, agent.description || "No description"),
			agent.skills.length > 0 && React.createElement(Section, { title: "Skills" },
				...agent.skills.map((s) => React.createElement(Text, { key: s }, `  ${s}`)),
			),
		);

	return React.createElement(ListPage, {
		items: data.agents,
		renderItem,
		renderDetail,
		onSelect: (agent: AgentListItem) => navigate("agent-detail", { agentName: agent.name }),
		actions: [{ key: "Enter", label: "Detail" }],
	});
}

registerPage("ai-tools", AiToolsPage);
```

- [ ] **Step 3: Implement agent-detail-page.tsx**

```tsx
/**
 * agent-detail-page.tsx — Single agent deep view.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadAgentDetail } from "../loaders/agent-detail-loader.js";
import type { PageProps } from "../types.js";

function AgentDetailPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadAgentDetail, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");
	if (!data.found) return React.createElement(Text, { color: "yellow" }, `Agent "${data.name}" not found`);

	const stats = [
		{ label: "Type", value: data.agentType },
		{ label: "Domain", value: data.domain || "—" },
		{ label: "Skills", value: data.skills.length },
		{ label: "Tools", value: data.tools.length },
	];

	const sections = [
		data.description ? { title: "Description", content: React.createElement(Text, null, data.description) } : null,
		data.skills.length > 0 ? {
			title: "Skills",
			content: React.createElement(React.Fragment, null,
				...data.skills.map((s) => React.createElement(Text, { key: s.name }, `  ${s.name}`, s.level ? ` (${s.level})` : "")),
			),
			collapsible: true,
		} : null,
		data.tools.length > 0 ? {
			title: "Tools",
			content: React.createElement(React.Fragment, null,
				...data.tools.map((t) => React.createElement(Text, { key: t }, `  ${t}`)),
			),
			collapsible: true,
		} : null,
		data.roles.length > 0 ? {
			title: "Roles",
			content: React.createElement(React.Fragment, null,
				...data.roles.map((r) => React.createElement(Text, { key: r }, `  ${r}`)),
			),
		} : null,
		data.persona ? { title: "Persona", content: React.createElement(Text, null, data.persona) } : null,
	].filter(Boolean) as { title: string; content: React.ReactNode; collapsible?: boolean }[];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("agent-detail", AgentDetailPage);
```

- [ ] **Step 4: Implement project-detail-page.tsx**

```tsx
/**
 * project-detail-page.tsx — Project dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadProjectDetail } from "../loaders/project-detail-loader.js";
import type { PageProps } from "../types.js";

function ProjectDetailPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadProjectDetail, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const stats = [
		{ label: "Source Files", value: data.sourceFiles },
		{ label: "Test Files", value: data.testFiles },
	];

	const sections = [
		{ title: "Project", content: React.createElement(Text, null, `${data.name} — ${data.path}`) },
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("project-detail", ProjectDetailPage);
```

- [ ] **Step 5: Implement health-page.tsx**

```tsx
/**
 * health-page.tsx — Health dashboard.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadHealth } from "../loaders/health-loader.js";
import type { PageProps } from "../types.js";

function HealthPage({ params }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadHealth, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	if (!data.available) {
		return React.createElement(DashboardPage, {
			sections: [{ title: "Health", content: React.createElement(Text, { dimColor: true }, "No health reports found. Run 'flowti reports' to generate.") }],
		});
	}

	const stats = [
		{ label: "Tests", value: data.tests.total, color: data.tests.failed > 0 ? "red" : "green" },
		{ label: "Passed", value: data.tests.passed, color: "green" },
		{ label: "Failed", value: data.tests.failed, color: data.tests.failed > 0 ? "red" : "green" },
		{ label: "Coverage", value: `${data.coverage.lines.toFixed(1)}%`, color: data.coverage.lines >= 80 ? "green" : "yellow" },
	];

	const sections = [
		{
			title: "Coverage Breakdown",
			content: React.createElement(React.Fragment, null,
				React.createElement(Text, null, `  Lines:     ${data.coverage.lines.toFixed(1)}%`),
				React.createElement(Text, null, `  Branches:  ${data.coverage.branches.toFixed(1)}%`),
				React.createElement(Text, null, `  Functions: ${data.coverage.functions.toFixed(1)}%`),
			),
		},
	];

	return React.createElement(DashboardPage, { stats, sections });
}

registerPage("health", HealthPage);
```

- [ ] **Step 6: Implement iterations-page.tsx**

```tsx
/**
 * iterations-page.tsx — Iteration list with detail panel.
 */

import React from "react";
import { Text } from "ink";
import { registerPage } from "./page-registry.js";
import { ListPage } from "./list-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadIterations } from "../loaders/iterations-loader.js";
import type { IterationListItem } from "../loaders/iterations-loader.js";
import type { PageProps } from "../types.js";

const STATUS_COLORS: Record<string, string> = {
	"new": "gray",
	"planned": "blue",
	"ready": "cyan",
	"in-progress": "green",
	"in-review": "yellow",
	"done": "magenta",
	"cancelled": "red",
};

function IterationsPage({ params, navigate }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadIterations, ctx);

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const renderItem = (iter: IterationListItem, _i: number, sel: boolean) =>
		React.createElement(Text, { bold: sel },
			`#${iter.number} ${iter.name} `,
			React.createElement(Badge, { text: iter.status, color: STATUS_COLORS[iter.status] ?? "gray" }),
			iter.scopeTotal > 0 ? ` ${iter.scopeDone}/${iter.scopeTotal}` : "",
		);

	const renderDetail = (iter: IterationListItem) =>
		React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true, color: "cyan" }, `#${iter.number} ${iter.name}`),
			React.createElement(Text, null, `Status: ${iter.status}`),
			iter.goal && React.createElement(Text, { dimColor: true }, iter.goal),
			iter.startDate && React.createElement(Text, null, `${iter.startDate} → ${iter.endDate}`),
			iter.scopeTotal > 0 && React.createElement(Text, null, `Scope: ${iter.scopeDone}/${iter.scopeTotal} (${Math.round((iter.scopeDone / iter.scopeTotal) * 100)}%)`),
		);

	return React.createElement(ListPage, {
		items: data.iterations,
		renderItem,
		renderDetail,
		onSelect: (iter: IterationListItem) => navigate("iteration-detail", { number: String(iter.number) }),
		actions: [{ key: "Enter", label: "Detail" }],
	});
}

registerPage("iterations", IterationsPage);
```

- [ ] **Step 7: Verify type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/"
git commit -m "feat(tui): implement 6 high-traffic pages — start, agents, detail, project, health, iterations"
```

---

## Chunk 4: Tests + Section Map Fix + Final Verification

### Task 5: Write tests

**Files:**
- Create: `tests/tui/loaders/loaders.test.ts`
- Create: `tests/tui/pages/pages.test.ts`

- [ ] **Step 1: Create loader tests**

Create `tests/tui/loaders/loaders.test.ts` testing each loader with mock deps. Loaders are pure functions — test them directly without React rendering.

- [ ] **Step 2: Create page tests**

Create `tests/tui/pages/pages.test.ts` testing each page renders with mock TuiProvider context. Use ink-testing-library `render()` with TuiProvider wrapper.

- [ ] **Step 3: Fix section-map**

Update `src/tui/navigation/section-map.ts` to remove page IDs that don't exist in sitemap.json:
- Remove `agents`, `agents-run`, `roster-task` from agents section
- Remove `report-archive` from reports section
- Remove `event-config` from events section

- [ ] **Step 4: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npm test
```

- [ ] **Step 5: Verify build**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/tui/loaders/" "01 - Projects/Flowti CLI/tests/tui/pages/" "01 - Projects/Flowti CLI/src/tui/navigation/section-map.ts"
git commit -m "feat(tui): add Phase 2 tests + fix section map page references"
```

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `src/tui/context.tsx` — TuiContext provider with useTuiContext + useLoaderContext
- [ ] `src/tui/tui-entry.ts` — Infrastructure-aware boot with page module imports
- [ ] `src/tui/shell/content-area.tsx` — Wired to TuiContext
- [ ] 6 loaders in `src/tui/loaders/` — start, ai-tools, agent-detail, project-detail, health, iterations
- [ ] 6 pages in `src/tui/pages/` — start, ai-tools, agent-detail, project-detail, health, iterations
- [ ] `src/tui/navigation/section-map.ts` — Cleaned up page references
- [ ] `tests/tui/loaders/loaders.test.ts` — Loader tests
- [ ] `tests/tui/pages/pages.test.ts` — Page component tests
- [ ] `npm test` passes (tsc + eslint + vitest)
- [ ] `node configs/esbuild.config.mjs` builds cleanly
