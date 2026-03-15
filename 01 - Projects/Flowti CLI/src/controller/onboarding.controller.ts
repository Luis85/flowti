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
