/**
 * Journey Executor domain service.
 *
 * Orchestrates in-app journey execution: runs steps sequentially,
 * dispatches actions via toolExecutors, tracks state, handles
 * cancellation, and records results in the TestManagementService.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { TestManagementService } from "../testManagement/TestManagementService";
import type {
	ToolHost,
	ExecutableJourney,
	ExecutionOptions,
	ExecutionResult,
	ExecutionState,
	StepResult,
	RetryConfig,
	FailedActionContext,
} from "./types";
import { executeAction } from "./toolExecutors";
import { evaluateStepCondition } from "./conditionEvaluator";
import { runPreview } from "../journeyBuilder/previewRunner";

/** Dependencies injected at construction time. */
export interface JourneyExecutorServiceDeps {
	eventBus: IEventBus;
	host: ToolHost;
	testManagementService: TestManagementService;
	/** Injectable delay function for testing. Defaults to real setTimeout. */
	delayFn?: (ms: number) => Promise<void>;
}

export class JourneyExecutorService {
	private eventBus: IEventBus;
	private host: ToolHost;
	private testManagementService: TestManagementService;
	private delayFn: (ms: number) => Promise<void>;
	private abortController: AbortController | null = null;
	private state: ExecutionState | null = null;

	constructor(deps: JourneyExecutorServiceDeps) {
		this.eventBus = deps.eventBus;
		this.host = deps.host;
		this.testManagementService = deps.testManagementService;
		this.delayFn = deps.delayFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
	}

	// ── Queries ──────────────────────────────────────────────

	isRunning(): boolean {
		return this.state?.running === true;
	}

	getExecutionState(): ExecutionState | null {
		return this.state ? { ...this.state, stepResults: [...this.state.stepResults] } : null;
	}

	// ── Validation ───────────────────────────────────────────

	validateJourney(journey: ExecutableJourney): { valid: boolean; errors: string[] } {
		const steps = journey.steps.map((s) => ({
			id: s.id,
			title: s.title,
			actions: s.actions,
		}));
		const result = runPreview(steps);
		const errors = result.steps.flatMap((s) => s.errors);
		return { valid: errors.length === 0, errors };
	}

	// ── Execution ────────────────────────────────────────────

	/** Evaluate step condition; push a skip result and return true if step should be skipped. */
	private shouldSkipStep(
		step: ExecutableJourney["steps"][number],
		variables: Record<string, string>,
		journeyName: string,
		stepIndex: number,
	): boolean {
		if (!step.condition) return false;
		const condResult = evaluateStepCondition(step.condition, variables);
		if (condResult.shouldRun) return false;

		const skipResult: StepResult = {
			stepIndex, stepId: step.id, stepTitle: step.title,
			status: "skip", durationMs: 0, error: condResult.reason,
		};
		this.state!.stepResults.push(skipResult);
		void this.eventBus.emit("journey-executor.run.step-completed", {
			journeyName, stepIndex, stepId: step.id,
			stepTitle: step.title, status: "skip", durationMs: 0, error: condResult.reason,
		});
		return true;
	}

	/** Mark steps from startIndex..end as skipped and emit events. */
	private skipRemainingSteps(journeyName: string, steps: ExecutableJourney["steps"], startIndex: number): void {
		for (let j = startIndex; j < steps.length; j++) {
			const skip: StepResult = {
				stepIndex: j,
				stepId: steps[j].id,
				stepTitle: steps[j].title,
				status: "skip",
				durationMs: 0,
			};
			this.state!.stepResults.push(skip);
			void this.eventBus.emit("journey-executor.run.step-completed", {
				journeyName,
				stepIndex: j,
				stepId: steps[j].id,
				stepTitle: steps[j].title,
				status: "skip",
				durationMs: 0,
			});
		}
	}

	/** Execute a single step's actions with retry logic. */
	private async executeStepWithRetry(
		step: ExecutableJourney["steps"][number],
		signal: AbortSignal,
		variables: Record<string, string>,
		options: ExecutionOptions,
		retryConfig: RetryConfig | undefined,
	): Promise<{ status: "pass" | "fail"; error?: string; failedAction?: FailedActionContext; retryAttempts: number }> {
		const maxRetries = retryConfig?.maxRetries ?? 0;
		let retryAttempts = 0;

		for (let attempt = 0; attempt <= maxRetries; attempt++) {
			let status: "pass" | "fail" = "pass";
			let error: string | undefined;
			let failedAction: FailedActionContext | undefined;

			for (let ai = 0; ai < step.actions.length; ai++) {
				const action = step.actions[ai];
				if (signal.aborted) {
					return { status: "fail", error: "Cancelled", retryAttempts };
				}
				try {
					await executeAction(action, this.host, this.eventBus, variables, options);
				} catch (err) {
					status = "fail";
					error = err instanceof Error ? err.message : String(err);
					failedAction = { tool: action.tool, actionIndex: ai, params: extractKeyParams(action) };
					break;
				}
			}

			if (status === "pass" || signal.aborted || attempt === maxRetries) {
				return { status, error, failedAction, retryAttempts };
			}

			retryAttempts = attempt + 1;
			void this.eventBus.emit("journey-executor.run.step-retried", {
				journeyName: this.state!.journeyName,
				stepIndex: this.state!.currentStep,
				stepId: step.id,
				stepTitle: step.title,
				attempt: retryAttempts,
				maxRetries,
				error: error ?? "Unknown error",
			});

			const delay = retryConfig!.backoff === "exponential"
				? retryConfig!.delayMs * Math.pow(2, attempt)
				: retryConfig!.delayMs;
			await this.delayFn(delay);
		}

		return { status: "pass", retryAttempts: 0 };
	}

