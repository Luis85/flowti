/**
 * Event definitions for the Onboarding domain.
 *
 * 4 events covering the onboarding lifecycle:
 * - started: onboarding initialised after first install
 * - step.completed: a milestone was completed
 * - completed: all milestones done
 * - reset: onboarding state was reset from Settings
 */

export interface OnboardingEventMap {
	/** Onboarding initialised after first install */
	"onboarding.started": {
		startedAt: string;
	};

	/** A milestone was completed */
	"onboarding.step.completed": {
		milestone: string;
		completedCount: number;
		totalCount: number;
	};

	/** All milestones completed */
	"onboarding.completed": {
		completedAt: string;
		durationMs: number;
	};

	/** Onboarding state was reset from Settings */
	"onboarding.reset": Record<string, never>;
}
