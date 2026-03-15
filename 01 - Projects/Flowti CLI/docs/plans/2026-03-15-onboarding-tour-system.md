# Onboarding Tour System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided first-run onboarding system where Alice (PM agent persona) walks new project managers through creating their first project and planning their first iteration.

**Architecture:** New `onboarding` domain with types, detection, tour engine, and progress store. Controller orchestrates content loading and action dispatch. Three new sitemap pages (onboarding, onboarding-tour, onboarding-checklist). Content files live in `configs/onboarding/`. Startup routing in `main.ts` checks detection triggers before choosing the initial page.

**Tech Stack:** TypeScript, Vitest, ESM with `.js` imports, zero runtime deps

**Spec:** `docs/specs/2026-03-15-onboarding-tour-system-design.md`

---

## File Map

### New Files — Domain

| File | Responsibility |
|------|---------------|
| `src/domain/onboarding/onboarding-types.ts` | All types: Tour, TourStep, TourProgress, OnboardingState, step result union, validation enum |
| `src/domain/onboarding/onboarding-detection.ts` | First-run detection: `shouldOnboard()` checks no-projects + no-flag-file triggers |
| `src/domain/onboarding/tour-engine.ts` | Pure tour state machine: `advanceStep()`, `resolveTemplate()`, step result dispatch |
| `src/domain/onboarding/onboarding-store.ts` | Progress persistence: read/write/reset progress + flag file management |

### New Files — Controller

| File | Responsibility |
|------|---------------|
| `src/controller/onboarding.controller.ts` | Non-interactive commands: `onboarding:status`, `onboarding:start`, `onboarding:restart`, `onboarding:skip` |

### New Files — UI

| File | Responsibility |
|------|---------------|
| `src/ui/displays/onboarding-display.ts` | Renderers: Alice narration, checkpoint checklist, hint banner, tour selection |
| `src/ui/handlers/onboarding-handlers.ts` | Sitemap handlers: views, actions, conditions, beforeRender for onboarding pages |

### New Files — Content

| File | Responsibility |
|------|---------------|
| `configs/onboarding/welcome.md` | First-run welcome text |
| `configs/onboarding/tours.json` | Tour registry |
| `configs/onboarding/tours/project-manager/tour.json` | PM tour step sequence |
| `configs/onboarding/tours/project-manager/steps/*.md` | 13 step content files |
| `configs/onboarding/tours/project-manager/hints/iteration-planning.md` | Delegation hints |

### New Files — Tests

| File | Responsibility |
|------|---------------|
| `tests/domain/onboarding/onboarding-detection.test.ts` | Detection trigger tests |
| `tests/domain/onboarding/tour-engine.test.ts` | Tour engine state machine tests |
| `tests/domain/onboarding/onboarding-store.test.ts` | Progress store tests |
| `tests/controller/onboarding.controller.test.ts` | Controller command tests |
| `tests/ui/displays/onboarding-display.test.ts` | Renderer tests |

### Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/deps.ts` | Add `OnboardingDeps` ISP subset |
| `src/main.ts` | Add detection check before `router.run()`, register onboarding domain |
| `src/ui/handlers/register-handlers.ts` | Import and call `registerOnboardingHandlers()` |
| `configs/sitemap.json` | Add 3 onboarding pages |

---

## Task 1: Domain Types

**Files:**
- Create: `src/domain/onboarding/onboarding-types.ts`
- Modify: `src/infrastructure/deps.ts`

No tests needed — pure type definitions.

- [ ] **Step 1: Create the types file**

```typescript
// src/domain/onboarding/onboarding-types.ts
import type { CliDeps } from "../../infrastructure/deps.js";

// --- Deps (re-export from deps.ts for convenience) ---

export type { OnboardingDeps } from "../../infrastructure/deps.js";
export type OnboardingStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;
export type OnboardingDetectionDeps = Pick<CliDeps, "disk" | "paths">;

// --- Validation ---

export type PromptValidation = "non-empty" | "slug";

// --- Tour Definition (loaded from tour.json) ---

export type StepType = "narrate" | "prompt" | "delegate" | "auto" | "checkpoint";

export interface TourStepBase {
	readonly id: string;
	readonly type: StepType;
	readonly content: string; // relative path to markdown file
}

export interface NarrateStep extends TourStepBase {
	readonly type: "narrate";
}

export interface PromptStep extends TourStepBase {
	readonly type: "prompt";
	readonly field: string;
	readonly validation?: PromptValidation;
}

export interface DelegateStep extends TourStepBase {
	readonly type: "delegate";
	readonly target: string; // sitemap page id
	readonly hints?: string; // relative path to hints markdown
}

export interface AutoStep extends TourStepBase {
	readonly type: "auto";
	readonly action: string; // auto-action id (e.g. "project:scaffold")
}

export interface CheckpointStep extends TourStepBase {
	readonly type: "checkpoint";
	readonly label: string; // checklist label (e.g. "Project created")
}

export type TourStep = NarrateStep | PromptStep | DelegateStep | AutoStep | CheckpointStep;

export interface Tour {
	readonly id: string;
	readonly name: string;
	readonly role: string;
	readonly description: string;
	readonly steps: readonly TourStep[];
}

export interface TourRegistryEntry {
	readonly id: string;
	readonly path: string;
}

export interface TourRegistry {
	readonly tours: readonly TourRegistryEntry[];
}

// --- Tour Progress (persisted) ---

export interface TourProgress {
	readonly tourId: string;
	readonly currentStepIndex: number;
	readonly completedSteps: readonly string[];
	readonly context: Readonly<Record<string, string>>; // accumulated PM inputs
	readonly startedAt: string; // ISO 8601
}

// --- Step Results (returned by tour engine) ---

export interface NarrateResult {
	readonly kind: "narrate";
	readonly content: string; // resolved markdown content
	readonly speaker: string;
	readonly disposition: string;
}

export interface PromptResult {
	readonly kind: "prompt";
	readonly content: string;
	readonly field: string;
	readonly validation?: PromptValidation;
}

export interface DelegateResult {
	readonly kind: "delegate";
	readonly target: string;
	readonly tourId: string;
	readonly stepId: string;
	readonly hintsContent?: string;
}

export interface AutoResult {
	readonly kind: "auto";
	readonly action: string;
	readonly content: string;
	readonly context: Readonly<Record<string, string>>;
}

export interface CheckpointResult {
	readonly kind: "checkpoint";
	readonly label: string;
	readonly content: string;
	readonly completedSteps: readonly string[];
}

export interface TourCompleteResult {
	readonly kind: "complete";
	readonly completedSteps: readonly string[];
}

export type StepResult =
	| NarrateResult
	| PromptResult
	| DelegateResult
	| AutoResult
	| CheckpointResult
	| TourCompleteResult;

// --- Content Frontmatter ---

export interface StepFrontmatter {
	readonly speaker?: string;
	readonly disposition?: string;
}

// --- Onboarding State ---

export interface OnboardingStatus {
	readonly isComplete: boolean;
	readonly activeTour?: TourProgress;
}
```

