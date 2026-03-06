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
} from "./types";
import { executeAction } from "./toolExecutors";
import { runPreview } from "../journeyBuilder/previewRunner";

/** Dependencies injected at construction time. */
export interface JourneyExecutorServiceDeps {
	eventBus: IEventBus;
	host: ToolHost;
	testManagementService: TestManagementService;
}

export class JourneyExecutorService {
	private eventBus: IEventBus;
	private host: ToolHost;
	private testManagementService: TestManagementService;
	private abortController: AbortController | null = null;
	private state: ExecutionState | null = null;

	constructor(deps: JourneyExecutorServiceDeps) {
		this.eventBus = deps.eventBus;
		this.host = deps.host;
		this.testManagementService = deps.testManagementService;
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

	async run(journey: ExecutableJourney, options: ExecutionOptions = {}): Promise<ExecutionResult> {
		if (this.isRunning()) {
			throw new Error("A journey is already running");
		}

		const dryRun = options.dryRun ?? false;
		const continueOnFailure = options.continueOnFailure ?? true;
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
			// Check cancellation before each step
			if (signal.aborted) {
				aborted = true;
				// Mark remaining steps as skipped
				for (let j = i; j < journey.steps.length; j++) {
					const skip: StepResult = {
						stepIndex: j,
						stepId: journey.steps[j].id,
						stepTitle: journey.steps[j].title,
						status: "skip",
						durationMs: 0,
					};
					this.state.stepResults.push(skip);
					void this.eventBus.emit("journey-executor.run.step-completed", {
						journeyName: journey.journey,
						stepIndex: j,
						stepId: journey.steps[j].id,
						stepTitle: journey.steps[j].title,
						status: "skip",
						durationMs: 0,
					});
				}
				break;
			}

			const step = journey.steps[i];
			this.state.currentStep = i;
			const stepStart = Date.now();
			let status: "pass" | "fail" = "pass";
			let error: string | undefined;

			for (const action of step.actions) {
				if (signal.aborted) {
					status = "fail";
					error = "Cancelled";
					break;
				}
				try {
					await executeAction(action, this.host, this.eventBus, variables, options);
				} catch (err) {
					status = "fail";
					error = err instanceof Error ? err.message : String(err);
					break; // Stop remaining actions in this step
				}
			}

			const stepResult: StepResult = {
				stepIndex: i,
				stepId: step.id,
				stepTitle: step.title,
				status,
				durationMs: Date.now() - stepStart,
				error,
			};
			this.state.stepResults.push(stepResult);

			void this.eventBus.emit("journey-executor.run.step-completed", {
				journeyName: journey.journey,
				stepIndex: i,
				stepId: step.id,
				stepTitle: step.title,
				status,
				durationMs: stepResult.durationMs,
				error,
			});

			if (status === "fail" && !continueOnFailure) {
				// Mark remaining as skipped
				for (let j = i + 1; j < journey.steps.length; j++) {
					const skip: StepResult = {
						stepIndex: j,
						stepId: journey.steps[j].id,
						stepTitle: journey.steps[j].title,
						status: "skip",
						durationMs: 0,
					};
					this.state.stepResults.push(skip);
					void this.eventBus.emit("journey-executor.run.step-completed", {
						journeyName: journey.journey,
						stepIndex: j,
						stepId: journey.steps[j].id,
						stepTitle: journey.steps[j].title,
						status: "skip",
						durationMs: 0,
					});
				}
				break;
			}
		}

		const durationMs = Date.now() - runStart;
		const passed = this.state.stepResults.filter((s) => s.status === "pass").length;
		const failed = this.state.stepResults.filter((s) => s.status === "fail").length;
		const skipped = this.state.stepResults.filter((s) => s.status === "skip").length;

		const result: ExecutionResult = {
			journeyName: journey.journey,
			totalSteps: journey.steps.length,
			passed,
			failed,
			skipped,
			durationMs,
			steps: [...this.state.stepResults],
		};

		if (aborted) {
			void this.eventBus.emit("journey-executor.run.failed", {
				journeyName: journey.journey,
				reason: "cancelled",
			});
		}

		void this.eventBus.emit("journey-executor.run.completed", {
			journeyName: journey.journey,
			totalSteps: journey.steps.length,
			passed,
			failed,
			skipped,
			durationMs,
		});

		// Record result in Test Management Hub
		this.testManagementService.recordRunResult(journey.journey, {
			totalSteps: journey.steps.length,
			passed,
			failed,
			skipped,
			durationMs,
			date: new Date().toISOString(),
		});

		this.state.running = false;
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
