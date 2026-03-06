/**
 * Event definitions for the Journey Executor domain.
 *
 * 4 execution lifecycle events covering run start, step completion,
 * run completion, and run failure.
 */

export interface JourneyExecutorEventMap {
	/** A journey run started. */
	"journey-executor.run.started": {
		journeyName: string;
		stepCount: number;
		dryRun: boolean;
	};

	/** A step completed during a journey run. */
	"journey-executor.run.step-completed": {
		journeyName: string;
		stepIndex: number;
		stepId: string;
		stepTitle: string;
		status: "pass" | "fail" | "skip";
		durationMs: number;
		error?: string;
	};

	/** A journey run completed (all steps finished). */
	"journey-executor.run.completed": {
		journeyName: string;
		totalSteps: number;
		passed: number;
		failed: number;
		skipped: number;
		durationMs: number;
	};

	/** A journey run failed (cancelled or fatal error). */
	"journey-executor.run.failed": {
		journeyName: string;
		reason: string;
	};
}