- [ ] **Step 2: Add OnboardingDeps to deps.ts**

In `src/infrastructure/deps.ts`, add after the existing ISP subsets:

```typescript
export type OnboardingDeps = Pick<CliDeps, "disk" | "paths" | "input" | "clock" | "log">;
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add src/domain/onboarding/onboarding-types.ts src/infrastructure/deps.ts
git commit -m "feat(onboarding): add tour system types and OnboardingDeps"
```

---

## Task 2: First-Run Detection

**Files:**
- Create: `src/domain/onboarding/onboarding-detection.ts`
- Test: `tests/domain/onboarding/onboarding-detection.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/onboarding/onboarding-detection.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../../../src/domain/onboarding/onboarding-detection.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
	readdirSync: vi.fn(() => []),
	mkdirSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const deps = { disk: mockDisk as any, paths: mockPaths as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("shouldOnboard", () => {
	it("returns true when no projects and no flag file", () => {
		mockDisk.existsSync.mockReturnValue(false);
		mockDisk.readdirSync.mockReturnValue([]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(true);
	});

	it("returns false when flag file exists", () => {
		mockDisk.existsSync.mockImplementation((p: string) =>
			p.includes("onboarding-complete"),
		);
		mockDisk.readdirSync.mockReturnValue([]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns false when projects exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		mockDisk.readdirSync.mockReturnValue([
			{ name: "my-project", isDirectory: () => true },
		]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns false when both flag and projects exist", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue([
			{ name: "my-project", isDirectory: () => true },
		]);
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(false);
	});

	it("returns true when projects directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		mockDisk.readdirSync.mockImplementation(() => {
			throw new Error("ENOENT");
		});
		expect(shouldOnboard("/vault", "/vault/projects", deps)).toBe(true);
	});
});

describe("markOnboardingComplete", () => {
	it("writes the flag file", () => {
		markOnboardingComplete("/vault", deps);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/vault/.flowti/onboarding-complete",
			expect.any(String),
			"utf-8",
		);
	});

	it("creates .flowti directory if needed", () => {
		markOnboardingComplete("/vault", deps);
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.flowti",
			{ recursive: true },
		);
	});
});

describe("resetOnboarding", () => {
	it("removes the flag file if it exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		resetOnboarding("/vault", deps);
		expect(mockDisk.unlinkSync).toHaveBeenCalledWith(
			"/vault/.flowti/onboarding-complete",
		);
	});

	it("does nothing if flag file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		resetOnboarding("/vault", deps);
		expect(mockDisk.unlinkSync).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/onboarding/onboarding-detection.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/onboarding/onboarding-detection.ts
import type { OnboardingDetectionDeps } from "./onboarding-types.js";

const FLAG_FILE = "onboarding-complete";
const FLOWTI_DIR = ".flowti";

export function shouldOnboard(
	vaultRoot: string,
	projectsDir: string,
	deps: OnboardingDetectionDeps,
): boolean {
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	if (deps.disk.existsSync(flagPath)) return false;

	try {
		const entries = deps.disk.readdirSync(projectsDir, { withFileTypes: true });
		const projects = entries.filter((e: { isDirectory: () => boolean }) => e.isDirectory());
		return projects.length === 0;
	} catch {
		return true; // directory doesn't exist = no projects
	}
}

export function markOnboardingComplete(
	vaultRoot: string,
	deps: OnboardingDetectionDeps,
): void {
	const dir = deps.paths.join(vaultRoot, FLOWTI_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	deps.disk.writeFileSync(flagPath, new Date().toISOString(), "utf-8");
}

export function resetOnboarding(
	vaultRoot: string,
	deps: OnboardingDetectionDeps,
): void {
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	if (deps.disk.existsSync(flagPath)) {
		deps.disk.unlinkSync(flagPath);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/onboarding/onboarding-detection.test.ts --config configs/vitest.config.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/domain/onboarding/onboarding-detection.ts tests/domain/onboarding/onboarding-detection.test.ts
git commit -m "feat(onboarding): add first-run detection with dual triggers"
```

---

## Task 3: Progress Store

**Files:**
- Create: `src/domain/onboarding/onboarding-store.ts`
- Test: `tests/domain/onboarding/onboarding-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/onboarding/onboarding-store.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import {
	readProgress,
	writeProgress,
	resetProgress,
	createInitialProgress,
} from "../../../src/domain/onboarding/onboarding-store.js";

import type { TourProgress } from "../../../src/domain/onboarding/onboarding-types.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
	mkdirSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const mockClock = {
	iso: () => "2026-03-15T10:00:00.000Z",
};

const deps = { disk: mockDisk as any, paths: mockPaths as any, clock: mockClock as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createInitialProgress", () => {
	it("creates progress at step 0 with empty context", () => {
		const progress = createInitialProgress("project-manager", deps);
		expect(progress).toEqual({
			tourId: "project-manager",
			currentStepIndex: 0,
			completedSteps: [],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		});
	});
});

describe("readProgress", () => {
	it("returns null when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(readProgress("/vault", deps)).toBeNull();
	});

	it("returns parsed progress when file exists", () => {
		const stored: TourProgress = {
			tourId: "project-manager",
			currentStepIndex: 3,
			completedSteps: ["welcome", "tour-select", "pm-intro"],
			context: { projectName: "My Project" },
			startedAt: "2026-03-15T10:00:00.000Z",
		};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(JSON.stringify(stored));
		const result = readProgress("/vault", deps);
		expect(result).toEqual(stored);
	});
});

describe("writeProgress", () => {
	it("writes progress to the correct path", () => {
		const progress: TourProgress = {
			tourId: "project-manager",
			currentStepIndex: 2,
			completedSteps: ["welcome", "tour-select"],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		};
		writeProgress("/vault", progress, deps);
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith(
			"/vault/.flowti/var",
			{ recursive: true },
		);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/vault/.flowti/var/onboarding-progress.json",
			JSON.stringify(progress, null, "\t"),
			"utf-8",
		);
	});
});

describe("resetProgress", () => {
	it("removes progress file if it exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		resetProgress("/vault", deps);
		expect(mockDisk.unlinkSync).toHaveBeenCalledWith(
			"/vault/.flowti/var/onboarding-progress.json",
		);
	});

	it("does nothing if progress file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		resetProgress("/vault", deps);
		expect(mockDisk.unlinkSync).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/onboarding/onboarding-store.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/onboarding/onboarding-store.ts
import type { OnboardingStoreDeps, TourProgress } from "./onboarding-types.js";

const PROGRESS_FILE = "onboarding-progress.json";
const VAR_DIR = ".flowti/var";

export function createInitialProgress(
	tourId: string,
	deps: Pick<OnboardingStoreDeps, "clock">,
): TourProgress {
	return {
		tourId,
		currentStepIndex: 0,
		completedSteps: [],
		context: {},
		startedAt: deps.clock.iso(),
	};
}

export function readProgress(
	vaultRoot: string,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): TourProgress | null {
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	if (!deps.disk.existsSync(filePath)) return null;
	const content = deps.disk.readFileSync(filePath, "utf-8");
	return JSON.parse(content) as TourProgress;
}

export function writeProgress(
	vaultRoot: string,
	progress: TourProgress,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): void {
	const dir = deps.paths.join(vaultRoot, VAR_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	deps.disk.writeFileSync(filePath, JSON.stringify(progress, null, "\t"), "utf-8");
}

export function resetProgress(
	vaultRoot: string,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): void {
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	if (deps.disk.existsSync(filePath)) {
		deps.disk.unlinkSync(filePath);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/onboarding/onboarding-store.test.ts --config configs/vitest.config.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/onboarding/onboarding-store.ts tests/domain/onboarding/onboarding-store.test.ts
git commit -m "feat(onboarding): add progress store with persistence and reset"
```

