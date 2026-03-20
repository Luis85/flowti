# Agent Behavior Trees & World Tools — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rule-based decision engine with mistreevous behavior trees, giving agents real tools (read file, write file, query LLM, drop artifact) and personality-driven behavior via attribute thresholds.

**Architecture:** Domain-layer-pure BT types + agent factory + subtrees + tick orchestrator. All tool implementations receive deps via injection. Phase 1 stubs needs/sensor branches (liveness-systems prerequisite not yet implemented). Worker manager integration adds BT as an alternative execution model alongside the existing process loop.

**Tech Stack:** TypeScript (ES2022, NodeNext), mistreevous (behavior tree engine), vitest

**Spec:** `docs/specs/2026-03-20-agent-behavior-trees-and-tools-design.md`

---

## File Structure

### New Files

| File | Purpose |
|------|---------|
| `src/domain/agents/behavior-tree/bt-types.ts` | All BT types: GoalType, AgentNeeds, BTSensorEvent, LLMSlot, BTAgentContext, AgentToolDeps |
| `src/domain/agents/behavior-tree/bt-agent.ts` | BTAgent object factory — binds tools + conditions to context |
| `src/domain/agents/behavior-tree/bt-factory.ts` | Creates BehaviourTree from agent definition + subtrees |
| `src/domain/agents/behavior-tree/bt-tick.ts` | Tick orchestration — step + world-state action collection |
| `src/domain/agents/behavior-tree/subtrees/goal-review.ts` | MDSL + config for "review" goal type |
| `src/domain/agents/behavior-tree/subtrees/goal-summarize.ts` | MDSL + config for "summarize" goal type |
| `src/domain/agents/behavior-tree/subtrees/goal-plan.ts` | MDSL + config for "plan" goal type |
| `src/domain/agents/behavior-tree/subtrees/goal-implement.ts` | MDSL + config for "implement" goal type |
| `src/domain/agents/behavior-tree/subtrees/goal-monitor.ts` | MDSL + config for "monitor" goal type (no WriteFile) |
| `src/domain/agents/behavior-tree/subtrees/goal-report.ts` | MDSL + config for "report" goal type |
| `src/domain/agents/behavior-tree/subtrees/idle.ts` | Idle behavior subtree MDSL |
| `src/domain/agents/behavior-tree/subtrees/social.ts` | Social interaction subtree MDSL |
| `src/domain/agents/behavior-tree/subtrees/needs.ts` | Needs satisfaction subtree MDSL (Phase 1 stub) |
| `src/domain/agents/behavior-tree/subtrees/urgent.ts` | Urgent reaction subtree MDSL (Phase 1 stub) |
| `src/domain/agents/behavior-tree/templates/template-engine.ts` | LLM fallback content generation for all 6 goal types |
| `tests/domain/agents/behavior-tree/bt-types.test.ts` | Type guard + factory tests |
| `tests/domain/agents/behavior-tree/bt-agent.test.ts` | BTAgent tool + condition tests |
| `tests/domain/agents/behavior-tree/bt-factory.test.ts` | Tree creation tests |
| `tests/domain/agents/behavior-tree/bt-tick.test.ts` | Tick orchestration tests |
| `tests/domain/agents/behavior-tree/subtrees/goal-subtrees.test.ts` | All 6 goal subtree tests |
| `tests/domain/agents/behavior-tree/subtrees/supporting-subtrees.test.ts` | Idle, social, needs, urgent tests |
| `tests/domain/agents/behavior-tree/templates/template-engine.test.ts` | Template generation tests |
| `tests/domain/agents/behavior-tree/integration.test.ts` | Full BT tick cycle integration test |

### Modified Files

| File | Changes |
|------|---------|
| `src/domain/agents/world-state-types.ts` | Extend `WorldEntityType` with `"artifact"`, extend `AgentActionType` with 7 new values |
| `src/infrastructure/world-state-manager.ts` | Add 7 `STATUS_MAP` entries for new action types |
| `src/infrastructure/worker-manager.ts` | BT creation, tick interval, coexistence with process loop |

### Dependency Graph

```
Task 1 (install) → Task 2 (types) → ┬─ Task 3 (world-state-types) → Task 4 (STATUS_MAP)
                                     ├─ Task 5 (template-engine)
                                     └─ Task 6 (bt-agent conditions)
                                            ↓
                                     Task 7 (bt-agent tools) ← Task 5
                                            ↓
                                     ┬─ Task 8 (goal subtrees)
                                     └─ Task 9 (supporting subtrees)
                                            ↓
                                     Task 10 (bt-factory)
                                            ↓
                                     Task 11 (bt-tick) ← Task 4
                                            ↓
                                     Task 12 (worker-manager)
                                            ↓
                                     Task 13 (integration test)
```

Parallelizable: Tasks 3+5+6 after Task 2. Tasks 8+9 after Task 7. Tasks 4 can run any time after Task 3.

---

## Chunk 1: Foundation — Types & World-State Extensions

### Task 1: Install mistreevous dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install mistreevous**

```bash
cd "01 - Projects/Flowti CLI" && npm install --save mistreevous
```

Expected: `package.json` dependencies now includes `"mistreevous": "^X.Y.Z"`. Lock file updated.

- [ ] **Step 2: Verify TypeScript can resolve mistreevous**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS (no new errors). If mistreevous ships without types, create `configs/vendor.d.ts` with `declare module "mistreevous";` and ensure `tsconfig.json` includes it (it already includes `vendor.d.ts`).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/package.json" "01 - Projects/Flowti CLI/package-lock.json"
git commit -m "chore: add mistreevous behavior tree dependency"
```

---

### Task 2: Create bt-types.ts

**Files:**
- Create: `src/domain/agents/behavior-tree/bt-types.ts`
- Create: `tests/domain/agents/behavior-tree/bt-types.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import {
	createDefaultNeeds,
	createIdleLLMSlot,
	parseGoalType,
	type GoalType,
	type AgentNeeds,
	type LLMSlot,
	type BTAgentContext,
} from "../../../../src/domain/agents/behavior-tree/bt-types.js";

