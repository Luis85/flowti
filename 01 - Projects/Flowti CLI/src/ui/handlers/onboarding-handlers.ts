import type { HandlerRegistry } from "../../infrastructure/handler-registry.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { VAULT_ROOT } from "../../infrastructure/config.js";
import { renderNarration, renderChecklist, renderHintBanner, renderTourSelection } from "../displays/onboarding-display.js";
import { readProgress, writeProgress, createInitialProgress } from "../../domain/onboarding/onboarding-store.js";
import { markOnboardingComplete } from "../../domain/onboarding/onboarding-detection.js";
import { processStep, advanceProgress } from "../../domain/onboarding/tour-engine.js";
import type { Tour, TourRegistry, CheckpointStep, StepResult, TourProgress, TourStep } from "../../domain/onboarding/onboarding-types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

type FsDeps = Pick<CliDeps, "disk" | "paths">;
type ActionDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "log" | "input">;

function loadTourRegistry(deps: FsDeps): TourRegistry {
	const content = deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "01 - Projects", "Flowti CLI", "configs", "onboarding", "tours.json"), "utf-8",
	);
	return JSON.parse(content) as TourRegistry;
}

function loadTour(tourPath: string, deps: FsDeps): Tour {
	const content = deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "01 - Projects", "Flowti CLI", "configs", "onboarding", tourPath), "utf-8",
	);
	return JSON.parse(content) as Tour;
}

function loadStepContent(tourDir: string, contentPath: string, deps: FsDeps): string {
	return deps.disk.readFileSync(
		deps.paths.join(VAULT_ROOT, "01 - Projects", "Flowti CLI", "configs", "onboarding", tourDir, contentPath), "utf-8",
	);
}

async function handleStepResult(result: StepResult, step: TourStep, progress: TourProgress, tour: Tour, deps: ActionDeps): Promise<MenuResult | undefined> {
	switch (result.kind) {
		case "narrate": {
			renderNarration(result, deps.log);
			await deps.input.waitForEnter();
			writeProgress(VAULT_ROOT, advanceProgress(progress, step.id), deps);
			return undefined;
		}
		case "prompt": {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, deps.log);
			const answer = await deps.input.ask(`  ${result.field}: `);
			if (result.validation === "non-empty" && !answer.trim()) {
				deps.log("  Please provide a value.");
				return undefined;
			}
			writeProgress(VAULT_ROOT, advanceProgress(progress, step.id, { [result.field]: answer.trim() }), deps);
			return undefined;
		}
		case "auto": {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, deps.log);
			await deps.input.waitForEnter();
			writeProgress(VAULT_ROOT, advanceProgress(progress, step.id), deps);
			return undefined;
		}
		case "delegate": {
			writeProgress(VAULT_ROOT, advanceProgress(progress, step.id), deps);
			return `navigate:${result.target}` as MenuResult;
		}
		case "checkpoint": {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, deps.log);
			const checklistItems = result.completedSteps.map((id) => ({
				id,
				label: (tour.steps.find((s) => s.id === id && s.type === "checkpoint") as CheckpointStep | undefined)?.label ?? id,
				completed: true,
			}));
			renderChecklist(checklistItems, deps.log);
			await deps.input.waitForEnter();
			writeProgress(VAULT_ROOT, advanceProgress(progress, step.id), deps);
			return undefined;
		}
		default:
			return undefined;
	}
}