---

## Task 4: Tour Engine

**Files:**
- Create: `src/domain/onboarding/tour-engine.ts`
- Test: `tests/domain/onboarding/tour-engine.test.ts`

This is the core domain logic — pure functions, no I/O.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/domain/onboarding/tour-engine.test.ts
import { describe, it, expect } from "vitest";

import {
	resolveTemplate,
	processStep,
	advanceProgress,
	parseStepFrontmatter,
} from "../../../src/domain/onboarding/tour-engine.js";

import type { Tour, TourProgress, NarrateStep, PromptStep, DelegateStep, AutoStep, CheckpointStep } from "../../../src/domain/onboarding/onboarding-types.js";

const makeTour = (steps: Tour["steps"]): Tour => ({
	id: "test-tour",
	name: "Test Tour",
	role: "tester",
	description: "A test tour",
	steps,
});

const makeProgress = (overrides?: Partial<TourProgress>): TourProgress => ({
	tourId: "test-tour",
	currentStepIndex: 0,
	completedSteps: [],
	context: {},
	startedAt: "2026-03-15T10:00:00.000Z",
	...overrides,
});

describe("resolveTemplate", () => {
	it("replaces {{token}} placeholders with context values", () => {
		const result = resolveTemplate(
			"Hello, **{{projectName}}**!",
			{ projectName: "Acme" },
		);
		expect(result).toBe("Hello, **Acme**!");
	});

	it("replaces multiple tokens", () => {
		const result = resolveTemplate(
			"{{projectName}} runs for {{durationDays}} days",
			{ projectName: "Acme", durationDays: "14" },
		);
		expect(result).toBe("Acme runs for 14 days");
	});

	it("leaves unknown tokens as-is", () => {
		const result = resolveTemplate("Hello, {{unknown}}!", {});
		expect(result).toBe("Hello, {{unknown}}!");
	});

	it("handles content with no tokens", () => {
		const result = resolveTemplate("No tokens here.", { foo: "bar" });
		expect(result).toBe("No tokens here.");
	});
});

describe("parseStepFrontmatter", () => {
	it("parses speaker and disposition from frontmatter", () => {
		const content = "---\nspeaker: Alice\ndisposition: strategic\n---\n\nHello!";
		const result = parseStepFrontmatter(content);
		expect(result.frontmatter).toEqual({ speaker: "Alice", disposition: "strategic" });
		expect(result.body).toBe("Hello!");
	});

	it("returns defaults when no frontmatter", () => {
		const content = "Just a body.";
		const result = parseStepFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("Just a body.");
	});
});

describe("processStep", () => {
	it("returns NarrateResult for narrate steps", () => {
		const step: NarrateStep = { id: "welcome", type: "narrate", content: "steps/01.md" };
		const progress = makeProgress();
		const rawContent = "---\nspeaker: Alice\ndisposition: strategic\n---\n\nWelcome!";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("narrate");
		if (result.kind === "narrate") {
			expect(result.content).toBe("Welcome!");
			expect(result.speaker).toBe("Alice");
			expect(result.disposition).toBe("strategic");
		}
	});

	it("returns PromptResult for prompt steps", () => {
		const step: PromptStep = {
			id: "name", type: "prompt", content: "steps/02.md",
			field: "projectName", validation: "non-empty",
		};
		const progress = makeProgress();
		const rawContent = "What is your project name?";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("prompt");
		if (result.kind === "prompt") {
			expect(result.field).toBe("projectName");
			expect(result.validation).toBe("non-empty");
		}
	});

	it("returns DelegateResult for delegate steps", () => {
		const step: DelegateStep = {
			id: "scope", type: "delegate", content: "steps/10.md",
			target: "iteration-planning", hints: "hints/ip.md",
		};
		const progress = makeProgress({ tourId: "pm" });
		const rawContent = "Add your scope items.";
		const hintsContent = "Tip: keep items small.";
		const result = processStep(step, progress, rawContent, hintsContent);
		expect(result.kind).toBe("delegate");
		if (result.kind === "delegate") {
			expect(result.target).toBe("iteration-planning");
			expect(result.tourId).toBe("pm");
			expect(result.stepId).toBe("scope");
			expect(result.hintsContent).toBe("Tip: keep items small.");
		}
	});

	it("returns AutoResult for auto steps", () => {
		const step: AutoStep = {
			id: "scaffold", type: "auto", content: "steps/05.md",
			action: "project:scaffold",
		};
		const progress = makeProgress({ context: { projectName: "Acme" } });
		const rawContent = "Creating **{{projectName}}**...";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("auto");
		if (result.kind === "auto") {
			expect(result.action).toBe("project:scaffold");
			expect(result.content).toBe("Creating **Acme**...");
		}
	});

	it("returns CheckpointResult for checkpoint steps", () => {
		const step: CheckpointStep = {
			id: "done", type: "checkpoint", content: "steps/06.md",
			label: "Project created",
		};
		const progress = makeProgress({ completedSteps: ["welcome"] });
		const rawContent = "Project created!";
		const result = processStep(step, progress, rawContent);
		expect(result.kind).toBe("checkpoint");
		if (result.kind === "checkpoint") {
			expect(result.label).toBe("Project created");
			expect(result.completedSteps).toContain("welcome");
			expect(result.completedSteps).toContain("done");
		}
	});
});

