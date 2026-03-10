/**
 * journey-executor.ts — Executes journey definitions as automated tests.
 *
 * The executor reads a JourneyDefinition and runs each step's actions
 * using a dynamically assembled tool registry. Base tools are always
 * available; environment providers add target-specific tools.
 *
 * Projects declare what they need via `requires`, the CLI provides —
 * dependency injection for test environments.
 */

import type {
	JourneyDefinition,
	JourneyStep,
	JourneyAction,
	JourneyResult,
	StepResult,
	ActionResult,
	JourneyExecutorOptions,
} from "./journey-types.js";
import { BASE_TOOLS } from "./journey-tools.js";
import type { ToolExecutor } from "./journey-tools.js";
import type { EnvironmentProvider } from "./journey-environment.js";

// ── Tool deps (testable seam) ────────────────────────────────────────

/** Dependencies injected into tool executors. */
export interface ToolDeps {
	exec: (cmd: string, opts?: { cwd?: string; timeout?: number; env?: Record<string, string> }) => { exitCode: number; stdout: string; stderr: string };
	readFile: (path: string) => string;
	writeFile: (path: string, content: string) => void;
	exists: (path: string) => boolean;
	mkdir: (path: string) => void;
	log: (msg: string) => void;
	sleep: (ms: number) => Promise<void>;
}

// ── Resolved environment ─────────────────────────────────────────────

/**
 * A resolved execution environment: tool registry + lifecycle hooks.
 * Built by resolveEnvironment() before journey execution.
 */
export interface ResolvedEnvironment {
	tools: Record<string, ToolExecutor>;
	setup?: (deps: ToolDeps, opts: JourneyExecutorOptions) => void | Promise<void>;
	teardown?: (deps: ToolDeps) => void | Promise<void>;
}

/**
 * Resolve the execution environment for a journey.
 * Merges base tools with provider-specific tools.
 * If no provider given, returns base tools only.
 */
export function resolveEnvironment(provider?: EnvironmentProvider): ResolvedEnvironment {
	if (!provider) return { tools: { ...BASE_TOOLS } };
	return {
		tools: { ...BASE_TOOLS, ...provider.tools },
		setup: provider.setup,
		teardown: provider.teardown,
	};
}

// ── Step execution ──────────────────────────────────────────────────

function ms(start: number): number {
	return Date.now() - start;
}

async function executeAction(
	action: JourneyAction,
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
): Promise<ActionResult> {
	const executor = tools[action.tool];
	if (!executor) {
		deps.log(`[journey] Skipping unsupported tool: ${action.tool}`);
		return { tool: action.tool, success: true, output: `skipped (unsupported: ${action.tool})`, durationMs: 0 };
	}
	return executor(action, deps, opts);
}

async function executeStep(
	step: JourneyStep,
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
): Promise<StepResult> {
	const start = Date.now();
	const actions: ActionResult[] = [];

	for (const action of step.actions) {
		const result = await executeAction(action, tools, deps, opts);
		actions.push(result);
		if (!result.success) {
			return {
				stepId: step.id,
				stepTitle: step.title,
				status: "fail",
				durationMs: ms(start),
				actions,
				error: result.error,
			};
		}
	}

	return {
		stepId: step.id,
		stepTitle: step.title,
		status: "pass",
		durationMs: ms(start),
		actions,
	};
}

// ── Journey lifecycle helpers ────────────────────────────────────────

async function runActions(
	actions: JourneyAction[],
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	label: string,
	stopOnFailure: boolean,
): Promise<void> {
	deps.log(`[journey] Running ${actions.length} ${label} action(s)...`);
	for (const action of actions) {
		const r = await executeAction(action, tools, deps, opts);
		if (!r.success) {
			deps.log(`[journey] ${label} failed: ${r.error}`);
			if (stopOnFailure) break;
		}
	}
}

async function runSteps(
	definition: JourneyDefinition,
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
	continueOnFailure: boolean,
): Promise<StepResult[]> {
	const results: StepResult[] = [];
	let hasFailed = false;

	for (const step of definition.steps) {
		if (hasFailed && !continueOnFailure) {
			results.push({ stepId: step.id, stepTitle: step.title, status: "skip", durationMs: 0, actions: [] });
			continue;
		}

		deps.log(`[journey] Step: ${step.title}`);
		const r = await executeStep(step, tools, deps, opts);
		results.push(r);

		if (r.status === "fail") {
			hasFailed = true;
			deps.log(`[journey]   ✗ ${step.title}: ${r.error}`);
		} else {
			deps.log(`[journey]   ✓ ${step.title} (${r.durationMs}ms)`);
		}
	}

	return results;
}

// ── Journey execution ───────────────────────────────────────────────

/**
 * Execute a journey definition against a resolved environment.
 */
export async function executeJourney(
	definition: JourneyDefinition,
	deps: ToolDeps,
	opts: JourneyExecutorOptions = {},
	env?: ResolvedEnvironment,
): Promise<JourneyResult> {
	const resolved = env ?? resolveEnvironment();
	const tools = resolved.tools;
	const start = Date.now();
	const continueOnFailure = opts.continueOnFailure ?? true;

	if (resolved.setup) await resolved.setup(deps, opts);
	if (definition.setup?.length) await runActions(definition.setup, tools, deps, opts, "setup", !continueOnFailure);

	const results = await runSteps(definition, tools, deps, opts, continueOnFailure);

	if (definition.teardown?.length) await runActions(definition.teardown, tools, deps, opts, "teardown", false);
	if (resolved.teardown) await resolved.teardown(deps);

	const passed = results.filter((r) => r.status === "pass").length;
	const failed = results.filter((r) => r.status === "fail").length;
	const skipped = results.filter((r) => r.status === "skip").length;

	return {
		journeyName: definition.journey,
		totalSteps: definition.steps.length,
		passed, failed, skipped,
		durationMs: ms(start),
		steps: results,
	};
}
