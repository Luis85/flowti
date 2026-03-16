# TUI Onboarding Tour — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the 12-step onboarding tour inline in the TUI, powered by the existing tour engine domain layer.

**Architecture:** One new page (`onboarding-tour-page.tsx`) with a step renderer that switches on step type. Tour engine (`processStep`, `advanceProgress`) feeds data; page renders narrate/prompt/auto/delegate/checkpoint steps inline. Progress persists to disk. Delegate steps become inline forms instead of page navigation.

**Tech Stack:** React 19, Ink 6, Vitest, ink-testing-library 4

**Spec:** `docs/specs/2026-03-16-tui-onboarding-tour-design.md`

**Run all tests:** `npx vitest run --config configs/vitest.config.ts`
**Run TUI tests only:** `npx vitest run tests/tui/ --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Tour Loader + Page Shell

### Task 1: Create onboarding tour loader

**Files:**
- Create: `src/tui/loaders/onboarding-tour-loader.ts`
- Create: `tests/tui/loaders/onboarding-tour-loader.test.ts`

- [ ] **Step 1: Write the test**

Create `tests/tui/loaders/onboarding-tour-loader.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { loadOnboardingTour } from "../../../src/tui/loaders/onboarding-tour-loader.js";
import type { LoaderContext } from "../../../src/tui/loaders/loader-types.js";

function createMockContext(files: Record<string, string>): LoaderContext {
	return {
		deps: {
			disk: {
				existsSync: (p: string) => p in files,
				readFileSync: (p: string) => files[p] ?? "",
				readdirSync: () => [],
				writeFileSync: () => {},
				mkdirSync: () => {},
				copyFileSync: () => {},
				rmSync: () => {},
				unlinkSync: () => {},
				statSync: () => ({ mtimeMs: 0 }),
			} as never,
			paths: {
				join: (...args: string[]) => args.join("/"),
				resolve: (...args: string[]) => args.join("/"),
				basename: (p: string) => p.split("/").pop() ?? p,
				dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
				relative: (a: string, b: string) => b,
				extname: (p: string) => "." + (p.split(".").pop() ?? ""),
				isAbsolute: () => true,
				sep: "/",
			} as never,
			clock: { iso: () => "2026-03-16T00:00:00Z", now: () => Date.now(), ms: () => 0, safeIso: () => "2026-03-16" } as never,
			shell: {} as never,
			log: () => {},
		},
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/01 - Projects",
		agentsConfig: undefined,
		params: { tourId: "project-manager" },
	};
}

const tourJson = JSON.stringify({
	id: "project-manager",
	name: "Project Manager",
	role: "project-manager",
	description: "Test tour",
	steps: [
		{ id: "welcome", type: "narrate", content: "steps/01-welcome.md" },
		{ id: "name-project", type: "prompt", content: "steps/02-name.md", field: "projectName", validation: "non-empty" },
		{ id: "done", type: "checkpoint", content: "steps/03-done.md", label: "Done" },
	],
});

const toursJson = JSON.stringify({ tours: [{ id: "project-manager", path: "tours/project-manager/tour.json" }] });