describe("advanceProgress", () => {
	it("increments step index", () => {
		const progress = makeProgress({ currentStepIndex: 0 });
		const result = advanceProgress(progress, "welcome");
		expect(result.currentStepIndex).toBe(1);
		expect(result.completedSteps).toContain("welcome");
	});

	it("adds context values from prompt", () => {
		const progress = makeProgress({ currentStepIndex: 1 });
		const result = advanceProgress(progress, "name", { projectName: "Acme" });
		expect(result.context.projectName).toBe("Acme");
	});

	it("preserves existing context", () => {
		const progress = makeProgress({
			currentStepIndex: 2,
			context: { projectName: "Acme" },
		});
		const result = advanceProgress(progress, "goal", { iterationGoal: "Ship MVP" });
		expect(result.context.projectName).toBe("Acme");
		expect(result.context.iterationGoal).toBe("Ship MVP");
	});

	it("returns complete result when past last step", () => {
		const tour = makeTour([
			{ id: "only", type: "narrate", content: "steps/01.md" },
		]);
		const progress = makeProgress({ currentStepIndex: 0 });
		const advanced = advanceProgress(progress, "only");
		expect(advanced.currentStepIndex).toBe(1);
		// Caller checks currentStepIndex >= tour.steps.length to detect completion
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/domain/onboarding/tour-engine.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/domain/onboarding/tour-engine.ts
import type {
	TourStep,
	TourProgress,
	StepResult,
	StepFrontmatter,
	NarrateStep,
	PromptStep,
	DelegateStep,
	AutoStep,
	CheckpointStep,
} from "./onboarding-types.js";

export function resolveTemplate(
	content: string,
	context: Readonly<Record<string, string>>,
): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		return key in context ? context[key] : match;
	});
}

export function parseStepFrontmatter(
	raw: string,
): { frontmatter: Partial<StepFrontmatter>; body: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: raw };

	const fm: Partial<StepFrontmatter> = {};
	for (const line of match[1].split("\n")) {
		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (kv) {
			const key = kv[1] as keyof StepFrontmatter;
			if (key === "speaker" || key === "disposition") {
				(fm as Record<string, string>)[key] = kv[2];
			}
		}
	}
	return { frontmatter: fm, body: match[2] };
}

function processNarrate(step: NarrateStep, progress: TourProgress, rawContent: string): StepResult {
	const { frontmatter, body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "narrate",
		content,
		speaker: frontmatter.speaker ?? "Alice",
		disposition: frontmatter.disposition ?? "strategic",
	};
}

function processPrompt(step: PromptStep, _progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	return {
		kind: "prompt",
		content: body,
		field: step.field,
		validation: step.validation,
	};
}

function processDelegate(
	step: DelegateStep,
	progress: TourProgress,
	rawContent: string,
	hintsContent?: string,
): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	return {
		kind: "delegate",
		target: step.target,
		tourId: progress.tourId,
		stepId: step.id,
		hintsContent: hintsContent ? resolveTemplate(hintsContent, progress.context) : undefined,
	};
}

function processAuto(step: AutoStep, progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "auto",
		action: step.action,
		content,
		context: progress.context,
	};
}

function processCheckpoint(step: CheckpointStep, progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "checkpoint",
		label: step.label,
		content,
		completedSteps: [...progress.completedSteps, step.id],
	};
}

export function processStep(
	step: TourStep,
	progress: TourProgress,
	rawContent: string,
	hintsContent?: string,
): StepResult {
	switch (step.type) {
		case "narrate": return processNarrate(step, progress, rawContent);
		case "prompt": return processPrompt(step, progress, rawContent);
		case "delegate": return processDelegate(step, progress, rawContent, hintsContent);
		case "auto": return processAuto(step, progress, rawContent);
		case "checkpoint": return processCheckpoint(step, progress, rawContent);
	}
}

