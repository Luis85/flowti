/**
 * journey-executor.ts — Executes journey definitions as automated tests.
 *
 * The executor reads a JourneyDefinition and runs each step's actions
 * using a dynamically assembled tool registry. Base tools are always
 * available; environment providers add target-specific tools.
 *
 * Supports: step filtering, dev mode, retry, conditional execution,
 * per-step timeout, bail-on-failure, and risk-priority sequencing.
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
	RiskLevel,
	SequencerStrategy,
} from "./journey-types.js";
import { isRefStep, RISK_PRIORITY } from "./journey-types.js";
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
	clock: { ms(): number };
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

// ── Step filtering & conditions ──────────────────────────────────────

/** @internal Exported for TypeDoc visibility. */
export type SkipResult = { skip: boolean; reason?: string };

/** Check step conditions (runIf/skipIf) for skip. */
function checkCondition(step: JourneyStep, opts: JourneyExecutorOptions): SkipResult | null {
	if (!step.condition) return null;
	const vars = opts.variables ?? {};
	const env = opts.env;
	if (step.condition.runIf) {
		const resolved = interpolateCondition(step.condition.runIf, vars, env);
		if (!isTruthy(resolved)) return { skip: true, reason: `runIf: "${step.condition.runIf}" is falsy` };
	}
	if (step.condition.skipIf) {
		const resolved = interpolateCondition(step.condition.skipIf, vars, env);
		if (isTruthy(resolved)) return { skip: true, reason: `skipIf: "${step.condition.skipIf}" is truthy` };
	}
	return null;
}

/** Check if a step should be skipped based on options and step config. */
export function shouldSkipStep(step: JourneyStep, opts: JourneyExecutorOptions): SkipResult {
	if (step.skip) return { skip: true, reason: "skip=true" };
	if (step.dev && !opts.devMode) return { skip: true, reason: "dev-only step" };
	if (opts.stepFilter?.length && !opts.stepFilter.includes(step.id)) {
		return { skip: true, reason: "filtered out" };
	}
	return checkCondition(step, opts) ?? { skip: false };
}

/** Interpolate {{var}} in a condition string. */
function interpolateCondition(expr: string, vars: Record<string, string>, env?: Record<string, string>): string {
	return expr.replace(/\{\{(\w[\w.]*)\}\}/g, (_m, key) => {
		// Support {{env.VAR}} for environment variables
		if (key.startsWith("env.")) return env?.[key.slice(4)] ?? "";
		return vars[key] ?? "";
	});
}

/** Determine if a resolved condition value is truthy. */
function isTruthy(value: string): boolean {
	return value !== "" && value !== "0" && value !== "false" && value !== "null" && value !== "undefined";
}

// ── Step execution ──────────────────────────────────────────────────

