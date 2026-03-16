/**
 * onboarding-tour-loader.ts — Loads tour state for the onboarding tour page.
 *
 * Reads tour definition, progress, and current step content from disk.
 * Returns everything the page needs to render the current step.
 */

import type { LoaderContext } from "./loader-types.js";
import type { Tour, TourProgress, StepResult } from "../../domain/onboarding/onboarding-types.js";
import { readProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { processStep } from "../../domain/onboarding/tour-engine.js";

export interface OnboardingTourData {
	readonly tour?: Tour;
	readonly progress?: TourProgress;
	readonly stepIndex: number;
	readonly totalSteps: number;
	readonly stepResult?: StepResult;
	readonly error?: string;
}

export function loadOnboardingTour(ctx: LoaderContext): OnboardingTourData {
	const { deps, vaultRoot, projectPath } = ctx;
	const tourId = ctx.params.tourId ?? "project-manager";

	try {
		// Load tour registry
		const registryPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours.json");
		if (!deps.disk.existsSync(registryPath)) {
			return { stepIndex: 0, totalSteps: 0, error: "Tour registry not found." };
		}
		const registry = JSON.parse(deps.disk.readFileSync(registryPath, "utf-8"));
		const entry = registry.tours.find((t: { id: string }) => t.id === tourId);
		if (!entry) {
			return { stepIndex: 0, totalSteps: 0, error: `Tour "${tourId}" not found.` };
		}

		// Load tour definition
		const tourPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", entry.path);
		const tour: Tour = JSON.parse(deps.disk.readFileSync(tourPath, "utf-8"));

		// Load or create progress
		const savedProgress = readProgress(vaultRoot, deps);
		const progress = savedProgress && savedProgress.tourId === tourId
			? savedProgress
			: createInitialProgress(tourId, deps);

		const stepIndex = progress.currentStepIndex;
		const totalSteps = tour.steps.length;

		// Check if tour is complete
		if (stepIndex >= totalSteps) {
			return { tour, progress, stepIndex, totalSteps, stepResult: { kind: "complete", completedSteps: progress.completedSteps } };
		}

		// Process current step
		const step = tour.steps[stepIndex];
		const contentPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours", tourId, step.content);
		const rawContent = deps.disk.existsSync(contentPath) ? deps.disk.readFileSync(contentPath, "utf-8") : "";

		let hintsContent: string | undefined;
		if (step.type === "delegate" && step.hints) {
			const hintsPath = deps.paths.join(projectPath ?? vaultRoot, "configs", "onboarding", "tours", tourId, step.hints);
			hintsContent = deps.disk.existsSync(hintsPath) ? deps.disk.readFileSync(hintsPath, "utf-8") : undefined;
		}

		const stepResult = processStep(step, progress, rawContent, hintsContent);

		return { tour, progress, stepIndex, totalSteps, stepResult };
	} catch (err) {
		return { stepIndex: 0, totalSteps: 0, error: `Failed to load tour: ${err instanceof Error ? err.message : String(err)}` };
	}
}