export function advanceProgress(
	progress: TourProgress,
	stepId: string,
	newContext?: Readonly<Record<string, string>>,
): TourProgress {
	return {
		...progress,
		currentStepIndex: progress.currentStepIndex + 1,
		completedSteps: [...progress.completedSteps, stepId],
		context: { ...progress.context, ...newContext },
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/domain/onboarding/tour-engine.test.ts --config configs/vitest.config.ts`
Expected: PASS (13 tests)

- [ ] **Step 5: Commit**

```bash
git add src/domain/onboarding/tour-engine.ts tests/domain/onboarding/tour-engine.test.ts
git commit -m "feat(onboarding): add tour engine with template resolution and step processing"
```

---

## Task 5: Onboarding Display

**Files:**
- Create: `src/ui/displays/onboarding-display.ts`
- Test: `tests/ui/displays/onboarding-display.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/ui/displays/onboarding-display.test.ts
import { describe, it, expect, vi } from "vitest";

import {
	renderNarration,
	renderChecklist,
	renderHintBanner,
	renderTourSelection,
} from "../../../src/ui/displays/onboarding-display.js";

describe("renderNarration", () => {
	it("renders speaker name and content", () => {
		const lines: string[] = [];
		const log = (msg?: string) => lines.push(msg ?? "");
		renderNarration({ speaker: "Alice", disposition: "strategic", content: "Hello!" }, log);
		const output = lines.join("\n");
		expect(output).toContain("Alice");
		expect(output).toContain("Hello!");
	});
});

describe("renderChecklist", () => {
	it("renders completed steps with checkmarks", () => {
		const lines: string[] = [];
		const log = (msg?: string) => lines.push(msg ?? "");
		renderChecklist(
			[
				{ id: "step1", label: "Project created", completed: true },
				{ id: "step2", label: "Iteration planned", completed: false },
			],
			log,
		);
		const output = lines.join("\n");
		expect(output).toContain("Project created");
		expect(output).toContain("Iteration planned");
	});
});

describe("renderHintBanner", () => {
	it("renders the onboarding context banner", () => {
		const lines: string[] = [];
		const log = (msg?: string) => lines.push(msg ?? "");
		renderHintBanner("PM tour", log);
		const output = lines.join("\n");
		expect(output).toContain("PM tour");
		expect(output).toContain("b");
	});
});

describe("renderTourSelection", () => {
	it("renders available tours", () => {
		const lines: string[] = [];
		const log = (msg?: string) => lines.push(msg ?? "");
		renderTourSelection(
			[{ id: "project-manager", name: "Project Manager", description: "Set up your first project" }],
			log,
		);
		const output = lines.join("\n");
		expect(output).toContain("Project Manager");
		expect(output).toContain("Set up your first project");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/ui/displays/onboarding-display.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/ui/displays/onboarding-display.ts
import { RESET, DIM, BOLD, CYAN, GREEN, YELLOW } from "../../infrastructure/ui.js";

export interface NarrationData {
	readonly speaker: string;
	readonly disposition: string;
	readonly content: string;
}

export interface ChecklistItem {
	readonly id: string;
	readonly label: string;
	readonly completed: boolean;
}

export interface TourOption {
	readonly id: string;
	readonly name: string;
	readonly description: string;
}

export function renderNarration(data: NarrationData, log: (msg?: string) => void): void {
	log();
	log(`  ${CYAN}${BOLD}${data.speaker}${RESET}${DIM} (${data.disposition})${RESET}`);
	log();
	for (const line of data.content.split("\n")) {
		log(`  ${line}`);
	}
	log();
}

export function renderChecklist(items: readonly ChecklistItem[], log: (msg?: string) => void): void {
	log();
	log(`  ${BOLD}Onboarding Progress${RESET}`);
	log();
	for (const item of items) {
		const mark = item.completed ? `${GREEN}[x]${RESET}` : `${DIM}[ ]${RESET}`;
		const label = item.completed ? `${GREEN}${item.label}${RESET}` : item.label;
		log(`  ${mark} ${label}`);
	}
	log();
}

export function renderHintBanner(tourName: string, log: (msg?: string) => void): void {
	log(`  ${YELLOW}${DIM}You're in the ${tourName} — press ${BOLD}b${RESET}${YELLOW}${DIM} when done to continue${RESET}`);
}

export function renderTourSelection(tours: readonly TourOption[], log: (msg?: string) => void): void {
	log();
	log(`  ${BOLD}Available Tours${RESET}`);
	log();
	for (let i = 0; i < tours.length; i++) {
		log(`  ${BOLD}${i + 1}${RESET}  ${tours[i].name}`);
		log(`     ${DIM}${tours[i].description}${RESET}`);
	}
	log();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/ui/displays/onboarding-display.test.ts --config configs/vitest.config.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/ui/displays/onboarding-display.ts tests/ui/displays/onboarding-display.test.ts
git commit -m "feat(onboarding): add display renderers for Alice narration, checklist, hints"
```

---

## Task 6: Onboarding Controller

**Files:**
- Create: `src/controller/onboarding.controller.ts`
- Test: `tests/controller/onboarding.controller.test.ts`

Non-interactive commands: `onboarding:status`, `onboarding:start`, `onboarding:restart`, `onboarding:skip`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/controller/onboarding.controller.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	PROJECTS_DIR: "/vault/projects",
}));
vi.mock("../../src/domain/onboarding/onboarding-detection.js", () => ({
	shouldOnboard: vi.fn(() => true),
	markOnboardingComplete: vi.fn(),
	resetOnboarding: vi.fn(),
}));
vi.mock("../../src/domain/onboarding/onboarding-store.js", () => ({
	readProgress: vi.fn(() => null),
	resetProgress: vi.fn(),
}));

import { commands } from "../../src/controller/onboarding.controller.js";
import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../../src/domain/onboarding/onboarding-detection.js";
import { readProgress, resetProgress } from "../../src/domain/onboarding/onboarding-store.js";

const mockLog = vi.fn();
const mockDeps = {
	disk: { existsSync: vi.fn() },
	paths: { join: (...args: string[]) => args.join("/") },
	clock: { iso: () => "2026-03-15T10:00:00.000Z" },
	log: mockLog,
};

const makeReq = (command: string, flags: Record<string, unknown> = {}) => ({
	command,
	flags,
	rawArgs: [],
	deps: mockDeps,
	project: undefined,
	format: undefined,
});

beforeEach(() => {
	vi.clearAllMocks();
});

describe("onboarding:status", () => {
	it("reports not started when no progress and should onboard", async () => {
		const handler = commands["onboarding:status"];
		const result = await handler(makeReq("onboarding:status"));
		expect(result).toBeDefined();
		expect(shouldOnboard).toHaveBeenCalledWith("/vault", "/vault/projects", mockDeps);
		expect(readProgress).toHaveBeenCalledWith("/vault", mockDeps);
	});

	it("reports complete when not should onboard and no progress", async () => {
		vi.mocked(shouldOnboard).mockReturnValue(false);
		const handler = commands["onboarding:status"];
		await handler(makeReq("onboarding:status"));
		// Renderer is called — status is "complete"
		expect(shouldOnboard).toHaveBeenCalled();
	});
});

describe("onboarding:start", () => {
	it("reports interactive mode needed when no progress", async () => {
		const handler = commands["onboarding:start"];
		const result = await handler(makeReq("onboarding:start"));
		expect(result).toBeDefined();
	});

	it("reports resume info when progress exists", async () => {
		vi.mocked(readProgress).mockReturnValue({
			tourId: "project-manager",
			currentStepIndex: 3,
			completedSteps: ["welcome", "tour-select", "pm-intro"],
			context: {},
			startedAt: "2026-03-15T10:00:00.000Z",
		});
		const handler = commands["onboarding:start"];
		await handler(makeReq("onboarding:start"));
		expect(readProgress).toHaveBeenCalledWith("/vault", mockDeps);
	});
});

describe("onboarding:skip", () => {
	it("marks onboarding as complete", async () => {
		const handler = commands["onboarding:skip"];
		await handler(makeReq("onboarding:skip"));
		expect(markOnboardingComplete).toHaveBeenCalledWith("/vault", mockDeps);
	});
});

describe("onboarding:restart", () => {
	it("resets both flag and progress", async () => {
		const handler = commands["onboarding:restart"];
		await handler(makeReq("onboarding:restart"));
		expect(resetOnboarding).toHaveBeenCalledWith("/vault", mockDeps);
		expect(resetProgress).toHaveBeenCalledWith("/vault", mockDeps);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/controller/onboarding.controller.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/controller/onboarding.controller.ts
import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { VAULT_ROOT, PROJECTS_DIR } from "../infrastructure/config.js";
import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../domain/onboarding/onboarding-detection.js";
import { readProgress, resetProgress } from "../domain/onboarding/onboarding-store.js";
import type { OnboardingStatus } from "../domain/onboarding/onboarding-types.js";

const actions: Record<string, ControllerAction> = {
	"onboarding:status": (req) => {
		const onboard = shouldOnboard(VAULT_ROOT, PROJECTS_DIR, req.deps);
		const progress = readProgress(VAULT_ROOT, req.deps);
		const status: OnboardingStatus = {
			isComplete: !onboard && !progress,
			activeTour: progress ?? undefined,
		};
		return dataResponse(status, (data) => {
			if (data.isComplete) {
				req.deps.log("  Onboarding: complete");
			} else if (data.activeTour) {
				req.deps.log(`  Onboarding: in progress (${data.activeTour.tourId}, step ${data.activeTour.currentStepIndex})`);
			} else {
				req.deps.log("  Onboarding: not started");
			}
		});
	},

	"onboarding:start": (req) => {
		const progress = readProgress(VAULT_ROOT, req.deps);
		if (progress) {
			return dataResponse(progress, (data) => {
				req.deps.log(`  Resuming tour: ${data.tourId} (step ${data.currentStepIndex})`);
				req.deps.log("  Run Flowti interactively to continue the tour.");
			});
		}
		return dataResponse({ started: false }, () => {
			req.deps.log("  Run Flowti interactively to start the onboarding tour.");
		});
	},

	"onboarding:skip": (req) => {
		markOnboardingComplete(VAULT_ROOT, req.deps);
		return dataResponse({ skipped: true }, () => {
			req.deps.log("  Onboarding marked as complete.");
		});
	},

	"onboarding:restart": (req) => {
		resetOnboarding(VAULT_ROOT, req.deps);
		resetProgress(VAULT_ROOT, req.deps);
		return dataResponse({ reset: true }, () => {
			req.deps.log("  Onboarding reset. Run 'flowti' to start the tour.");
		});
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/controller/onboarding.controller.test.ts --config configs/vitest.config.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/controller/onboarding.controller.ts tests/controller/onboarding.controller.test.ts
git commit -m "feat(onboarding): add controller with status, skip, and restart commands"
```

---

## Task 7: Sitemap Pages & Handler Registration

**Files:**
- Modify: `configs/sitemap.json`
- Create: `src/ui/handlers/onboarding-handlers.ts`
- Modify: `src/ui/handlers/register-handlers.ts`

No isolated unit tests for this task — handler logic will be tested via integration (existing sitemap validation tests will verify page structure).

- [ ] **Step 1: Add 3 onboarding pages to sitemap.json**

Add the following pages to the `pages` object in `configs/sitemap.json`:

```json
"onboarding": {
  "kind": "page",
  "label": "Welcome to Flowti",
  "icon": "rocket",
  "domain": "onboarding",
  "status": "active",
  "description": "First-run onboarding — welcome screen and tour selection.",
  "route": { "path": "onboarding" },
  "actions": [
    {
      "name": "onStartTour",
      "label": "Start Tour",
      "type": "handler",
      "target": "onboarding:select-tour",
      "key": "1",
      "group": "tour"
    },
    {
      "name": "onSkip",
      "label": "Skip Onboarding",
      "type": "handler",
      "target": "onboarding:skip-tour",
      "key": "s",
      "group": "nav"
    },
    {
      "name": "onQuit",
      "label": "Quit",
      "type": "signal",
      "target": "quit",
      "key": "q",
      "group": "nav"
    }
  ]
},
"onboarding-tour": {
  "kind": "page",
  "label": "Onboarding Tour",
  "icon": "compass",
  "domain": "onboarding",
  "status": "active",
  "description": "Active tour step renderer — guides the user through onboarding.",
  "parent": "onboarding",
  "route": { "path": "onboarding/:tourId" },
  "actions": [
    {
      "name": "onContinue",
      "label": "Continue",
      "type": "handler",
      "target": "onboarding:continue",
      "key": "c",
      "group": "tour"
    },
    {
      "name": "onChecklist",
      "label": "View Progress",
      "type": "navigate",
      "target": "onboarding-checklist",
      "key": "p",
      "group": "tour"
    },
    {
      "name": "onBack",
      "label": "Back",
      "type": "signal",
      "target": "back",
      "key": "b",
      "group": "nav"
    },
    {
      "name": "onQuit",
      "label": "Quit",
      "type": "signal",
      "target": "quit",
      "key": "q",
      "group": "nav"
    }
  ]
},
"onboarding-checklist": {
  "kind": "page",
  "label": "Onboarding Progress",
  "icon": "check-square",
  "domain": "onboarding",
  "status": "active",
  "description": "View onboarding tour progress and completed milestones.",
  "parent": "onboarding-tour",
  "route": { "path": "onboarding/checklist" },
  "actions": [
    {
      "name": "onBack",
      "label": "Back",
      "type": "signal",
      "target": "back",
      "key": "b",
      "group": "nav"
    },
    {
      "name": "onQuit",
      "label": "Quit",
      "type": "signal",
      "target": "quit",
      "key": "q",
      "group": "nav"
    }
  ]
}
```

- [ ] **Step 2: Create onboarding-handlers.ts**

```typescript
// src/ui/handlers/onboarding-handlers.ts
import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { VAULT_ROOT, PROJECTS_DIR } from "../../infrastructure/config.js";
import { renderNarration, renderChecklist, renderHintBanner, renderTourSelection } from "../displays/onboarding-display.js";
import { readProgress, writeProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { markOnboardingComplete } from "../../domain/onboarding/onboarding-detection.js";
import { processStep, advanceProgress } from "../../domain/onboarding/tour-engine.js";
import type { Tour, TourRegistry, TourStep, CheckpointStep } from "../../domain/onboarding/onboarding-types.js";

function loadTourRegistry(deps: { disk: { readFileSync: (p: string, e: string) => string }; paths: { join: (...a: string[]) => string } }): TourRegistry {
	const content = deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "configs/onboarding/tours.json"), "utf-8",
	);
	return JSON.parse(content) as TourRegistry;
}

function loadTour(tourPath: string, deps: { disk: { readFileSync: (p: string, e: string) => string }; paths: { join: (...a: string[]) => string } }): Tour {
	const content = deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "configs/onboarding", tourPath), "utf-8",
	);
	return JSON.parse(content) as Tour;
}

function loadStepContent(tourDir: string, contentPath: string, deps: { disk: { readFileSync: (p: string, e: string) => string }; paths: { join: (...a: string[]) => string } }): string {
	return deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "configs/onboarding", tourDir, contentPath), "utf-8",
	);
}

export function registerOnboardingHandlers(registry: HandlerRegistry): void {
	// Welcome page — render welcome.md content
	registry.registerBeforeRender("onboarding:welcome", (ctx) => {
		const content = ctx.deps.disk.readFileSync(
			ctx.deps.paths.join(VAULT_ROOT, "configs/onboarding/welcome.md"), "utf-8",
		);
		renderNarration({ speaker: "Alice", disposition: "strategic", content }, ctx.deps.log);
	});

	// Tour selection action
	registry.registerAction("onboarding:select-tour", async (ctx) => {
		const reg = loadTourRegistry(ctx.deps);
		if (reg.tours.length === 1) {
			// Auto-select when only one tour exists
			const tourId = reg.tours[0].id;
			const progress = createInitialProgress(tourId, ctx.deps);
			writeProgress(VAULT_ROOT, progress, ctx.deps);
			return `navigate:onboarding-tour?${JSON.stringify({ tourId })}` as MenuResult;
		}
		const tours = reg.tours.map((t) => {
			const tour = loadTour(t.path, ctx.deps);
			return { id: tour.id, name: tour.name, description: tour.description };
		});
		renderTourSelection(tours, ctx.deps.log);
		const choice = await ctx.deps.input.ask("Select a tour (number): ");
		const idx = parseInt(choice, 10) - 1;
		if (idx >= 0 && idx < tours.length) {
			const tourId = tours[idx].id;
			const progress = createInitialProgress(tourId, ctx.deps);
			writeProgress(VAULT_ROOT, progress, ctx.deps);
			return `navigate:onboarding-tour?${JSON.stringify({ tourId })}` as MenuResult;
		}
		return "refresh" as MenuResult;
	});

	// Skip onboarding action
	registry.registerAction("onboarding:skip-tour", async (ctx) => {
		markOnboardingComplete(VAULT_ROOT, ctx.deps);
		ctx.deps.log("  Onboarding skipped. You can restart with: flowti onboarding:restart");
		return "start" as MenuResult;
	});

	// Tour view — renders current step
	registry.registerView("onboarding-tour", async (ctx) => {
		const progress = readProgress(VAULT_ROOT, ctx.deps);
		if (!progress) return "main" as MenuResult;

		const tourId = progress.tourId;
		const reg = loadTourRegistry(ctx.deps);
		const tourEntry = reg.tours.find((t) => t.id === tourId);
		if (!tourEntry) return "main" as MenuResult;

		const tour = loadTour(tourEntry.path, ctx.deps);
		const tourDir = `tours/${tourId}`;

		// Tour complete?
		if (progress.currentStepIndex >= tour.steps.length) {
			markOnboardingComplete(VAULT_ROOT, ctx.deps);
			return "navigate:project-detail" as MenuResult;
		}

		const step = tour.steps[progress.currentStepIndex];
		const rawContent = loadStepContent(tourDir, step.content, ctx.deps);
		const hintsContent = step.type === "delegate" && step.hints
			? loadStepContent(tourDir, step.hints, ctx.deps)
			: undefined;

		const result = processStep(step, progress, rawContent, hintsContent);

		switch (result.kind) {
			case "narrate": {
				renderNarration(result, ctx.deps.log);
				await ctx.deps.input.waitForEnter();
				const next = advanceProgress(progress, step.id);
				writeProgress(VAULT_ROOT, next, ctx.deps);
				return "refresh" as MenuResult;
			}
			case "prompt": {
				renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
				const answer = await ctx.deps.input.ask(`  ${result.field}: `);
				if (result.validation === "non-empty" && !answer.trim()) {
					ctx.deps.log("  Please provide a value.");
					return "refresh" as MenuResult;
				}
				const next = advanceProgress(progress, step.id, { [result.field]: answer.trim() });
				writeProgress(VAULT_ROOT, next, ctx.deps);
				return "refresh" as MenuResult;
			}
			case "auto": {
				renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
				const confirm = await ctx.deps.input.ask("  Does that work for you? [Y/n] ");
				if (confirm.toLowerCase() === "n") {
					ctx.deps.log("  No problem — you can adjust this later.");
				}
				// Auto-action execution: dispatch based on result.action
				// The implementer should add action handlers here for:
				//   "project:scaffold" → call scaffoldProjectConfig()
				//   "iteration:set-defaults" → call createIteration() with defaults
				const next = advanceProgress(progress, step.id);
				writeProgress(VAULT_ROOT, next, ctx.deps);
				return "refresh" as MenuResult;
			}
			case "delegate": {
				const params = JSON.stringify({ onboarding: { tourId: result.tourId, stepId: result.stepId } });
				const next = advanceProgress(progress, step.id);
				writeProgress(VAULT_ROOT, next, ctx.deps);
				return `navigate:${result.target}?${params}` as MenuResult;
			}
			case "checkpoint": {
				renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
				const checklistItems = result.completedSteps.map((id) => ({
					id,
					label: (tour.steps.find((s) => s.id === id && s.type === "checkpoint") as CheckpointStep | undefined)?.label ?? id,
					completed: true,
				}));
				renderChecklist(checklistItems, ctx.deps.log);
				await ctx.deps.input.waitForEnter();
				const next = advanceProgress(progress, step.id);
				writeProgress(VAULT_ROOT, next, ctx.deps);
				return "refresh" as MenuResult;
			}
			default:
				return "refresh" as MenuResult;
		}
	});

	// Checklist view
	registry.registerView("onboarding-checklist", async (ctx) => {
		const progress = readProgress(VAULT_ROOT, ctx.deps);
		if (!progress) {
			ctx.deps.log("  No active tour.");
			return "main" as MenuResult;
		}
		const reg = loadTourRegistry(ctx.deps);
		const tourEntry = reg.tours.find((t) => t.id === progress.tourId);
		if (!tourEntry) return "main" as MenuResult;
		const tour = loadTour(tourEntry.path, ctx.deps);
		const checkpoints = tour.steps.filter((s): s is CheckpointStep => s.type === "checkpoint");
		const items = checkpoints.map((cp) => ({
			id: cp.id,
			label: cp.label,
			completed: progress.completedSteps.includes(cp.id),
		}));
		renderChecklist(items, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return "main" as MenuResult;
	});

	// Delegation hint — existing pages check for onboarding context in params
	registry.registerBeforeRender("iteration-planning:onboarding-hint", (ctx) => {
		const onboarding = ctx.params?.onboarding as { tourId: string; stepId: string } | undefined;
		if (onboarding) {
			renderHintBanner(`${onboarding.tourId} tour`, ctx.deps.log);
		}
	});
}
```

**Note to implementer:** The auto-action cases in the tour view handler contain placeholder comments for `"project:scaffold"` and `"iteration:set-defaults"`. These need to call the actual domain functions (`scaffoldProjectConfig()` from project-config.ts, `createIteration()` from iteration-store.ts) with the PM's inputs from `progress.context`. Build these out when integrating with those domains.

- [ ] **Step 3: Register handlers in register-handlers.ts**

Add to `src/ui/handlers/register-handlers.ts`:

```typescript
import { registerOnboardingHandlers } from "./onboarding-handlers.js";

// Inside registerAllHandlers():
registerOnboardingHandlers(registry);
```

- [ ] **Step 4: Run sitemap validation**

Run: `npx vitest run tests/domain/sitemap/ --config configs/vitest.config.ts`
Expected: PASS (existing sitemap tests should still pass with new pages)

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add configs/sitemap.json src/ui/handlers/onboarding-handlers.ts src/ui/handlers/register-handlers.ts
git commit -m "feat(onboarding): add sitemap pages and handler registration"
```

---

## Task 8: Content Files

**Files:**
- Create: `configs/onboarding/welcome.md`
- Create: `configs/onboarding/tours.json`
- Create: `configs/onboarding/tours/project-manager/tour.json`
- Create: `configs/onboarding/tours/project-manager/steps/*.md` (13 files)
- Create: `configs/onboarding/tours/project-manager/hints/iteration-planning.md`

No tests — these are content files.

- [ ] **Step 1: Create tours.json**

```json
{
  "tours": [
    { "id": "project-manager", "path": "tours/project-manager/tour.json" }
  ]
}
```

- [ ] **Step 2: Create tour.json**

```json
{
  "id": "project-manager",
  "name": "Project Manager",
  "role": "project-manager",
  "description": "Set up your first project and plan your first iteration",
  "steps": [
    { "id": "welcome", "type": "narrate", "content": "steps/01-welcome.md" },
    { "id": "pm-intro", "type": "narrate", "content": "steps/03-pm-intro.md" },
    { "id": "name-project", "type": "prompt", "content": "steps/04-name-project.md", "field": "projectName", "validation": "non-empty" },
    { "id": "scaffold-project", "type": "auto", "content": "steps/05-scaffold.md", "action": "project:scaffold" },
    { "id": "project-created", "type": "checkpoint", "content": "steps/06-project-created.md", "label": "Project created" },
    { "id": "iterations-intro", "type": "narrate", "content": "steps/07-iterations.md" },
    { "id": "name-iteration", "type": "prompt", "content": "steps/08-name-iteration.md", "field": "iterationName", "validation": "non-empty" },
    { "id": "iteration-defaults", "type": "auto", "content": "steps/09-defaults.md", "action": "iteration:set-defaults" },
    { "id": "add-scope", "type": "delegate", "content": "steps/10-scope-hints.md", "target": "iteration-planning", "hints": "hints/iteration-planning.md" },
    { "id": "iteration-planned", "type": "checkpoint", "content": "steps/11-iter-planned.md", "label": "First iteration planned" },
    { "id": "whats-next", "type": "narrate", "content": "steps/12-whats-next.md" },
    { "id": "tour-complete", "type": "checkpoint", "content": "steps/13-complete.md", "label": "Tour complete" }
  ]
}
```

- [ ] **Step 3: Create welcome.md**

```markdown
---
speaker: Alice
disposition: strategic
---

Welcome to Flowti! I'm Alice, and I'll be guiding you through setting up your first project.

Flowti is a project orchestration CLI that helps you manage iterations, track deliverables,
log risks, and coordinate your team — all from the command line.

By the end of this tour, you'll have a named project with your first iteration planned and
ready to go. It takes about 5 minutes.
```

- [ ] **Step 4: Create all 13 step content files**

Create each file under `configs/onboarding/tours/project-manager/steps/`:

**01-welcome.md** — Alice introduction for the PM tour start
**03-pm-intro.md** — PM tour goals ("by the end you'll have...")
**04-name-project.md** — prompt to name project
**05-scaffold.md** — auto-action announcement (template: `{{projectName}}`)
**06-project-created.md** — checkpoint confirmation (template: `{{projectName}}`)
**07-iterations.md** — what iterations are
**08-name-iteration.md** — prompt for iteration name/goal
**09-defaults.md** — auto-action: iteration defaults (template: `{{durationDays}}`)
**10-scope-hints.md** — delegation intro (template: `{{iterationName}}`)
**11-iter-planned.md** — checkpoint confirmation (template: `{{iterationName}}`)
**12-whats-next.md** — summary and next steps (template: `{{projectName}}`)
**13-complete.md** — completion message

Each file follows the frontmatter format:
```markdown
---
speaker: Alice
disposition: strategic
---

[Content here, with {{token}} placeholders where needed]
```

- [ ] **Step 5: Create hints/iteration-planning.md**

```markdown
This is the real Iteration Planning page — the same one you'll use for every iteration.

**Tip:** Start with 3-5 scope items. Each should be completable in 1-2 days. You can
always add more later.

Press **b** when you've added your scope items to continue the tour.
```

- [ ] **Step 6: Commit**

```bash
git add configs/onboarding/
git commit -m "feat(onboarding): add PM tour content files and tour definition"
```

---

## Task 9: Startup Integration

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add detection check before router.run()**

In `src/main.ts`, find the line `await router.run("start");` and replace with:

```typescript
import { shouldOnboard } from "./domain/onboarding/onboarding-detection.js";
// VAULT_ROOT and PROJECTS_DIR are already imported from ./infrastructure/config.js in main.ts

// ... (in the interactive startup section, after router creation)
const startView = shouldOnboard(VAULT_ROOT, PROJECTS_DIR, { disk: sharedDeps.disk, paths: sharedDeps.paths })
  ? "onboarding"
  : "start";
await router.run(startView);
```

- [ ] **Step 2: Register onboarding controller domain**

Add to the domain registration block in `main.ts`:

```typescript
import { commands as onboardingCmds } from "./controller/onboarding.controller.js";

registry.registerDomain({
  domain: "onboarding",
  commands: onboardingCmds,
  projectFree: ["onboarding:status", "onboarding:start", "onboarding:skip", "onboarding:restart"],
});
```

**Note to implementer:** The `vaultRoot` and `projectsDir` variables must be accessible at this point. Check how they are defined in `main.ts` — they are likely derived from constants in `src/infrastructure/config.ts` or similar. Use the same source.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: PASS (all existing tests + new onboarding tests)

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npx eslint src/ --config configs/eslint.config.mjs`
Expected: PASS (no architecture violations — domain imports stay pure)

- [ ] **Step 6: Build**

Run: `node configs/esbuild.config.mjs`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/main.ts
git commit -m "feat(onboarding): integrate first-run detection into CLI startup"
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run full check (lint + tsc + tests)**

Run: `npm test`
Expected: PASS

- [ ] **Step 2: Run build**

Run: `node configs/esbuild.config.mjs`
Expected: PASS — outputs to `.flowti/bin/main.js`

- [ ] **Step 3: Verify content files load**

Run: `ls configs/onboarding/tours/project-manager/steps/ | wc -l`
Expected: 13 files

Run: `cat configs/onboarding/tours.json`
Expected: Valid JSON with `project-manager` tour entry

- [ ] **Step 4: Verify sitemap has new pages**

Run: `npx vitest run tests/domain/sitemap/ --config configs/vitest.config.ts`
Expected: PASS — sitemap validation includes onboarding pages