export function registerOnboardingHandlers(registry: HandlerRegistry): void {
	registry.registerBeforeRender("onboarding:welcome", (ctx) => {
		const content = ctx.deps.disk.readFileSync(
			ctx.deps.paths.join(VAULT_ROOT, "01 - Projects", "Flowti CLI", "configs", "onboarding", "welcome.md"), "utf-8",
		);
		renderNarration({ speaker: "Alice", disposition: "strategic", content }, ctx.deps.log);
	});

	registry.registerAction("onboarding:select-tour", async (ctx) => {
		const reg = loadTourRegistry(ctx.deps);
		if (reg.tours.length === 1) {
			const tourId = reg.tours[0].id;
			const progress = createInitialProgress(tourId, ctx.deps);
			writeProgress(VAULT_ROOT, progress, ctx.deps);
			return `navigate:onboarding-tour` as MenuResult;
		}
		const tours = reg.tours.map((t) => {
			const tour = loadTour(t.path, ctx.deps);
			return { id: tour.id, name: tour.name, description: tour.description };
		});
		renderTourSelection(tours, ctx.deps.log);
		const choice = await ctx.deps.input.ask("Select a tour (number): ");
		const idx = parseInt(choice, 10) - 1;
		if (idx >= 0 && idx < tours.length) {
			const tourId = tours[idx].id;
			const progress = createInitialProgress(tourId, ctx.deps);
			writeProgress(VAULT_ROOT, progress, ctx.deps);
			return `navigate:onboarding-tour` as MenuResult;
		}
		return undefined;
	});

	registry.registerAction("onboarding:skip-tour", async (ctx) => {
		markOnboardingComplete(VAULT_ROOT, ctx.deps);
		ctx.deps.log("  Onboarding skipped. You can restart with: flowti onboarding:restart");
		return "start" as MenuResult;
	});

	registry.registerAction("onboarding:continue", async (ctx) => {
		const progress = readProgress(VAULT_ROOT, ctx.deps);
		if (!progress) return "start" as MenuResult;

		const reg = loadTourRegistry(ctx.deps);
		const tourEntry = reg.tours.find((t) => t.id === progress.tourId);
		if (!tourEntry) return "start" as MenuResult;

		const tour = loadTour(tourEntry.path, ctx.deps);
		const tourDir = `tours/${progress.tourId}`;

		if (progress.currentStepIndex >= tour.steps.length) {
			markOnboardingComplete(VAULT_ROOT, ctx.deps);
			return "start" as MenuResult;
		}

		const step = tour.steps[progress.currentStepIndex];
		const rawContent = loadStepContent(tourDir, step.content, ctx.deps);
		const hintsContent = step.type === "delegate" && step.hints
			? loadStepContent(tourDir, step.hints, ctx.deps)
			: undefined;

		const result = processStep(step, progress, rawContent, hintsContent);
		return handleStepResult(result, step, progress, tour, ctx.deps);
	});

	registry.registerView("onboarding-tour", async (ctx) => {
		const progress = readProgress(VAULT_ROOT, ctx.deps);
		if (!progress) return "start" as MenuResult;

		const reg = loadTourRegistry(ctx.deps);
		const tourEntry = reg.tours.find((t) => t.id === progress.tourId);
		if (!tourEntry) return "start" as MenuResult;

		const tour = loadTour(tourEntry.path, ctx.deps);

		if (progress.currentStepIndex >= tour.steps.length) {
			markOnboardingComplete(VAULT_ROOT, ctx.deps);
			return "start" as MenuResult;
		}

		const tourDir = `tours/${progress.tourId}`;
		const step = tour.steps[progress.currentStepIndex];
		const rawContent = loadStepContent(tourDir, step.content, ctx.deps);
		const result = processStep(step, progress, rawContent);

		if (result.kind === "narrate") {
			renderNarration(result, ctx.deps.log);
		} else if (result.kind === "prompt") {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
		} else if (result.kind === "checkpoint") {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
		} else if (result.kind === "auto") {
			renderNarration({ speaker: "Alice", disposition: "strategic", content: result.content }, ctx.deps.log);
		}
		return undefined;
	});

	registry.registerView("onboarding-checklist", async (ctx) => {
		const progress = readProgress(VAULT_ROOT, ctx.deps);
		if (!progress) {
			ctx.deps.log("  No active tour.");
			return "start" as MenuResult;
		}
		const reg = loadTourRegistry(ctx.deps);
		const tourEntry = reg.tours.find((t) => t.id === progress.tourId);
		if (!tourEntry) return "start" as MenuResult;
		const tour = loadTour(tourEntry.path, ctx.deps);
		const checkpoints = tour.steps.filter((s): s is CheckpointStep => s.type === "checkpoint");
		const items = checkpoints.map((cp) => ({
			id: cp.id,
			label: cp.label,
			completed: progress.completedSteps.includes(cp.id),
		}));
		renderChecklist(items, ctx.deps.log);
		await ctx.deps.input.waitForEnter();
		return undefined;
	});

	registry.registerBeforeRender("iteration-planning:onboarding-hint", (ctx) => {
		const onboarding = ctx.params?.onboarding as { tourId: string; stepId: string } | undefined;
		if (onboarding) {
			renderHintBanner(`${onboarding.tourId} tour`, ctx.deps.log);
		}
	});
}