function ms(start: number, deps: ToolDeps): number {
	return deps.clock.ms() - start;
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

async function executeStepActions(
	step: JourneyStep,
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
): Promise<StepResult> {
	const start = deps.clock.ms();
	const actions: ActionResult[] = [];
	const timeout = step.timeout ?? opts.commandTimeout;

	// Apply per-step timeout via modified opts
	const stepOpts = timeout ? { ...opts, commandTimeout: timeout } : opts;

	for (const action of step.actions) {
		const result = await executeAction(action, tools, deps, stepOpts);
		actions.push(result);
		if (!result.success) {
			return {
				stepId: step.id,
				stepTitle: step.title,
				status: "fail",
				durationMs: ms(start, deps),
				actions,
				error: result.error,
			};
		}
	}

	return {
		stepId: step.id,
		stepTitle: step.title,
		status: "pass",
		durationMs: ms(start, deps),
		actions,
	};
}

/** Execute a step with retry support. */
async function executeStepWithRetry(
	step: JourneyStep,
	tools: Record<string, ToolExecutor>,
	deps: ToolDeps,
	opts: JourneyExecutorOptions,
): Promise<StepResult> {
	const maxAttempts = step.retry?.maxAttempts ?? 1;
	const delayMs = step.retry?.delayMs ?? 0;
	let lastResult: StepResult | null = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		lastResult = await executeStepActions(step, tools, deps, opts);

		if (lastResult.status === "pass") {
			if (attempt > 1) lastResult.retryAttempts = attempt - 1;
			return lastResult;
		}

		if (attempt < maxAttempts) {
			deps.log(`[journey]   ↻ Retry ${attempt}/${maxAttempts - 1} for "${step.title}" (delay: ${delayMs}ms)`);
			if (delayMs > 0) await deps.sleep(delayMs);
		}
	}

	lastResult!.retryAttempts = maxAttempts - 1;
	return lastResult!;
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

function skipResult(step: JourneyStep): StepResult {
	return { stepId: step.id, stepTitle: step.title, status: "skip", durationMs: 0, actions: [] };
}

function shouldSkipDueToFailure(step: JourneyStep, hasFailed: boolean, failCount: number, bail: number, continueOnFailure: boolean): StepResult | null {
	if (bail > 0 && failCount >= bail) return skipResult(step);
	if (hasFailed && !continueOnFailure) return skipResult(step);
	return null;
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
	let failCount = 0;
	const bail = opts.bail ?? 0;

	for (const stepOrRef of definition.steps) {
		if (isRefStep(stepOrRef)) {
			deps.log(`[journey] Skipping unresolved $ref: ${stepOrRef.$ref}`);
			continue;
		}

		const step = stepOrRef;
		const failSkip = shouldSkipDueToFailure(step, hasFailed, failCount, bail, continueOnFailure);
		if (failSkip) { results.push(failSkip); continue; }

		const skipCheck = shouldSkipStep(step, opts);
		if (skipCheck.skip) {
			deps.log(`[journey]   ○ ${step.title} (skipped: ${skipCheck.reason})`);
			results.push(skipResult(step));
			continue;
		}

		deps.log(`[journey] Step: ${step.title}`);
		const r = await executeStepWithRetry(step, tools, deps, opts);
		results.push(r);

		if (r.status === "fail") {
			hasFailed = true;
			failCount++;
			deps.log(`[journey]   ✗ ${step.title}: ${r.error}`);
		} else {
			const retryMsg = r.retryAttempts ? ` (${r.retryAttempts} retries)` : "";
			deps.log(`[journey]   ✓ ${step.title} (${r.durationMs}ms${retryMsg})`);
		}
	}

	return results;
}

// ── Journey sequencing ───────────────────────────────────────────────

/** Sort journeys by the configured sequencer strategy. */
export function sequenceJourneys(journeys: JourneyDefinition[], strategy: SequencerStrategy): JourneyDefinition[] {
	const sorted = [...journeys];
	switch (strategy) {
		case "risk-priority":
			sorted.sort((a, b) => {
				const aRisk = RISK_PRIORITY.indexOf(a.traceability?.risk ?? "low");
				const bRisk = RISK_PRIORITY.indexOf(b.traceability?.risk ?? "low");
				if (aRisk !== bRisk) return aRisk - bRisk;
				return (a.chapter ?? 999) - (b.chapter ?? 999);
			});
			break;
		case "alphabetical":
			sorted.sort((a, b) => a.journey.localeCompare(b.journey));
			break;
		case "chapter-order":
		default:
			sorted.sort((a, b) => (a.chapter ?? 999) - (b.chapter ?? 999));
			break;
	}
	return sorted;
}

/** Filter journeys by type. */
export function filterJourneysByType(journeys: JourneyDefinition[], types: string[]): JourneyDefinition[] {
	return journeys.filter((j) => j.type && types.includes(j.type));
}

/** Filter journeys by risk level. */
export function filterJourneysByRisk(journeys: JourneyDefinition[], risks: RiskLevel[]): JourneyDefinition[] {
	return journeys.filter((j) => j.traceability?.risk && risks.includes(j.traceability.risk));
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
	const start = deps.clock.ms();
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
		durationMs: ms(start, deps),
		steps: results,
		traceability: definition.traceability,
	};
}