	async run(journey: ExecutableJourney, options: ExecutionOptions = {}): Promise<ExecutionResult> {
		if (this.isRunning()) {
			throw new Error("A journey is already running");
		}

		const dryRun = options.dryRun ?? false;
		const continueOnFailure = options.continueOnFailure ?? true;
		const globalRetryCount = options.retryCount ?? 0;
		const globalRetryDelayMs = options.retryDelayMs ?? 100;
		const variables: Record<string, string> = { ...(options.variables ?? {}) };

		this.abortController = new AbortController();
		const signal = this.abortController.signal;

		this.state = {
			journeyName: journey.journey,
			totalSteps: journey.steps.length,
			currentStep: 0,
			stepResults: [],
			running: true,
			dryRun,
		};

		const runStart = Date.now();

		void this.eventBus.emit("journey-executor.run.started", {
			journeyName: journey.journey,
			stepCount: journey.steps.length,
			dryRun,
		});

		let aborted = false;

		for (let i = 0; i < journey.steps.length; i++) {
			if (signal.aborted) {
				aborted = true;
				this.skipRemainingSteps(journey.journey, journey.steps, i);
				break;
			}

			const step = journey.steps[i];
			this.state.currentStep = i;
			const stepStart = Date.now();

			// Evaluate step condition (skipIf / runIf)
			if (this.shouldSkipStep(step, variables, journey.journey, i)) {
				continue;
			}

			const retryConfig = resolveRetryConfig(step.retry, globalRetryCount, globalRetryDelayMs);

			const stepOutcome = await this.executeStepWithRetry(step, signal, variables, options, retryConfig);

			const stepResult: StepResult = {
				stepIndex: i, stepId: step.id, stepTitle: step.title,
				status: stepOutcome.status,
				durationMs: Date.now() - stepStart,
				error: stepOutcome.error,
				retryAttempts: stepOutcome.retryAttempts > 0 ? stepOutcome.retryAttempts : undefined,
				failedAction: stepOutcome.failedAction,
			};
			this.state.stepResults.push(stepResult);

			void this.eventBus.emit("journey-executor.run.step-completed", {
				journeyName: journey.journey, stepIndex: i, stepId: step.id,
				stepTitle: step.title, status: stepOutcome.status,
				durationMs: stepResult.durationMs, error: stepOutcome.error,
			});

			if (stepOutcome.status === "fail" && !continueOnFailure) {
				this.skipRemainingSteps(journey.journey, journey.steps, i + 1);
				break;
			}
		}

		return this.finalizeRun(journey, runStart, aborted);
	}

	/** Build the final result, emit completion events, and clean up state. */
	private finalizeRun(journey: ExecutableJourney, runStart: number, aborted: boolean): ExecutionResult {
		const durationMs = Date.now() - runStart;
		const passed = this.state!.stepResults.filter((s) => s.status === "pass").length;
		const failed = this.state!.stepResults.filter((s) => s.status === "fail").length;
		const skipped = this.state!.stepResults.filter((s) => s.status === "skip").length;

		const result: ExecutionResult = {
			journeyName: journey.journey,
			totalSteps: journey.steps.length,
			passed, failed, skipped, durationMs,
			steps: [...this.state!.stepResults],
		};

		if (aborted) {
			void this.eventBus.emit("journey-executor.run.failed", {
				journeyName: journey.journey, reason: "cancelled",
			});
		}

		void this.eventBus.emit("journey-executor.run.completed", {
			journeyName: journey.journey,
			totalSteps: journey.steps.length,
			passed, failed, skipped, durationMs,
		});

		this.testManagementService.recordRunResult(journey.journey, {
			totalSteps: journey.steps.length,
			passed, failed, skipped, durationMs,
			date: new Date().toISOString(),
		});

		this.state!.running = false;
		this.abortController = null;

		return result;
	}

	cancel(): void {
		this.abortController?.abort();
	}

	dispose(): void {
		this.cancel();
		this.state = null;
	}
}

// ── Helpers ─────────────────────────────────────────────────

/** Resolve retry config: per-step overrides global. */
function resolveRetryConfig(
	stepRetry: RetryConfig | undefined,
	globalRetryCount: number,
	globalRetryDelayMs: number,
): RetryConfig | undefined {
	if (stepRetry) return stepRetry;
	if (globalRetryCount > 0) return { maxRetries: globalRetryCount, delayMs: globalRetryDelayMs };
	return undefined;
}

/** Extracts key display-worthy parameters from an action for error context. */
function extractKeyParams(action: Record<string, unknown>): Record<string, string> | undefined {
	const params: Record<string, string> = {};
	const keys = ["id", "selector", "path", "event", "message", "url"];
	for (const key of keys) {
		if (key in action && typeof action[key] === "string") {
			params[key] = action[key] as string;
		}
	}
	return Object.keys(params).length > 0 ? params : undefined;
}