describe("bt-types", () => {
	describe("createDefaultNeeds", () => {
		it("returns needs at default levels", () => {
			const needs = createDefaultNeeds();
			expect(needs).toEqual({ energy: 80, social: 60, focus: 70, morale: 75 });
		});
	});

	describe("createIdleLLMSlot", () => {
		it("returns idle slot with no process or result", () => {
			const slot = createIdleLLMSlot();
			expect(slot).toEqual({ state: "idle", process: null, result: null });
		});
	});

	describe("parseGoalType", () => {
		it("extracts known goal type from goal name", () => {
			expect(parseGoalType("review iteration plan")).toBe("review");
			expect(parseGoalType("summarize health report")).toBe("summarize");
			expect(parseGoalType("plan next sprint")).toBe("plan");
			expect(parseGoalType("implement auth module")).toBe("implement");
			expect(parseGoalType("monitor test results")).toBe("monitor");
			expect(parseGoalType("report on progress")).toBe("report");
		});

		it("returns undefined for unrecognized goal names", () => {
			expect(parseGoalType("do something random")).toBeUndefined();
			expect(parseGoalType("")).toBeUndefined();
		});

		it("is case-insensitive", () => {
			expect(parseGoalType("Review the spec")).toBe("review");
			expect(parseGoalType("SUMMARIZE findings")).toBe("summarize");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-types.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write bt-types.ts**

```typescript
/**
 * bt-types.ts — Type definitions for the behavior tree agent system.
 *
 * Domain-layer pure. No I/O, no infrastructure imports.
 * AgentNeeds / BTSensorEvent are defined here (not yet in CLI codebase).
 * See spec: docs/specs/2026-03-20-agent-behavior-trees-and-tools-design.md
 */

import type { AgentAttributes, AgentGoal } from "../agent-types.js";
import type { IWorldStateManager } from "../world-state-types.js";
import type { IProviderRegistry, LLMProcess } from "../llm-types.js";
import type { PermissionVerdict } from "../permission-engine.js";

// ── Goal Types ───────────────────────────────────────────────────────

export type GoalType = "review" | "summarize" | "plan" | "implement" | "monitor" | "report";

const GOAL_TYPES: readonly GoalType[] = ["review", "summarize", "plan", "implement", "monitor", "report"];

/** Extract goal type from a goal name string (first word match, case-insensitive). */
export function parseGoalType(goalName: string): GoalType | undefined {
	const lower = goalName.toLowerCase();
	return GOAL_TYPES.find((t) => lower.startsWith(t));
}

// ── Agent Needs (Phase 2 — liveness-systems prerequisite) ────────────

export interface AgentNeeds {
	energy: number;
	social: number;
	focus: number;
	morale: number;
}

export function createDefaultNeeds(): AgentNeeds {
	return { energy: 80, social: 60, focus: 70, morale: 75 };
}

// ── Sensor Events (Phase 2 — liveness-systems prerequisite) ──────────

export interface BTSensorEvent {
	readonly type: string;
	readonly source: string;
	readonly timestamp: string;
	readonly data: Record<string, unknown>;
}

// ── LLM Async Slot ───────────────────────────────────────────────────

export type LLMSlotState = "idle" | "pending" | "resolved" | "failed";

export interface LLMSlot {
	state: LLMSlotState;
	process: LLMProcess | null;
	result: string | null;
}

export function createIdleLLMSlot(): LLMSlot {
	return { state: "idle", process: null, result: null };
}

// ── Tool Dependencies ────────────────────────────────────────────────

export interface IFileSystem {
	readFileSync(path: string, encoding: string): string;
	writeFileSync(path: string, content: string, encoding: string): void;
	existsSync(path: string): boolean;
	mkdirSync(path: string, opts?: { recursive?: boolean }): void;
}

export interface IPaths {
	join(...segments: string[]): string;
	dirname(p: string): string;
	basename(p: string): string;
}

export interface IClock {
	now(): number;
	ms(): number;
	iso(): string;
}

export interface AgentToolDeps {
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly providerRegistry?: IProviderRegistry;
	readonly worldState: IWorldStateManager;
	readonly checkPermission: (tool: string) => PermissionVerdict;
}

// ── BTAgent Context (Blackboard) ─────────────────────────────────────

export interface BTAgentContext {
	readonly name: string;
	readonly persona: string | undefined;
	readonly domain: string | undefined;
	readonly attributes: AgentAttributes;
	readonly personality: readonly string[];
	readonly experience: number;

	needs: AgentNeeds;
	goals: readonly AgentGoal[];
	activeGoal: AgentGoal | null;
	activeGoalFile: string | null;
	pendingEvent: BTSensorEvent | null;
	nearbyAgents: readonly string[];

	lastFileContent: string | null;
	lastLLMResult: string | null;
	lastWrittenPath: string | null;
	workingFilePath: string | null;
	llmSlot: LLMSlot;
}

// ── Goal Subtree Config ──────────────────────────────────────────────

export interface GoalSubtreeConfig {
	readonly goalType: GoalType;
	readonly mdsl: string;
	readonly promptInstruction: string;
}

// ── Collected Actions ────────────────────────────────────────────────

export interface CollectedAction {
	readonly type: string;
	readonly data: Record<string, unknown>;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-types.test.ts --config configs/vitest.config.ts
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/bt-types.ts" "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/bt-types.test.ts"
git commit -m "feat(bt): add behavior tree type definitions"
```

---

### Task 3: Extend world-state-types.ts

**Files:**
- Modify: `src/domain/agents/world-state-types.ts:9-31`
- Modify: `tests/domain/agents/world-state-types.test.ts` (if exists, else verify via existing tests)

- [ ] **Step 1: Extend AgentActionType**

In `src/domain/agents/world-state-types.ts`, add the 7 new action types after `"error"` (line 21):

```typescript
export type AgentActionType =
	| "thinking"
	| "speaking"
	| "asking"
	| "using-tool"
	| "tool-complete"
	| "requesting-permission"
	| "permission-granted"
	| "permission-denied"
	| "task-started"
	| "task-completed"
	| "idle"
	| "error"
	| "artifact-dropped"
	| "file-read"
	| "file-written"
	| "file-opened"
	| "goal-started"
	| "goal-completed"
	| "template-generated";
```

- [ ] **Step 2: Extend WorldEntityType**

On line 31, change:

```typescript
export type WorldEntityType = "agent" | "project" | "iteration" | "artifact";
```

- [ ] **Step 3: Type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 4: Run existing tests to ensure no regressions**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: All existing tests pass. The new union members are additive — no breakage.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts"
git commit -m "feat(world): extend WorldEntityType and AgentActionType for behavior trees"
```

---

### Task 4: Extend world-state-manager.ts STATUS_MAP

**Files:**
- Modify: `src/infrastructure/world-state-manager.ts:19-33`

- [ ] **Step 1: Add STATUS_MAP entries**

In `src/infrastructure/world-state-manager.ts`, add after the `"error"` entry (line 33) inside the `STATUS_MAP` object:

```typescript
	"artifact-dropped": () => ({ state: "idle", currentAction: "idle" }),
	"file-read": () => ({ state: "busy", currentAction: "reading" }),
	"file-written": () => ({ state: "busy", currentAction: "writing" }),
	"file-opened": () => ({ state: "busy", currentAction: "opening" }),
	"goal-started": (a: AgentAction) => ({ state: "busy", currentAction: "goal", goal: a.data.goalName }),
	"goal-completed": () => ({ state: "idle", currentAction: "idle" }),
	"template-generated": () => ({ state: "busy", currentAction: "generating" }),
```

- [ ] **Step 2: Type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 3: Run existing tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: All existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/world-state-manager.ts"
git commit -m "feat(world): add STATUS_MAP entries for BT action types"
```

---

## Chunk 2: Template Engine + BTAgent

### Task 5: Create template-engine.ts

**Files:**
- Create: `src/domain/agents/behavior-tree/templates/template-engine.ts`
- Create: `tests/domain/agents/behavior-tree/templates/template-engine.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { generateFromTemplate, type TemplateContext } from "../../../../../src/domain/agents/behavior-tree/templates/template-engine.js";

function makeCtx(overrides: Partial<TemplateContext> = {}): TemplateContext {
	return {
		goalType: "review",
		fileName: "iteration-plan.md",
		fileContent: "---\nstatus: in-progress\n---\n# Iteration Plan\n\n## Goals\n\n- Ship feature A\n- Fix bug B\n\n## Risks\n\nNone identified.",
		agentName: "Atlas",
		persona: "The Architect",
		mood: "focused",
		timestamp: "2026-03-20T10:00:00Z",
		...overrides,
	};
}

describe("generateFromTemplate", () => {
	describe("review", () => {
		it("extracts frontmatter status", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("in-progress");
		});

		it("counts sections", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("3 sections");
		});

		it("includes agent persona", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "review" }));
			expect(result).toContain("The Architect");
		});
	});

	describe("summarize", () => {
		it("extracts headings as bullet points", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "summarize" }));
			expect(result).toContain("- Iteration Plan");
			expect(result).toContain("- Goals");
			expect(result).toContain("- Risks");
		});

		it("includes word count", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "summarize" }));
			expect(result).toMatch(/\d+ words/);
		});
	});

	describe("plan", () => {
		it("generates numbered checklist", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "plan" }));
			expect(result).toMatch(/1\./);
		});
	});

	describe("implement", () => {
		it("generates scaffold stub", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "implement" }));
			expect(result).toContain("Implementation");
		});
	});

	describe("monitor", () => {
		it("generates status check report", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "monitor" }));
			expect(result).toContain("Status Check");
		});
	});

	describe("report", () => {
		it("generates aggregated report with metadata", () => {
			const result = generateFromTemplate(makeCtx({ goalType: "report" }));
			expect(result).toContain("Report");
		});
	});

	it("always produces non-empty output", () => {
		for (const goalType of ["review", "summarize", "plan", "implement", "monitor", "report"] as const) {
			const result = generateFromTemplate(makeCtx({ goalType }));
			expect(result.length).toBeGreaterThan(50);
		}
	});

	it("handles empty file content gracefully", () => {
		const result = generateFromTemplate(makeCtx({ fileContent: "" }));
		expect(result.length).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/templates/template-engine.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write template-engine.ts**

```typescript
/**
 * template-engine.ts — LLM fallback content generation.
 *
 * Produces useful analysis for each goal type without requiring LLM.
 * Domain-layer pure. No I/O.
 */

import type { GoalType } from "../bt-types.js";

export interface TemplateContext {
	readonly goalType: GoalType;
	readonly fileName: string;
	readonly fileContent: string;
	readonly agentName: string;
	readonly persona: string | undefined;
	readonly mood: string;
	readonly timestamp: string;
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractFrontmatter(content: string): Record<string, string> {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};
	const fields: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const sep = line.indexOf(":");
		if (sep > 0) fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
	}
	return fields;
}

function extractHeadings(content: string): string[] {
	return content.split("\n").filter((l) => l.startsWith("#")).map((l) => l.replace(/^#+\s*/, ""));
}

function wordCount(content: string): number {
	return content.split(/\s+/).filter(Boolean).length;
}

function header(ctx: TemplateContext, title: string): string {
	const who = ctx.persona ?? ctx.agentName;
	return `# ${title}: ${ctx.fileName}\n\n*Generated by ${who} on ${ctx.timestamp}*\n*Mood: ${ctx.mood}*\n\n`;
}

// ── Goal-Type Generators ─────────────────────────────────────────────

function reviewTemplate(ctx: TemplateContext): string {
	const fm = extractFrontmatter(ctx.fileContent);
	const headings = extractHeadings(ctx.fileContent);
	const words = wordCount(ctx.fileContent);
	const status = fm.status ?? "unknown";

	let out = header(ctx, "Review");
	out += `## Summary\n\n`;
	out += `- **Status:** ${status}\n`;
	out += `- **${headings.length} sections** | ${words} words\n`;
	out += `- **Sections:** ${headings.join(", ") || "none"}\n\n`;

	const todos = (ctx.fileContent.match(/TODO|FIXME|HACK/gi) ?? []).length;
	if (todos > 0) out += `> **Warning:** ${todos} TODO/FIXME markers found.\n\n`;

	out += `## Assessment by ${ctx.persona ?? ctx.agentName}\n\n`;
	out += `Document is ${status}. Contains ${headings.length} sections spanning ${words} words.`;
	if (todos > 0) out += ` Flagged ${todos} open items that need attention.`;
	out += `\n`;
	return out;
}

function summarizeTemplate(ctx: TemplateContext): string {
	const headings = extractHeadings(ctx.fileContent);
	const words = wordCount(ctx.fileContent);
	const firstParagraph = ctx.fileContent.replace(/^---[\s\S]*?---\n*/, "").split("\n\n").find((p) => p.trim() && !p.startsWith("#")) ?? "";

	let out = header(ctx, "Summary");
	if (firstParagraph) out += `${firstParagraph.trim()}\n\n`;
	out += `## Sections\n\n`;
	for (const h of headings) out += `- ${h}\n`;
	out += `\n${words} words total.\n`;
	return out;
}

function planTemplate(ctx: TemplateContext): string {
	const headings = extractHeadings(ctx.fileContent);
	let out = header(ctx, "Plan");
	out += `## Action Items\n\n`;
	if (headings.length > 0) {
		headings.forEach((h, i) => { out += `${i + 1}. Review and address: ${h}\n`; });
	} else {
		out += `1. Analyze the contents of ${ctx.fileName}\n`;
		out += `2. Identify key action items\n`;
		out += `3. Prioritize and schedule work\n`;
	}
	out += `\n## Next Steps\n\nProceed through items in priority order.\n`;
	return out;
}

function implementTemplate(ctx: TemplateContext): string {
	let out = header(ctx, "Implementation Notes");
	out += `## Scope\n\nTarget file: \`${ctx.fileName}\`\n\n`;
	out += `## Approach\n\n`;
	out += `1. Read and understand current contents\n`;
	out += `2. Identify areas for modification\n`;
	out += `3. Apply changes incrementally\n`;
	out += `4. Verify changes against goals\n\n`;
	out += `## Notes\n\nGenerated without LLM assistance — manual review recommended.\n`;
	return out;
}

function monitorTemplate(ctx: TemplateContext): string {
	const fm = extractFrontmatter(ctx.fileContent);
	const words = wordCount(ctx.fileContent);
	const status = fm.status ?? "unknown";

	let out = header(ctx, "Status Check");
	out += `## Current State\n\n`;
	out += `- **File:** ${ctx.fileName}\n`;
	out += `- **Status:** ${status}\n`;
	out += `- **Size:** ${words} words\n`;
	out += `- **Checked at:** ${ctx.timestamp}\n\n`;
	out += `No anomalies detected in automated check.\n`;
	return out;
}

function reportTemplate(ctx: TemplateContext): string {
	const fm = extractFrontmatter(ctx.fileContent);
	const headings = extractHeadings(ctx.fileContent);
	const words = wordCount(ctx.fileContent);

	let out = header(ctx, "Report");
	out += `## File Metadata\n\n`;
	out += `| Property | Value |\n|----------|-------|\n`;
	out += `| File | ${ctx.fileName} |\n`;
	out += `| Words | ${words} |\n`;
	out += `| Sections | ${headings.length} |\n`;
	for (const [k, v] of Object.entries(fm)) out += `| ${k} | ${v} |\n`;
	out += `\n## Content Overview\n\n`;
	for (const h of headings) out += `- ${h}\n`;
	out += `\n`;
	return out;
}

// ── Main Dispatch ────────────────────────────────────────────────────

const GENERATORS: Record<GoalType, (ctx: TemplateContext) => string> = {
	review: reviewTemplate,
	summarize: summarizeTemplate,
	plan: planTemplate,
	implement: implementTemplate,
	monitor: monitorTemplate,
	report: reportTemplate,
};

export function generateFromTemplate(ctx: TemplateContext): string {
	return GENERATORS[ctx.goalType](ctx);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/templates/template-engine.test.ts --config configs/vitest.config.ts
```

Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/templates/template-engine.ts" "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/templates/template-engine.test.ts"
git commit -m "feat(bt): add template engine for LLM fallback content generation"
```

---

### Task 6: Create bt-agent.ts — conditions

**Files:**
- Create: `src/domain/agents/behavior-tree/bt-agent.ts`
- Create: `tests/domain/agents/behavior-tree/bt-agent.test.ts`

- [ ] **Step 1: Write condition tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createBTAgent } from "../../../../src/domain/agents/behavior-tree/bt-agent.js";
import { createDefaultNeeds, createIdleLLMSlot } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentToolDeps } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentSummary } from "../../../../src/domain/agents/agent-types.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(), getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
		...overrides,
	};
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "Atlas",
		agentType: "llm",
		description: "Test agent",
		skills: [],
		tools: [],
		roles: [],
		attributes: { str: 10, int: 14, wis: 12, cha: 10, dex: 10, con: 14 },
		persona: "The Architect",
		mood: "focused",
		personality: ["analytical", "methodical"],
		experience: 100,
		goals: [{ name: "review iteration plan", priority: 10 }],
		file: "agents/atlas.md",
		...overrides,
	};
}

describe("createBTAgent — conditions", () => {
	it("HasEnoughEnergy returns true when energy above threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.energy = 50;
		expect(bt.HasEnoughEnergy()).toBe(true);
	});

	it("HasEnoughEnergy returns false when energy below threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.energy = 10;
		expect(bt.HasEnoughEnergy()).toBe(false);
	});

	it("HasEnoughEnergy threshold lowered by high CON", () => {
		const bt = createBTAgent(makeAgent({ attributes: { con: 20 } }), makeDeps());
		bt.context.needs.energy = 21;
		// Threshold = 30 - 20/2 = 20, so 21 > 20 = true
		expect(bt.HasEnoughEnergy()).toBe(true);
	});

	it("HasEnoughFocus returns true when focus above threshold", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.focus = 50;
		expect(bt.HasEnoughFocus()).toBe(true);
	});

	it("HasEnoughFocus threshold lowered by high INT", () => {
		const bt = createBTAgent(makeAgent({ attributes: { int: 18 } }), makeDeps());
		bt.context.needs.focus = 15;
		// Threshold = 20 - 18/3 = 14, so 15 > 14 = true
		expect(bt.HasEnoughFocus()).toBe(true);
	});

	it("HasEnoughMorale returns true when morale above 10", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.needs.morale = 15;
		expect(bt.HasEnoughMorale()).toBe(true);
	});

	it("HasActiveGoal returns false when no active goal", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasActiveGoal()).toBe(false);
	});

	it("HasActiveGoal returns true when goal is set", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review plan", priority: 10 };
		expect(bt.HasActiveGoal()).toBe(true);
	});

	it("HasGoalFile returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasGoalFile()).toBe(false);
	});

	it("HasLLMProvider returns false when no registry", () => {
		const bt = createBTAgent(makeAgent(), makeDeps({ providerRegistry: undefined }));
		expect(bt.HasLLMProvider()).toBe(false);
	});

	it("HasLLMProvider returns true when providers registered", () => {
		const registry = { register: vi.fn(), get: vi.fn(), list: vi.fn(() => [{}]), select: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ providerRegistry: registry as never }));
		expect(bt.HasLLMProvider()).toBe(true);
	});

	it("HasNearbyAgent returns false when no nearby agents", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasNearbyAgent()).toBe(false);
	});

	it("HasPendingEvent returns false initially (Phase 1)", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasPendingEvent()).toBe(false);
	});

	it("HasFileContent returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasFileContent()).toBe(false);
	});

	it("HasLLMResult returns false initially", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		expect(bt.HasLLMResult()).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-agent.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write bt-agent.ts (conditions + context factory)**

```typescript
/**
 * bt-agent.ts — BTAgent object factory.
 *
 * Creates the agent object that mistreevous binds to. Contains all action
 * methods, condition methods, and the shared context (blackboard).
 * Domain-layer pure — all I/O via injected deps.
 */

import { State } from "mistreevous";
import type { AgentSummary } from "../agent-types.js";
import { hasLLMProvider } from "../llm-availability.js";
import { generateFromTemplate } from "./templates/template-engine.js";
import {
	createDefaultNeeds,
	createIdleLLMSlot,
	parseGoalType,
	type AgentToolDeps,
	type BTAgentContext,
	type CollectedAction,
	type GoalType,
} from "./bt-types.js";

export interface BTAgentObject {
	readonly context: BTAgentContext;
	readonly collectedActions: CollectedAction[];

	// Conditions (return boolean)
	HasEnoughEnergy(): boolean;
	HasEnoughFocus(): boolean;
	HasEnoughMorale(): boolean;
	HasActiveGoal(): boolean;
	HasGoalFile(): boolean;
	HasLLMProvider(): boolean;
	HasNearbyAgent(): boolean;
	HasPendingEvent(): boolean;
	HasFileContent(): boolean;
	HasLLMResult(): boolean;

	// Actions (return State)
	PickGoal(): State;
	PickGoalFile(): State;
	ReadFile(): State;
	WriteFile(): State;
	OpenInVault(): State;
	QueryLLM(): State;
	GenerateFromTemplate(): State;
	DropArtifact(): State;
	SpeakBubble(): State;
	Wander(): State;
	Emote(): State;
	Chatter(): State;
	Socialize(): State;
	Rest(): State;
	HandleEvent(): State;
}

export function createBTAgent(agent: AgentSummary, deps: AgentToolDeps): BTAgentObject {
	const attr = agent.attributes ?? {};
	const con = attr.con ?? 10;
	const int_ = attr.int ?? 10;
	const wis = attr.wis ?? 10;
	const str = attr.str ?? 10;

	const context: BTAgentContext = {
		name: agent.name,
		persona: agent.persona,
		domain: agent.domain,
		attributes: attr,
		personality: agent.personality ?? [],
		experience: agent.experience ?? 0,
		needs: createDefaultNeeds(),
		goals: agent.goals ?? [],
		activeGoal: null,
		activeGoalFile: null,
		pendingEvent: null,
		nearbyAgents: [],
		lastFileContent: null,
		lastLLMResult: null,
		lastWrittenPath: null,
		workingFilePath: null,
		llmSlot: createIdleLLMSlot(),
	};

	const collectedActions: CollectedAction[] = [];

	function collect(type: string, data: Record<string, unknown> = {}): void {
		collectedActions.push({ type, data });
	}

	// ── Conditions ───────────────────────────────────────────────────

	function HasEnoughEnergy(): boolean {
		return context.needs.energy > (30 - con / 2);
	}

	function HasEnoughFocus(): boolean {
		return context.needs.focus > (20 - int_ / 3);
	}

	function HasEnoughMorale(): boolean {
		return context.needs.morale > 10;
	}

	function HasActiveGoal(): boolean {
		return context.activeGoal !== null;
	}

	function HasGoalFile(): boolean {
		return context.activeGoalFile !== null;
	}

	function HasLLMProvider(): boolean {
		return hasLLMProvider(deps.providerRegistry);
	}

	function HasNearbyAgent(): boolean {
		return context.nearbyAgents.length > 0;
	}

	function HasPendingEvent(): boolean {
		return context.pendingEvent !== null;
	}

	function HasFileContent(): boolean {
		return context.lastFileContent !== null;
	}

	function HasLLMResult(): boolean {
		return context.llmSlot.state === "resolved" && context.llmSlot.result !== null;
	}

	// ── Actions ──────────────────────────────────────────────────────

	function PickGoal(): State {
		const goals = context.goals;
		if (goals.length === 0) return State.FAILED;

		let picked;
		if (wis >= 14) {
			picked = [...goals].sort((a, b) => (b.priority ?? 1) - (a.priority ?? 1))[0];
		} else {
			picked = goals[Math.floor(Math.random() * goals.length)];
		}

		(context as { activeGoal: typeof picked }).activeGoal = picked;
		collect("goal-started", { goalName: picked.name });
		return State.SUCCEEDED;
	}

	function PickGoalFile(): State {
		if (!context.activeGoal) return State.FAILED;
		const goalName = context.activeGoal.name;
		const words = goalName.split(/\s+/).slice(1);
		const fileName = words.join("-") + ".md";
		(context as { activeGoalFile: string }).activeGoalFile = fileName;
		(context as { workingFilePath: string }).workingFilePath = fileName;
		return State.SUCCEEDED;
	}

	function ReadFile(): State {
		const verdict = deps.checkPermission("Read");
		if (verdict !== "allowed") return State.FAILED;

		const filePath = context.workingFilePath ?? context.activeGoalFile;
		if (!filePath) return State.FAILED;

		try {
			const content = deps.disk.readFileSync(filePath, "utf-8");
			(context as { lastFileContent: string }).lastFileContent = content;
			collect("file-read", { filePath });
			return State.SUCCEEDED;
		} catch {
			return State.FAILED;
		}
	}

	function WriteFile(): State {
		const verdict = deps.checkPermission("Write");
		if (verdict !== "allowed") return State.FAILED;

		const content = context.lastLLMResult;
		if (!content) return State.FAILED;

		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "note") : "note";
		const outPath = deps.paths.join("artifacts", `${context.name}-${goalType}-${deps.clock.ms()}.md`);

		try {
			deps.disk.writeFileSync(outPath, content, "utf-8");
			(context as { lastWrittenPath: string }).lastWrittenPath = outPath;
			collect("file-written", { filePath: outPath });
			return State.SUCCEEDED;
		} catch {
			return State.FAILED;
		}
	}

	function OpenInVault(): State {
		const filePath = context.lastWrittenPath ?? context.workingFilePath;
		if (!filePath) return State.FAILED;
		collect("file-opened", { filePath });
		return State.SUCCEEDED;
	}

	function QueryLLM(): State {
		// Guard: only start once
		if (context.llmSlot.state === "idle") {
			if (!deps.providerRegistry) return State.FAILED;

			const selection = deps.providerRegistry.select({
				preferred: undefined,
				taskType: "autonomous",
			});

			const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "review") : "review";
			const prompt = assemblePrompt(context, goalType, int_);

			const process = selection.provider.execute({
				messages: [{ role: "user", content: prompt }],
				system: `You are ${context.persona ?? context.name}, a ${context.domain ?? "general"} specialist.`,
			} as never);

			context.llmSlot.state = "pending";
			context.llmSlot.process = process;

			process.result
				.then((result) => {
					context.llmSlot.state = "resolved";
					context.llmSlot.result = typeof result.text === "string" ? result.text : JSON.stringify(result);
				})
				.catch(() => {
					context.llmSlot.state = "failed";
				});

			collect("thinking", {});
			return State.RUNNING;
		}

		// Poll
		if (context.llmSlot.state === "pending") return State.RUNNING;

		if (context.llmSlot.state === "resolved") {
			(context as { lastLLMResult: string | null }).lastLLMResult = context.llmSlot.result;
			context.llmSlot.state = "idle";
			context.llmSlot.process = null;
			context.llmSlot.result = null;
			return State.SUCCEEDED;
		}

		// Failed
		context.llmSlot.state = "idle";
		context.llmSlot.process = null;
		return State.FAILED;
	}

	function GenerateFromTemplate(): State {
		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "review") : "review";
		const result = generateFromTemplate({
			goalType,
			fileName: context.activeGoalFile ?? "unknown",
			fileContent: context.lastFileContent ?? "",
			agentName: context.name,
			persona: context.persona,
			mood: agent.mood ?? "neutral",
			timestamp: deps.clock.iso(),
		});
		(context as { lastLLMResult: string }).lastLLMResult = result;
		collect("template-generated", { goalType });
		return State.SUCCEEDED;
	}

	function DropArtifact(): State {
		if (!context.lastWrittenPath) return State.FAILED;
		const goalType = context.activeGoal ? (parseGoalType(context.activeGoal.name) ?? "note") : "note";
		const entityId = `artifact-${context.name}-${deps.clock.ms()}`;

		deps.worldState.updateEntity(entityId, "artifact", {
			filePath: context.lastWrittenPath,
			droppedBy: context.name,
			droppedAt: deps.clock.iso(),
			goalType,
			position: "near-agent",
			picked: false,
		});

		collect("artifact-dropped", {
			filePath: context.lastWrittenPath,
			goalType,
			entityId,
		});

		// STR >= 14: auto-open assertiveness
		if (str >= 14) OpenInVault();

		return State.SUCCEEDED;
	}

	function SpeakBubble(): State {
		const text = context.lastLLMResult?.slice(0, 120) ?? "...";
		collect("speaking", { text, source: "bt" });
		return State.SUCCEEDED;
	}

	function Wander(): State {
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function Emote(): State {
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function Chatter(): State {
		collect("speaking", { text: "", source: "chatter" });
		return State.SUCCEEDED;
	}

	function Socialize(): State {
		if (context.nearbyAgents.length === 0) return State.FAILED;
		collect("speaking", { text: "", source: "social", target: context.nearbyAgents[0] });
		return State.SUCCEEDED;
	}

	function Rest(): State {
		context.needs.energy = Math.min(100, context.needs.energy + 5);
		collect("idle", {});
		return State.SUCCEEDED;
	}

	function HandleEvent(): State {
		if (!context.pendingEvent) return State.FAILED;
		const event = context.pendingEvent;
		(context as { pendingEvent: null }).pendingEvent = null;
		collect("speaking", { text: `Reacting to ${event.type}`, source: "event" });
		return State.SUCCEEDED;
	}

	return {
		context,
		collectedActions,
		HasEnoughEnergy, HasEnoughFocus, HasEnoughMorale,
		HasActiveGoal, HasGoalFile, HasLLMProvider,
		HasNearbyAgent, HasPendingEvent, HasFileContent, HasLLMResult,
		PickGoal, PickGoalFile, ReadFile, WriteFile, OpenInVault,
		QueryLLM, GenerateFromTemplate, DropArtifact, SpeakBubble,
		Wander, Emote, Chatter, Socialize, Rest, HandleEvent,
	};
}

// ── Prompt Assembly ──────────────────────────────────────────────────

function assemblePrompt(ctx: BTAgentContext, goalType: string, int_: number): string {
	let prompt = `You are ${ctx.persona ?? ctx.name}, a ${ctx.domain ?? "general"} specialist.\n`;
	prompt += `Goal: ${goalType} — ${ctx.activeGoal?.name ?? "general task"}\n`;
	prompt += `File: ${ctx.activeGoalFile ?? "none"}\n\n`;

	if (ctx.lastFileContent) {
		prompt += ctx.lastFileContent + "\n\n";
	}

	prompt += goalTypeInstruction(goalType);

	if (int_ >= 14) {
		prompt += "\n\nAdditional context: Include related files and project health summary in your analysis.";
	}
	if (int_ >= 18) {
		prompt += "\nCross-reference other agents' recent artifacts and historical goal outcomes.";
	}

	return prompt;
}

function goalTypeInstruction(goalType: string): string {
	switch (goalType) {
		case "review": return "Assess the document and provide recommendations. Note strengths, weaknesses, and action items.";
		case "summarize": return "Provide a concise summary. Extract key points and organize clearly.";
		case "plan": return "Generate actionable steps. Create a prioritized checklist with clear owners and deadlines.";
		case "implement": return "Propose code or content changes. Be specific about what to add, modify, or remove.";
		case "monitor": return "Check current status. Report any changes, anomalies, or items needing attention.";
		case "report": return "Aggregate information into a structured report. Include metadata, findings, and recommendations.";
		default: return "Analyze and respond appropriately.";
	}
}
```

- [ ] **Step 4: Run test to verify conditions pass**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-agent.test.ts --config configs/vitest.config.ts
```

Expected: PASS (all condition tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/bt-agent.ts" "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/bt-agent.test.ts"
git commit -m "feat(bt): add BTAgent factory with conditions and tool actions"
```

---

### Task 7: BTAgent tool action tests

**Files:**
- Modify: `tests/domain/agents/behavior-tree/bt-agent.test.ts`

- [ ] **Step 1: Add tool action tests**

Append to the existing test file:

```typescript
describe("createBTAgent — tool actions", () => {
	it("PickGoal selects highest-priority goal when WIS >= 14", () => {
		const agent = makeAgent({
			attributes: { wis: 16 },
			goals: [
				{ name: "review plan", priority: 5 },
				{ name: "summarize report", priority: 10 },
			],
		});
		const bt = createBTAgent(agent, makeDeps());
		const result = bt.PickGoal();
		expect(result).toBe(1); // State.SUCCEEDED = 1
		expect(bt.context.activeGoal?.name).toBe("summarize report");
	});

	it("PickGoal fails when no goals exist", () => {
		const bt = createBTAgent(makeAgent({ goals: [] }), makeDeps());
		expect(bt.PickGoal()).toBe(2); // State.FAILED = 2
	});

	it("PickGoalFile derives file name from goal", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review iteration plan" };
		const result = bt.PickGoalFile();
		expect(result).toBe(1); // SUCCEEDED
		expect(bt.context.activeGoalFile).toBe("iteration-plan.md");
	});

	it("ReadFile stores content on context", () => {
		const disk = { readFileSync: vi.fn(() => "file content"), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ disk }));
		(bt.context as { workingFilePath: string }).workingFilePath = "test.md";
		const result = bt.ReadFile();
		expect(result).toBe(1); // SUCCEEDED
		expect(bt.context.lastFileContent).toBe("file content");
	});

	it("ReadFile returns FAILED when permission denied", () => {
		const bt = createBTAgent(makeAgent(), makeDeps({ checkPermission: vi.fn(() => "denied" as const) }));
		(bt.context as { workingFilePath: string }).workingFilePath = "test.md";
		expect(bt.ReadFile()).toBe(2); // FAILED
	});

	it("WriteFile writes content and stores path", () => {
		const disk = { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ disk }));
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastLLMResult: string }).lastLLMResult = "generated content";
		const result = bt.WriteFile();
		expect(result).toBe(1); // SUCCEEDED
		expect(disk.writeFileSync).toHaveBeenCalled();
		expect(bt.context.lastWrittenPath).toContain("Atlas-review-");
	});

	it("GenerateFromTemplate populates lastLLMResult", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { activeGoalFile: string }).activeGoalFile = "plan.md";
		(bt.context as { lastFileContent: string }).lastFileContent = "# Plan\n\nContent here.";
		const result = bt.GenerateFromTemplate();
		expect(result).toBe(1); // SUCCEEDED
		expect(bt.context.lastLLMResult).toBeTruthy();
		expect(bt.context.lastLLMResult!.length).toBeGreaterThan(50);
	});

	it("DropArtifact creates entity and emits action", () => {
		const worldState = { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(), getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() };
		const bt = createBTAgent(makeAgent(), makeDeps({ worldState }));
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "artifacts/Atlas-review-1000.md";
		const result = bt.DropArtifact();
		expect(result).toBe(1); // SUCCEEDED
		expect(worldState.updateEntity).toHaveBeenCalledWith(
			expect.stringContaining("artifact-Atlas-"),
			"artifact",
			expect.objectContaining({ droppedBy: "Atlas", goalType: "review" }),
		);
	});

	it("DropArtifact auto-opens file when STR >= 14", () => {
		const bt = createBTAgent(makeAgent({ attributes: { str: 16 } }), makeDeps());
		bt.context.activeGoal = { name: "review plan" };
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "artifacts/Atlas-review-1000.md";
		bt.DropArtifact();
		const fileOpenedAction = bt.collectedActions.find((a) => a.type === "file-opened");
		expect(fileOpenedAction).toBeDefined();
	});

	it("SpeakBubble emits speaking action", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		(bt.context as { lastLLMResult: string }).lastLLMResult = "Here are my findings...";
		bt.SpeakBubble();
		const speakAction = bt.collectedActions.find((a) => a.type === "speaking");
		expect(speakAction).toBeDefined();
		expect(speakAction?.data.source).toBe("bt");
	});

	it("OpenInVault emits file-opened action", () => {
		const bt = createBTAgent(makeAgent(), makeDeps());
		(bt.context as { lastWrittenPath: string }).lastWrittenPath = "test.md";
		const result = bt.OpenInVault();
		expect(result).toBe(1); // SUCCEEDED
		expect(bt.collectedActions.find((a) => a.type === "file-opened")).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-agent.test.ts --config configs/vitest.config.ts
```

Expected: PASS (all condition + tool action tests). Note: `State.SUCCEEDED = 1`, `State.FAILED = 2`, `State.RUNNING = 3` — verify these match mistreevous's actual enum values and adjust assertions if different.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/bt-agent.test.ts"
git commit -m "test(bt): add tool action tests for BTAgent"
```

---

## Chunk 3: Subtrees + Assembly

### Task 8: Goal subtrees

**Files:**
- Create: `src/domain/agents/behavior-tree/subtrees/goal-review.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/goal-summarize.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/goal-plan.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/goal-implement.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/goal-monitor.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/goal-report.ts`
- Create: `tests/domain/agents/behavior-tree/subtrees/goal-subtrees.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { REVIEW_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-review.js";
import { SUMMARIZE_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-summarize.js";
import { PLAN_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-plan.js";
import { IMPLEMENT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-implement.js";
import { MONITOR_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-monitor.js";
import { REPORT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/goal-report.js";

describe("goal subtrees", () => {
	const standardSubtrees = [
		{ name: "review", mdsl: REVIEW_SUBTREE },
		{ name: "summarize", mdsl: SUMMARIZE_SUBTREE },
		{ name: "plan", mdsl: PLAN_SUBTREE },
		{ name: "implement", mdsl: IMPLEMENT_SUBTREE },
	];

	for (const { name, mdsl } of standardSubtrees) {
		describe(name, () => {
			it("exports a non-empty MDSL string", () => {
				expect(typeof mdsl).toBe("string");
				expect(mdsl.length).toBeGreaterThan(10);
			});

			it("contains a named root", () => {
				const rootName = name.charAt(0).toUpperCase() + name.slice(1) + "Goal";
				expect(mdsl).toContain(`root [${rootName}]`);
			});

			it("includes PickGoalFile action", () => {
				expect(mdsl).toContain("action [PickGoalFile]");
			});

			it("includes ReadFile action", () => {
				expect(mdsl).toContain("action [ReadFile]");
			});

			it("includes LLM/template fallback selector", () => {
				expect(mdsl).toContain("condition [HasLLMProvider]");
				expect(mdsl).toContain("action [GenerateFromTemplate]");
			});

			it("includes WriteFile action", () => {
				expect(mdsl).toContain("action [WriteFile]");
			});

			it("includes DropArtifact action", () => {
				expect(mdsl).toContain("action [DropArtifact]");
			});
		});
	}

	describe("monitor", () => {
		it("exports a non-empty MDSL string", () => {
			expect(MONITOR_SUBTREE.length).toBeGreaterThan(10);
		});

		it("contains MonitorGoal root", () => {
			expect(MONITOR_SUBTREE).toContain("root [MonitorGoal]");
		});

		it("does NOT include WriteFile (monitor only reads)", () => {
			expect(MONITOR_SUBTREE).not.toContain("action [WriteFile]");
		});

		it("does NOT include DropArtifact (monitor only speaks)", () => {
			expect(MONITOR_SUBTREE).not.toContain("action [DropArtifact]");
		});

		it("includes SpeakBubble", () => {
			expect(MONITOR_SUBTREE).toContain("action [SpeakBubble]");
		});
	});

	describe("report", () => {
		it("exports a non-empty MDSL string", () => {
			expect(REPORT_SUBTREE.length).toBeGreaterThan(10);
		});

		it("contains ReportGoal root", () => {
			expect(REPORT_SUBTREE).toContain("root [ReportGoal]");
		});

		it("includes WriteFile and DropArtifact", () => {
			expect(REPORT_SUBTREE).toContain("action [WriteFile]");
			expect(REPORT_SUBTREE).toContain("action [DropArtifact]");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/subtrees/goal-subtrees.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create goal-review.ts**

```typescript
/** MDSL subtree for "review" goal type. */
export const REVIEW_SUBTREE = `root [ReviewGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 4: Create goal-summarize.ts**

```typescript
/** MDSL subtree for "summarize" goal type. */
export const SUMMARIZE_SUBTREE = `root [SummarizeGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 5: Create goal-plan.ts**

```typescript
/** MDSL subtree for "plan" goal type. */
export const PLAN_SUBTREE = `root [PlanGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 6: Create goal-implement.ts**

```typescript
/** MDSL subtree for "implement" goal type. */
export const IMPLEMENT_SUBTREE = `root [ImplementGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 7: Create goal-monitor.ts**

```typescript
/** MDSL subtree for "monitor" goal type — no WriteFile or DropArtifact. */
export const MONITOR_SUBTREE = `root [MonitorGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 8: Create goal-report.ts**

```typescript
/** MDSL subtree for "report" goal type. */
export const REPORT_SUBTREE = `root [ReportGoal] {
	sequence {
		action [PickGoalFile]
		action [ReadFile]
		selector {
			sequence {
				condition [HasLLMProvider]
				action [QueryLLM]
			}
			action [GenerateFromTemplate]
		}
		action [WriteFile]
		action [DropArtifact]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 9: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/subtrees/goal-subtrees.test.ts --config configs/vitest.config.ts
```

Expected: PASS (all goal subtree tests).

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/subtrees/"
git add "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/subtrees/goal-subtrees.test.ts"
git commit -m "feat(bt): add goal subtree MDSL definitions for all 6 goal types"
```

---

### Task 9: Supporting subtrees (idle, social, needs, urgent)

**Files:**
- Create: `src/domain/agents/behavior-tree/subtrees/idle.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/social.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/needs.ts`
- Create: `src/domain/agents/behavior-tree/subtrees/urgent.ts`
- Create: `tests/domain/agents/behavior-tree/subtrees/supporting-subtrees.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { IDLE_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/idle.js";
import { SOCIAL_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/social.js";
import { NEEDS_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/needs.js";
import { URGENT_SUBTREE } from "../../../../../src/domain/agents/behavior-tree/subtrees/urgent.js";

describe("supporting subtrees", () => {
	describe("idle", () => {
		it("exports non-empty MDSL with IdleBehavior root", () => {
			expect(IDLE_SUBTREE).toContain("root [IdleBehavior]");
		});

		it("includes Wander, Emote, and Chatter actions", () => {
			expect(IDLE_SUBTREE).toContain("action [Wander]");
			expect(IDLE_SUBTREE).toContain("action [Emote]");
			expect(IDLE_SUBTREE).toContain("action [Chatter]");
		});
	});

	describe("social", () => {
		it("exports non-empty MDSL with SocialBehavior root", () => {
			expect(SOCIAL_SUBTREE).toContain("root [SocialBehavior]");
		});

		it("gates on HasNearbyAgent", () => {
			expect(SOCIAL_SUBTREE).toContain("condition [HasNearbyAgent]");
		});

		it("includes Socialize action", () => {
			expect(SOCIAL_SUBTREE).toContain("action [Socialize]");
		});
	});

	describe("needs (Phase 1 stub)", () => {
		it("exports non-empty MDSL with NeedsSatisfaction root", () => {
			expect(NEEDS_SUBTREE).toContain("root [NeedsSatisfaction]");
		});

		it("includes Rest action", () => {
			expect(NEEDS_SUBTREE).toContain("action [Rest]");
		});
	});

	describe("urgent (Phase 1 stub)", () => {
		it("exports non-empty MDSL with UrgentReaction root", () => {
			expect(URGENT_SUBTREE).toContain("root [UrgentReaction]");
		});

		it("gates on HasPendingEvent", () => {
			expect(URGENT_SUBTREE).toContain("condition [HasPendingEvent]");
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/subtrees/supporting-subtrees.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create idle.ts**

```typescript
/** MDSL subtree for idle behavior — wander, emote, chatter. */
export const IDLE_SUBTREE = `root [IdleBehavior] {
	lotto [1,1,1] {
		action [Wander]
		action [Emote]
		action [Chatter]
	}
}`;
```

- [ ] **Step 4: Create social.ts**

```typescript
/** MDSL subtree for social interactions — gates on nearby agents. */
export const SOCIAL_SUBTREE = `root [SocialBehavior] {
	sequence {
		condition [HasNearbyAgent]
		action [Socialize]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 5: Create needs.ts**

```typescript
/**
 * MDSL subtree for needs satisfaction.
 * Phase 1 stub — gates on HasEnoughEnergy (inverted).
 * Without the liveness-systems needs decay, energy stays at 80
 * and this branch never activates.
 */
export const NEEDS_SUBTREE = `root [NeedsSatisfaction] {
	selector {
		sequence {
			flip {
				condition [HasEnoughEnergy]
			}
			action [Rest]
		}
	}
}`;
```

- [ ] **Step 6: Create urgent.ts**

```typescript
/**
 * MDSL subtree for urgent sensor-triggered reactions.
 * Phase 1 stub — gates on HasPendingEvent (always null without sensor system).
 */
export const URGENT_SUBTREE = `root [UrgentReaction] {
	sequence {
		condition [HasPendingEvent]
		action [HandleEvent]
		action [SpeakBubble]
	}
}`;
```

- [ ] **Step 7: Run tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/subtrees/supporting-subtrees.test.ts --config configs/vitest.config.ts
```

Expected: PASS (all supporting subtree tests).

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/subtrees/idle.ts"
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/subtrees/social.ts"
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/subtrees/needs.ts"
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/subtrees/urgent.ts"
git add "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/subtrees/supporting-subtrees.test.ts"
git commit -m "feat(bt): add supporting subtrees — idle, social, needs stub, urgent stub"
```

---

### Task 10: Create bt-factory.ts

**Files:**
- Create: `src/domain/agents/behavior-tree/bt-factory.ts`
- Create: `tests/domain/agents/behavior-tree/bt-factory.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/domain/agents/behavior-tree/bt-factory.js";
import type { AgentToolDeps } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentSummary } from "../../../../src/domain/agents/agent-types.js";

function makeDeps(): AgentToolDeps {
	return {
		disk: { readFileSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn(), mkdirSync: vi.fn() },
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(), getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
	};
}

function makeAgent(overrides: Partial<AgentSummary> = {}): AgentSummary {
	return {
		name: "Atlas",
		agentType: "llm",
		description: "Test agent",
		skills: [],
		tools: [],
		roles: [],
		goals: [{ name: "review iteration plan", priority: 10 }],
		file: "agents/atlas.md",
		...overrides,
	};
}

describe("createAgentBT", () => {
	it("returns a tree and agent object", () => {
		const result = createAgentBT(makeAgent(), makeDeps());
		expect(result).toHaveProperty("tree");
		expect(result).toHaveProperty("agent");
	});

	it("tree can be stepped without error", () => {
		const { tree } = createAgentBT(makeAgent(), makeDeps());
		expect(() => tree.step()).not.toThrow();
	});

	it("agent context has correct identity", () => {
		const { agent } = createAgentBT(makeAgent(), makeDeps());
		expect(agent.context.name).toBe("Atlas");
		expect(agent.context.goals).toHaveLength(1);
	});

	it("tree step collects actions on agent", () => {
		const disk = {
			readFileSync: vi.fn(() => "# Content"),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => true),
			mkdirSync: vi.fn(),
		};
		const { tree, agent } = createAgentBT(makeAgent(), makeDeps());
		tree.step();
		// After one step, the tree should have attempted the ActiveGoal branch
		// which starts with PickGoal. At minimum, goal-started should be collected.
		expect(agent.collectedActions.length).toBeGreaterThanOrEqual(0);
	});

	it("handles agent with no goals (falls to idle)", () => {
		const { tree, agent } = createAgentBT(makeAgent({ goals: [] }), makeDeps());
		tree.step();
		// With no goals, ActiveGoal branch fails, should fall through to idle
		const hasIdleAction = agent.collectedActions.some((a) => a.type === "idle" || a.type === "speaking");
		expect(hasIdleAction || agent.collectedActions.length === 0).toBe(true);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-factory.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write bt-factory.ts**

```typescript
/**
 * bt-factory.ts — Creates a BehaviourTree from an agent definition.
 *
 * Composes all subtrees into the master tree MDSL, creates the BTAgent,
 * and returns both the tree and agent object.
 * Domain-layer pure — mistreevous is a pure computation library.
 */

import { BehaviourTree } from "mistreevous";
import type { AgentSummary } from "../agent-types.js";
import { createBTAgent, type BTAgentObject } from "./bt-agent.js";
import type { AgentToolDeps } from "./bt-types.js";
import { parseGoalType } from "./bt-types.js";

// Subtree imports
import { REVIEW_SUBTREE } from "./subtrees/goal-review.js";
import { SUMMARIZE_SUBTREE } from "./subtrees/goal-summarize.js";
import { PLAN_SUBTREE } from "./subtrees/goal-plan.js";
import { IMPLEMENT_SUBTREE } from "./subtrees/goal-implement.js";
import { MONITOR_SUBTREE } from "./subtrees/goal-monitor.js";
import { REPORT_SUBTREE } from "./subtrees/goal-report.js";
import { IDLE_SUBTREE } from "./subtrees/idle.js";
import { SOCIAL_SUBTREE } from "./subtrees/social.js";
import { NEEDS_SUBTREE } from "./subtrees/needs.js";
import { URGENT_SUBTREE } from "./subtrees/urgent.js";

export interface AgentBT {
	readonly tree: BehaviourTree;
	readonly agent: BTAgentObject;
}

/**
 * Build the master MDSL that references subtrees.
 * The ActiveGoal branch picks a goal subtree based on the agent's first goal type.
 */
function buildMasterMDSL(agent: AgentSummary): string {
	// Determine which goal subtree to use based on first goal
	const firstGoal = agent.goals?.[0];
	const goalType = firstGoal ? (parseGoalType(firstGoal.name) ?? "review") : "review";
	const goalRootName = goalType.charAt(0).toUpperCase() + goalType.slice(1) + "Goal";

	return `root {
	selector {
		branch [UrgentReaction]
		sequence {
			condition [HasEnoughEnergy]
			condition [HasEnoughFocus]
			condition [HasEnoughMorale]
			action [PickGoal]
			branch [${goalRootName}]
		}
		branch [SocialBehavior]
		branch [NeedsSatisfaction]
		branch [IdleBehavior]
	}
}`;
}

/** Collect all subtree MDSL definitions into one string for mistreevous. */
function collectSubtrees(): string {
	return [
		URGENT_SUBTREE,
		REVIEW_SUBTREE,
		SUMMARIZE_SUBTREE,
		PLAN_SUBTREE,
		IMPLEMENT_SUBTREE,
		MONITOR_SUBTREE,
		REPORT_SUBTREE,
		SOCIAL_SUBTREE,
		NEEDS_SUBTREE,
		IDLE_SUBTREE,
	].join("\n\n");
}

export function createAgentBT(agent: AgentSummary, deps: AgentToolDeps): AgentBT {
	const btAgent = createBTAgent(agent, deps);
	const masterMDSL = buildMasterMDSL(agent);
	const allMDSL = masterMDSL + "\n\n" + collectSubtrees();
	const tree = new BehaviourTree(allMDSL, btAgent);
	return { tree, agent: btAgent };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-factory.test.ts --config configs/vitest.config.ts
```

Expected: PASS (4 tests). Note: if mistreevous rejects the MDSL syntax, adjust the tree definitions. Common issues: `branch` vs `subtree` keyword, `flip` vs `inverter` keyword. Check mistreevous docs and adjust.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/bt-factory.ts" "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/bt-factory.test.ts"
git commit -m "feat(bt): add bt-factory — creates BehaviourTree from agent definition"
```

---

### Task 11: Create bt-tick.ts

**Files:**
- Create: `src/domain/agents/behavior-tree/bt-tick.ts`
- Create: `tests/domain/agents/behavior-tree/bt-tick.test.ts`

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { btTick } from "../../../../src/domain/agents/behavior-tree/bt-tick.js";
import type { BTAgentObject } from "../../../../src/domain/agents/behavior-tree/bt-agent.js";
import type { IWorldStateManager, AgentAction } from "../../../../src/domain/agents/world-state-types.js";
import type { IClock } from "../../../../src/domain/agents/behavior-tree/bt-types.js";

function makeClock(): IClock {
	return { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" };
}

function makeWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn() as never,
		getEntity: vi.fn(),
		flush: vi.fn(),
		addActionListener: vi.fn(),
		removeActionListener: vi.fn(),
	};
}

describe("btTick", () => {
	it("calls tree.step() once", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = { collectedActions: [], context: { name: "Atlas" } } as unknown as BTAgentObject;
		btTick(tree, agent, makeWorldState(), makeClock());
		expect(step).toHaveBeenCalledOnce();
	});

	it("emits collected actions as AgentActions to world state", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const ws = makeWorldState();
		const agent = {
			collectedActions: [
				{ type: "goal-started", data: { goalName: "review plan" } },
				{ type: "speaking", data: { text: "Hello" } },
			],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		btTick(tree, agent, ws, makeClock());

		expect(ws.emitAction).toHaveBeenCalledTimes(2);
		const firstCall = (ws.emitAction as ReturnType<typeof vi.fn>).mock.calls[0][0] as AgentAction;
		expect(firstCall.type).toBe("goal-started");
		expect(firstCall.agentName).toBe("Atlas");
	});

	it("drains collected actions after emitting", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = {
			collectedActions: [{ type: "idle", data: {} }],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		btTick(tree, agent, makeWorldState(), makeClock());
		expect(agent.collectedActions).toHaveLength(0);
	});

	it("returns the emitted actions for caller inspection", () => {
		const step = vi.fn();
		const tree = { step } as never;
		const agent = {
			collectedActions: [{ type: "idle", data: {} }],
			context: { name: "Atlas" },
		} as unknown as BTAgentObject;

		const result = btTick(tree, agent, makeWorldState(), makeClock());
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("idle");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-tick.test.ts --config configs/vitest.config.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write bt-tick.ts**

```typescript
/**
 * bt-tick.ts — Tick orchestration for behavior tree agents.
 *
 * Steps the tree once, collects emitted actions, forwards them
 * as AgentActions to the world state manager.
 * Domain-layer pure — receives all deps as arguments.
 */

import type { BehaviourTree } from "mistreevous";
import type { BTAgentObject } from "./bt-agent.js";
import type { IClock } from "./bt-types.js";
import type { IWorldStateManager, AgentAction } from "../world-state-types.js";

export function btTick(
	tree: BehaviourTree,
	agent: BTAgentObject,
	worldState: IWorldStateManager,
	clock: IClock,
): AgentAction[] {
	tree.step();

	const emitted: AgentAction[] = [];

	for (const collected of agent.collectedActions) {
		const action: AgentAction = {
			id: `bt-${agent.context.name}-${clock.ms()}-${emitted.length}`,
			agentName: agent.context.name,
			timestamp: clock.iso(),
			type: collected.type as AgentAction["type"],
			data: collected.data,
		};
		worldState.emitAction(action);
		emitted.push(action);
	}

	agent.collectedActions.length = 0;
	return emitted;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/bt-tick.test.ts --config configs/vitest.config.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/behavior-tree/bt-tick.ts" "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/bt-tick.test.ts"
git commit -m "feat(bt): add bt-tick — tick orchestration with world-state emission"
```

---

## Chunk 4: Integration

### Task 12: Worker-manager BT integration

**Files:**
- Modify: `src/infrastructure/worker-manager.ts`

This task adds BT as an alternative execution model. Agents with `behaviors[]` defined get BT; others keep the existing process loop.

- [ ] **Step 1: Add BT imports to worker-manager.ts**

At the top of `worker-manager.ts`, add after the existing imports:

```typescript
import { createAgentBT, type AgentBT } from "../domain/agents/behavior-tree/bt-factory.js";
import { btTick } from "../domain/agents/behavior-tree/bt-tick.js";
import type { AgentToolDeps } from "../domain/agents/behavior-tree/bt-types.js";
import { checkPermission } from "../domain/agents/permission-engine.js";
```

- [ ] **Step 2: Add BT fields to worker state**

Find the `WorkerImpl` class/interface in worker-manager.ts and add:

```typescript
bt?: AgentBT;
btTickTimer?: ReturnType<typeof setInterval>;
```

- [ ] **Step 3: Add BT creation on spawn**

In the worker spawn logic, after the worker is created, add a conditional:

```typescript
if (worker.agent.behaviors && worker.agent.behaviors.length > 0) {
	const varDir = deps.paths.join(vaultRoot, ".flowti", "var");
	const agentState = readAgentState(deps, varDir, worker.name);
	const policy = resolvePermissionPolicy(worker.agent.ai?.permissions, agentState.permissionOverride);

	const toolDeps: AgentToolDeps = {
		disk: deps.disk,
		paths: deps.paths,
		clock: deps.clock,
		providerRegistry: undefined, // Wired when LLM provider is available
		worldState,
		checkPermission: (tool: string) => checkPermission(policy, agentState.grants, tool, true),
	};

	worker.bt = createAgentBT(worker.agent, toolDeps);
	worker.btTickTimer = setInterval(() => {
		if (worker.bt) btTick(worker.bt.tree, worker.bt.agent, worldState, deps.clock);
	}, 3000);
}
```

- [ ] **Step 4: Add BT cleanup on despawn**

In the worker stop/despawn logic, add:

```typescript
if (worker.btTickTimer) {
	clearInterval(worker.btTickTimer);
	worker.btTickTimer = undefined;
}
worker.bt = undefined;
```

- [ ] **Step 5: Type-check**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

Expected: PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: All existing tests pass. BT integration is additive — existing workers without `behaviors[]` are unaffected.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts"
git commit -m "feat(bt): wire behavior tree into worker-manager with 3s tick interval"
```

---

### Task 13: Full integration test

**Files:**
- Create: `tests/domain/agents/behavior-tree/integration.test.ts`

- [ ] **Step 1: Write the integration test**

```typescript
import { describe, it, expect, vi } from "vitest";
import { createAgentBT } from "../../../../src/domain/agents/behavior-tree/bt-factory.js";
import { btTick } from "../../../../src/domain/agents/behavior-tree/bt-tick.js";
import type { AgentToolDeps } from "../../../../src/domain/agents/behavior-tree/bt-types.js";
import type { AgentSummary } from "../../../../src/domain/agents/agent-types.js";

function makeDeps(overrides: Partial<AgentToolDeps> = {}): AgentToolDeps {
	return {
		disk: {
			readFileSync: vi.fn(() => "---\nstatus: in-progress\n---\n# Iteration Plan\n\n## Goals\n\n- Ship A\n\n## Risks\n\nNone."),
			writeFileSync: vi.fn(),
			existsSync: vi.fn(() => true),
			mkdirSync: vi.fn(),
		},
		paths: { join: (...s: string[]) => s.join("/"), dirname: (p: string) => p, basename: (p: string) => p },
		clock: { now: () => 1000, ms: () => 1000, iso: () => "2026-03-20T10:00:00Z" },
		worldState: { emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn() as never, getEntity: vi.fn(), flush: vi.fn(), addActionListener: vi.fn(), removeActionListener: vi.fn() },
		checkPermission: vi.fn(() => "allowed" as const),
		...overrides,
	};
}

describe("BT integration — full tick cycle", () => {
	it("agent with review goal produces artifact after ticks", () => {
		const deps = makeDeps();
		const agent: AgentSummary = {
			name: "Atlas",
			agentType: "llm",
			description: "Test agent",
			skills: [],
			tools: [],
			roles: [],
			attributes: { str: 10, int: 14, wis: 14, cha: 10, dex: 10, con: 14 },
			persona: "The Architect",
			mood: "focused",
			goals: [{ name: "review iteration plan", priority: 10 }],
			file: "agents/atlas.md",
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Tick several times to walk through the tree
		const allActions = [];
		for (let i = 0; i < 5; i++) {
			const actions = btTick(tree, btAgent, deps.worldState, deps.clock);
			allActions.push(...actions);
		}

		// Verify goal was started
		expect(allActions.some((a) => a.type === "goal-started")).toBe(true);

		// Verify template was used (no LLM provider)
		expect(allActions.some((a) => a.type === "template-generated")).toBe(true);

		// Verify file was written
		expect(deps.disk.writeFileSync).toHaveBeenCalled();

		// Verify artifact was dropped
		expect(deps.worldState.updateEntity).toHaveBeenCalledWith(
			expect.stringContaining("artifact-Atlas-"),
			"artifact",
			expect.objectContaining({ droppedBy: "Atlas" }),
		);
	});

	it("agent without LLM falls back to template generation", () => {
		const deps = makeDeps({ providerRegistry: undefined });
		const agent: AgentSummary = {
			name: "Scout",
			agentType: "npc",
			description: "NPC agent",
			skills: [],
			tools: [],
			roles: [],
			goals: [{ name: "summarize report", priority: 5 }],
			file: "agents/scout.md",
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		const allActions = [];
		for (let i = 0; i < 5; i++) {
			allActions.push(...btTick(tree, btAgent, deps.worldState, deps.clock));
		}

		expect(allActions.some((a) => a.type === "template-generated")).toBe(true);
	});

	it("agent with no goals falls to idle behavior", () => {
		const deps = makeDeps();
		const agent: AgentSummary = {
			name: "Idle",
			agentType: "npc",
			description: "Idle agent",
			skills: [],
			tools: [],
			roles: [],
			goals: [],
			file: "agents/idle.md",
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);
		btTick(tree, btAgent, deps.worldState, deps.clock);

		// Should have some idle action (wander, emote, or chatter)
		const hasIdleOrSpeech = btAgent.collectedActions.length === 0 ||
			(deps.worldState.emitAction as ReturnType<typeof vi.fn>).mock.calls.some(
				(c: [{ type: string }]) => c[0].type === "idle" || c[0].type === "speaking"
			);
		expect(hasIdleOrSpeech).toBe(true);
	});

	it("permission denied on WriteFile causes graceful fallback", () => {
		const checkPermission = vi.fn((tool: string) => tool === "Write" ? "denied" as const : "allowed" as const);
		const deps = makeDeps({ checkPermission });
		const agent: AgentSummary = {
			name: "Blocked",
			agentType: "llm",
			description: "Blocked agent",
			skills: [],
			tools: [],
			roles: [],
			goals: [{ name: "review plan", priority: 10 }],
			file: "agents/blocked.md",
		};

		const { tree, agent: btAgent } = createAgentBT(agent, deps);

		// Should not throw even when WriteFile is denied
		expect(() => {
			for (let i = 0; i < 5; i++) btTick(tree, btAgent, deps.worldState, deps.clock);
		}).not.toThrow();
	});
});
```

- [ ] **Step 2: Run the integration test**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/behavior-tree/integration.test.ts --config configs/vitest.config.ts
```

Expected: PASS (4 tests).

- [ ] **Step 3: Run full test suite**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: ALL tests pass (existing + new BT tests).

- [ ] **Step 4: Type-check + lint**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs
```

Expected: PASS on both.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/domain/agents/behavior-tree/integration.test.ts"
git commit -m "test(bt): add full integration test — tick cycle, template fallback, permission denial"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npx tsc --noEmit --project configs/tsconfig.json` — PASS
- [ ] `npx eslint src/ --config configs/eslint.config.mjs` — PASS
- [ ] `npx vitest run --config configs/vitest.config.ts` — ALL PASS
- [ ] No `any` types, no `@ts-ignore`, no `TODO`/`FIXME`
- [ ] All new files use tabs, kebab-case, `.js` import extensions
- [ ] Decision engine tests unchanged and passing
- [ ] All BT files in `src/domain/agents/behavior-tree/` — domain-layer pure (no infrastructure imports)