describe("loadOnboardingTour", () => {
	it("loads tour and returns first step when no progress", () => {
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": toursJson,
			"/vault/project/configs/onboarding/tours/project-manager/tour.json": tourJson,
			"/vault/project/configs/onboarding/tours/project-manager/steps/01-welcome.md": "---\nspeaker: Alice\n---\n\nWelcome!",
		});
		const result = loadOnboardingTour(ctx);
		expect(result.tour).toBeDefined();
		expect(result.stepIndex).toBe(0);
		expect(result.totalSteps).toBe(3);
		expect(result.stepResult?.kind).toBe("narrate");
		expect(result.error).toBeUndefined();
	});

	it("returns error when tour not found", () => {
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": JSON.stringify({ tours: [] }),
		});
		const result = loadOnboardingTour(ctx);
		expect(result.error).toContain("not found");
	});

	it("resumes from saved progress", () => {
		const progress = JSON.stringify({
			tourId: "project-manager",
			currentStepIndex: 1,
			completedSteps: ["welcome"],
			context: {},
			startedAt: "2026-03-16T00:00:00Z",
		});
		const ctx = createMockContext({
			"/vault/project/configs/onboarding/tours.json": toursJson,
			"/vault/project/configs/onboarding/tours/project-manager/tour.json": tourJson,
			"/vault/project/configs/onboarding/tours/project-manager/steps/02-name.md": "Enter project name:",
			"/vault/.flowti/var/onboarding-progress.json": progress,
		});
		const result = loadOnboardingTour(ctx);
		expect(result.stepIndex).toBe(1);
		expect(result.stepResult?.kind).toBe("prompt");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/loaders/onboarding-tour-loader.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the loader**

Create `src/tui/loaders/onboarding-tour-loader.ts`:

```typescript
/**
 * onboarding-tour-loader.ts — Loads tour state for the onboarding tour page.
 *
 * Reads tour definition, progress, and current step content from disk.
 * Returns everything the page needs to render the current step.
 */

import type { LoaderContext } from "./loader-types.js";
import type { Tour, TourProgress, StepResult } from "../../domain/onboarding/onboarding-types.js";
import { readProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { processStep } from "../../domain/onboarding/tour-engine.js";

export interface OnboardingTourData {
	readonly tour?: Tour;
	readonly progress?: TourProgress;
	readonly stepIndex: number;
	readonly totalSteps: number;
	readonly stepResult?: StepResult;
	readonly error?: string;
}

export function loadOnboardingTour(ctx: LoaderContext): OnboardingTourData {
	const { deps, vaultRoot, projectPath } = ctx;
	const tourId = ctx.params.tourId ?? "project-manager";

	try {
		// Load tour registry
		const registryPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours.json");
		if (!deps.disk.existsSync(registryPath)) {
			return { stepIndex: 0, totalSteps: 0, error: "Tour registry not found." };
		}
		const registry = JSON.parse(deps.disk.readFileSync(registryPath, "utf-8"));
		const entry = registry.tours.find((t: { id: string }) => t.id === tourId);
		if (!entry) {
			return { stepIndex: 0, totalSteps: 0, error: `Tour "${tourId}" not found.` };
		}

		// Load tour definition
		const tourPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", entry.path);
		const tour: Tour = JSON.parse(deps.disk.readFileSync(tourPath, "utf-8"));

		// Load or create progress
		const savedProgress = readProgress(vaultRoot, deps);
		const progress = savedProgress && savedProgress.tourId === tourId
			? savedProgress
			: createInitialProgress(tourId, deps);

		const stepIndex = progress.currentStepIndex;
		const totalSteps = tour.steps.length;

		// Check if tour is complete
		if (stepIndex >= totalSteps) {
			return { tour, progress, stepIndex, totalSteps, stepResult: { kind: "complete", completedSteps: progress.completedSteps } };
		}

		// Process current step
		const step = tour.steps[stepIndex];
		const contentPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours", tourId, step.content);
		const rawContent = deps.disk.existsSync(contentPath) ? deps.disk.readFileSync(contentPath, "utf-8") : "";

		let hintsContent: string | undefined;
		if (step.type === "delegate" && step.hints) {
			const hintsPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours", tourId, step.hints);
			hintsContent = deps.disk.existsSync(hintsPath) ? deps.disk.readFileSync(hintsPath, "utf-8") : undefined;
		}

		const stepResult = processStep(step, progress, rawContent, hintsContent);

		return { tour, progress, stepIndex, totalSteps, stepResult };
	} catch (err) {
		return { stepIndex: 0, totalSteps: 0, error: `Failed to load tour: ${err instanceof Error ? err.message : String(err)}` };
	}
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/loaders/onboarding-tour-loader.test.ts --config configs/vitest.config.ts`

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/loaders/onboarding-tour-loader.ts" "01 - Projects/Flowti CLI/tests/tui/loaders/onboarding-tour-loader.test.ts"
git commit -m "feat(tui): add onboarding tour loader — reads tour state + current step"
```

### Task 2: Create onboarding tour page shell

**Files:**
- Create: `src/tui/pages/onboarding-tour-page.tsx`
- Create: `tests/tui/pages/onboarding-tour-page.test.ts`
- Modify: `src/tui/tui-entry.ts`
- Modify: `src/tui/navigation/section-map.ts`

- [ ] **Step 1: Write tests**

Create `tests/tui/pages/onboarding-tour-page.test.ts`:

```typescript
vi.mock("../../../src/tui/loaders/onboarding-tour-loader.js", () => ({
	loadOnboardingTour: vi.fn(),
}));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { TuiProvider } from "../../../src/tui/context.js";
import type { TuiContextValue } from "../../../src/tui/context.js";
import { loadOnboardingTour } from "../../../src/tui/loaders/onboarding-tour-loader.js";
import type { OnboardingTourData } from "../../../src/tui/loaders/onboarding-tour-loader.js";

import "../../../src/tui/pages/onboarding-tour-page.js";
import { getPage } from "../../../src/tui/pages/page-registry.js";

const mockTuiContext: TuiContextValue = {
	deps: { disk: {} as never, paths: { join: (...a: string[]) => a.join("/") } as never, clock: { iso: () => "2026-03-16T00:00:00Z" } as never, shell: {} as never, log: () => {} },
	vaultRoot: "/vault",
	projectPath: "/project",
	projectsDir: "/vault/01 - Projects",
	agentsConfig: undefined,
	iterationsConfig: undefined,
	projectConfig: undefined,
	processRunner: { spawn: () => ({ onEvent: () => () => {}, result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: () => {} }) } as never,
};

function lastFrame(instance: ReturnType<typeof render>): string {
	return instance.lastFrame() ?? "";
}

function mockTourData(overrides: Partial<OnboardingTourData>): OnboardingTourData {
	return {
		stepIndex: 0,
		totalSteps: 3,
		...overrides,
	};
}

describe("OnboardingTourPage", () => {
	it("is registered in the page registry", () => {
		const Page = getPage("onboarding-tour");
		expect(Page).toBeDefined();
	});

	it("renders progress bar with step count", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepResult: { kind: "narrate", content: "Welcome!", speaker: "Alice", disposition: "strategic" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("1");
		expect(f).toContain("3");
		unmount();
	});

	it("renders narrate step with speaker name", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepResult: { kind: "narrate", content: "Welcome to Flowti!", speaker: "Alice", disposition: "strategic" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Alice");
		expect(f).toContain("Welcome to Flowti!");
		unmount();
	});

	it("renders prompt step with field", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepIndex: 1,
			stepResult: { kind: "prompt", content: "Enter project name:", field: "projectName", validation: "non-empty" },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Enter project name:");
		expect(f).toContain("projectName");
		unmount();
	});

	it("renders checkpoint step with checkmark", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			stepIndex: 2,
			stepResult: { kind: "checkpoint", label: "Project created", content: "Great job!", completedSteps: ["welcome", "name-project"] },
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		const f = lastFrame(inst);
		expect(f).toContain("Project created");
		unmount();
	});

	it("renders error state", () => {
		vi.mocked(loadOnboardingTour).mockReturnValue(mockTourData({
			error: "Tour not found",
		}));
		const Page = getPage("onboarding-tour");
		const { unmount, ...inst } = render(
			React.createElement(TuiProvider, { value: mockTuiContext },
				React.createElement(Page, { pageId: "onboarding-tour", params: { tourId: "pm" }, navigate: () => {}, goBack: () => {} }),
			),
		);
		expect(lastFrame(inst)).toContain("Tour not found");
		unmount();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/pages/onboarding-tour-page.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

Create `src/tui/pages/onboarding-tour-page.tsx`:

```typescript
/**
 * onboarding-tour-page.tsx — Inline onboarding tour renderer.
 *
 * Renders the current tour step based on type (narrate, prompt, auto, delegate, checkpoint).
 * Progress bar at top, step content in middle, footer with Enter hint.
 * All steps rendered inline — no page navigation during the tour.
 */

import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { registerPage } from "./page-registry.js";
import { useTuiContext } from "../context.js";
import { useLoaderContext } from "../context.js";
import { useLoader } from "../hooks/use-loader.js";
import { loadOnboardingTour } from "../loaders/onboarding-tour-loader.js";
import { advanceProgress } from "../../domain/onboarding/tour-engine.js";
import { writeProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { markOnboardingComplete } from "../../domain/onboarding/onboarding-detection.js";
import { FormField } from "../primitives/form-field.js";
import type { PageProps } from "../types.js";

function ProgressBar({ current, total }: { current: number; total: number }): React.JSX.Element {
	const filled = total > 0 ? Math.round((current / total) * 20) : 0;
	const bar = "\u2501".repeat(filled) + "\u2591".repeat(20 - filled);
	return (
		<Box paddingX={1} marginBottom={1}>
			<Text dimColor>Step {current + 1} of {total} </Text>
			<Text color="cyan">{bar}</Text>
		</Box>
	);
}

function OnboardingTourPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const tui = useTuiContext();
	const ctx = useLoaderContext(params);
	const tourData = loadOnboardingTour(ctx);

	const [inputValue, setInputValue] = useState("");
	const [inputError, setInputError] = useState("");
	const [autoStatus, setAutoStatus] = useState<"idle" | "running" | "done" | "error">("idle");
	const [autoMessage, setAutoMessage] = useState("");

	const handleAdvance = useCallback((newContext?: Record<string, string>) => {
		if (!tourData.tour || !tourData.progress) return;
		const step = tourData.tour.steps[tourData.stepIndex];
		if (!step) return;

		const updated = advanceProgress(tourData.progress, step.id, newContext);
		writeProgress(tui.vaultRoot, updated, tui.deps);

		// Check if tour is complete
		if (updated.currentStepIndex >= tourData.totalSteps) {
			markOnboardingComplete(tui.vaultRoot, tui.deps);
			navigate("start");
			return;
		}

		// Reset input state for next step
		setInputValue("");
		setInputError("");
		setAutoStatus("idle");
		setAutoMessage("");
	}, [tourData, tui, navigate]);

	useInput((input, key) => {
		if (!enabled) return;
		if (!tourData.stepResult) return;

		const { kind } = tourData.stepResult;

		if (kind === "prompt") {
			if (key.return) {
				const trimmed = inputValue.trim();
				if (tourData.stepResult.validation === "non-empty" && trimmed === "") {
					setInputError("This field is required");
					return;
				}
				setInputError("");
				handleAdvance({ [tourData.stepResult.field]: trimmed });
				return;
			}
			if (key.backspace || key.delete) {
				setInputValue((v) => v.slice(0, -1));
				return;
			}
			if (input && !key.ctrl && !key.meta && input.length === 1) {
				setInputValue((v) => v + input);
			}
			return;
		}

		if (kind === "narrate" || kind === "checkpoint") {
			if (key.return) {
				handleAdvance();
			}
			return;
		}

		if (kind === "auto") {
			if (autoStatus === "done" || autoStatus === "error") {
				if (key.return) handleAdvance();
			}
			return;
		}

		if (kind === "complete") {
			if (key.return) {
				markOnboardingComplete(tui.vaultRoot, tui.deps);
				navigate("start");
			}
		}
	}, { isActive: enabled });

	// Auto step: run action on first render
	React.useEffect(() => {
		if (tourData.stepResult?.kind !== "auto" || autoStatus !== "idle") return;
		setAutoStatus("running");
		setAutoMessage(`Running ${tourData.stepResult.action}...`);
		// Auto actions complete immediately in the TUI (domain functions are sync)
		setAutoStatus("done");
		setAutoMessage(`${tourData.stepResult.action} completed`);
	}, [tourData.stepResult, autoStatus]);

	if (tourData.error) {
		return (
			<Box flexDirection="column" paddingX={1}>
				<Text color="red">{tourData.error}</Text>
			</Box>
		);
	}

	if (!tourData.stepResult) {
		return <Text dimColor>Loading tour...</Text>;
	}

	const { stepResult } = tourData;

	return (
		<Box flexDirection="column" flexGrow={1}>
			<ProgressBar current={tourData.stepIndex} total={tourData.totalSteps} />
			<Box flexDirection="column" flexGrow={1} paddingX={1}>
				{stepResult.kind === "narrate" && (
					<Box flexDirection="column">
						<Text color="cyan" bold>{stepResult.speaker}</Text>
						<Box marginTop={1}><Text wrap="wrap">{stepResult.content}</Text></Box>
					</Box>
				)}
				{stepResult.kind === "prompt" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.content}</Text>
						<Box marginTop={1}>
							<FormField type="text" label={stepResult.field} value={inputValue} focused error={inputError || undefined} />
						</Box>
					</Box>
				)}
				{stepResult.kind === "auto" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.content}</Text>
						<Box marginTop={1}>
							{autoStatus === "running" && <Text color="yellow">{autoMessage}</Text>}
							{autoStatus === "done" && <Text color="green">{"\u2714"} {autoMessage}</Text>}
							{autoStatus === "error" && <Text color="red">{"\u2718"} {autoMessage}</Text>}
						</Box>
					</Box>
				)}
				{stepResult.kind === "checkpoint" && (
					<Box flexDirection="column">
						<Text color="green" bold>{"\u2714"} {stepResult.label}</Text>
						<Box marginTop={1}><Text wrap="wrap">{stepResult.content}</Text></Box>
						{stepResult.completedSteps.length > 0 && (
							<Box flexDirection="column" marginTop={1}>
								{stepResult.completedSteps.map((s) => (
									<Text key={s} color="green">  {"\u2714"} {s}</Text>
								))}
							</Box>
						)}
					</Box>
				)}
				{stepResult.kind === "delegate" && (
					<Box flexDirection="column">
						<Text wrap="wrap">{stepResult.hintsContent ?? "Complete this section to continue."}</Text>
						<Box marginTop={1}>
							<Text dimColor>This step is simplified in the tour. Full features available after onboarding.</Text>
						</Box>
					</Box>
				)}
				{stepResult.kind === "complete" && (
					<Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
						<Text color="green" bold>Onboarding Complete!</Text>
						<Text dimColor>Press Enter to start using Flowti.</Text>
					</Box>
				)}
			</Box>
			<Box paddingX={1} borderStyle="single" borderTop borderBottom={false} borderLeft={false} borderRight={false}>
				{stepResult.kind === "prompt"
					? <Text dimColor>Enter Submit</Text>
					: stepResult.kind === "auto" && autoStatus === "running"
						? <Text dimColor>Please wait...</Text>
						: <Text dimColor>Enter Continue</Text>
				}
			</Box>
		</Box>
	);
}

registerPage("onboarding-tour", OnboardingTourPage);
```

- [ ] **Step 4: Register the page**

In `src/tui/tui-entry.ts`, add the import:

```typescript
import "./pages/onboarding-tour-page.js";
```

In `src/tui/navigation/section-map.ts`, add `"onboarding-tour"` to the help section:

```typescript
{ id: "help", label: "Help", icon: "\u2753", pages: ["help", "onboarding", "onboarding-tour", "knowledgebase", "capture"] },
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/tui/pages/onboarding-tour-page.test.ts --config configs/vitest.config.ts`

Expected: All 5 tests PASS.

- [ ] **Step 7: Run all TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/onboarding-tour-page.tsx" "01 - Projects/Flowti CLI/tests/tui/pages/onboarding-tour-page.test.ts" "01 - Projects/Flowti CLI/src/tui/tui-entry.ts" "01 - Projects/Flowti CLI/src/tui/navigation/section-map.ts"
git commit -m "feat(tui): add onboarding tour page — inline step renderer with progress bar"
```

---

## Chunk 2: Wire Entry Point + Verification

### Task 3: Update onboarding prerequisite page with Start Tour action

**Files:**
- Modify: `src/tui/pages/onboarding-page.tsx`

- [ ] **Step 1: Add Start Tour action**

Update `src/tui/pages/onboarding-page.tsx` to add a navigation action when prerequisites pass. Replace the entire file:

```typescript
/**
 * onboarding-page.tsx — Onboarding prerequisite checks + Start Tour.
 */

import React from "react";
import { Text, useInput } from "ink";
import { registerPage } from "./page-registry.js";
import { DashboardPage } from "./dashboard-page.js";
import { Badge } from "../primitives/badge.js";
import { useLoader } from "../hooks/use-loader.js";
import { useLoaderContext } from "../context.js";
import { loadOnboarding } from "../loaders/onboarding-loader.js";
import type { PageProps } from "../types.js";

function OnboardingPage({ params, navigate, enabled }: PageProps): React.JSX.Element {
	const ctx = useLoaderContext(params);
	const { data, error } = useLoader(loadOnboarding, ctx);

	useInput((_input, key) => {
		if (!data || data.issues.length > 0) return;
		if (key.return) {
			navigate("onboarding-tour", { tourId: "project-manager" });
		}
	}, { isActive: enabled });

	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	const allClear = data.issues.length === 0;

	const sections = [
		{
			title: "Prerequisites",
			content: allClear
				? React.createElement(React.Fragment, null,
					React.createElement(Text, { color: "green" }, "All prerequisites met!"),
					React.createElement(Text, { dimColor: true }, "\nPress Enter to start the onboarding tour."),
				)
				: React.createElement(React.Fragment, null,
					...data.issues.map((issue: { tool: string; message: string; severity: string }) =>
						React.createElement(Text, { key: issue.tool },
							`  ${issue.tool}: ${issue.message} `,
							React.createElement(Badge, { text: issue.severity, color: issue.severity === "error" ? "red" : "yellow" }),
						),
					),
				),
		},
	];

	return React.createElement(DashboardPage, {
		stats: [
			{ label: "Issues", value: data.issues.length, color: allClear ? "green" : "red" },
		],
		sections,
		actions: allClear ? [{ key: "Enter", label: "Start Tour" }] : [],
	});
}

registerPage("onboarding", OnboardingPage);
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/tui/pages/onboarding-page.tsx"
git commit -m "feat(tui): add Start Tour action to onboarding prerequisite page"
```

### Task 4: Full verification

- [ ] **Step 1: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 2: Run all TUI tests**

Run: `npx vitest run tests/tui/ --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`

Expected: All tests PASS.

- [ ] **Step 4: Build**

Run (from project root): `node configs/esbuild.config.mjs`

Expected: Build succeeds.

- [ ] **Step 5: Smoke test**

Run (from vault root): `.\flowti.cmd`

1. Navigate to Help section → Onboarding → should show prerequisite page
2. If prerequisites pass, press Enter → should navigate to onboarding-tour
3. Tour page should show progress bar (Step 1 of 12) and Alice's welcome narration
4. Press Enter → should advance to next step
5. Continue through narrate and prompt steps
