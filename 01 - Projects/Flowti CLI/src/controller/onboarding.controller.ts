import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { VAULT_ROOT, PROJECTS_DIR } from "../infrastructure/config.js";
import { shouldOnboard, markOnboardingComplete, resetOnboarding } from "../domain/onboarding/onboarding-detection.js";
import { readProgress, resetProgress } from "../domain/onboarding/onboarding-store.js";
import type { OnboardingStatus, TourProgress } from "../domain/onboarding/onboarding-types.js";
import type { LogFn } from "../infrastructure/command-engine.js";

type StartModel = TourProgress | { started: false };
type SkipModel = { skipped: true };
type ResetModel = { reset: true };

function renderOnboardingStatus(data: OnboardingStatus, log: LogFn): void {
	if (data.isComplete) {
		log("  Onboarding: complete");
	} else if (data.activeTour) {
		log(`  Onboarding: in progress (${data.activeTour.tourId}, step ${data.activeTour.currentStepIndex})`);
	} else {
		log("  Onboarding: not started");
	}
}

function renderOnboardingStart(data: StartModel, log: LogFn): void {
	if ("tourId" in data) {
		log(`  Resuming tour: ${data.tourId} (step ${data.currentStepIndex})`);
		log("  Run Flowti interactively to continue the tour.");
	} else {
		log("  Run Flowti interactively to start the onboarding tour.");
	}
}

function renderOnboardingSkip(_data: SkipModel, log: LogFn): void {
	log("  Onboarding marked as complete.");
}

function renderOnboardingReset(_data: ResetModel, log: LogFn): void {
	log("  Onboarding reset. Run 'flowti' to start the tour.");
}

export const commands: Record<string, CommandHandler> = {
	"onboarding:status": adaptDescriptor<Record<string, unknown>, OnboardingStatus>({
		handler: (ctx) => {
			const onboard = shouldOnboard(VAULT_ROOT, PROJECTS_DIR, ctx.deps);
			const progress = readProgress(VAULT_ROOT, ctx.deps);
			return {
				isComplete: !onboard && !progress,
				activeTour: progress ?? undefined,
			};
		},
		renderer: renderOnboardingStatus,
	}),

	"onboarding:start": adaptDescriptor<Record<string, unknown>, StartModel>({
		handler: (ctx) => {
			const progress = readProgress(VAULT_ROOT, ctx.deps);
			if (progress) return progress;
			return { started: false };
		},
		renderer: renderOnboardingStart,
	}),

	"onboarding:skip": adaptDescriptor<Record<string, unknown>, SkipModel>({
		handler: (ctx) => {
			markOnboardingComplete(VAULT_ROOT, ctx.deps);
			return { skipped: true };
		},
		renderer: renderOnboardingSkip,
	}),

	"onboarding:restart": adaptDescriptor<Record<string, unknown>, ResetModel>({
		handler: (ctx) => {
			resetOnboarding(VAULT_ROOT, ctx.deps);
			resetProgress(VAULT_ROOT, ctx.deps);
			return { reset: true };
		},
		renderer: renderOnboardingReset,
	}),
};
