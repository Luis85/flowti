/**
 * onboarding-tour-catalog.ts — Generates an Onboarding Tour Catalog reference.
 *
 * Documents all available tours with their steps, objectives,
 * and prerequisites.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { Tour, TourRegistry, TourStep } from "../../onboarding/onboarding-types.js";

// ── Generator ────────────────────────────────────────────────────────

const CONFIGS_DIR = "configs/onboarding";

export function generateOnboardingTourCatalog(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);

	const tours = loadTours(projectPath, deps);

	const totalSteps = tours.reduce((sum, t) => sum + t.steps.length, 0);

	const doc = Document.create("Onboarding Tour Catalog")
		.mergeFrontmatter({
			type: "OnboardingTourCatalog",
			date: deps.clock.iso(),
			tours: tours.length,
			totalSteps,
			tags: ["reference", "onboarding", "tours"],
		})
		.addBlank()
		.heading(1, "Onboarding Tour Catalog")
		.addBlank()
		.text(`${tours.length} tour(s) with ${totalSteps} total steps.`)
		.addBlank();

	if (tours.length === 0) {
		doc.text("No tours found. Define tours in `configs/onboarding/tours.json`.").addBlank();
	}

	appendTourOverview(doc, tours);
	appendTourDetails(doc, tours);

	const outputPath = svc.saveReference(doc, "Onboarding Tour Catalog.md");

	return {
		success: true,
		outputPath,
		metrics: { tours: tours.length, totalSteps },
	};
}

// ── Data loading ─────────────────────────────────────────────────────

function loadTours(projectPath: string, deps: ReportDeps): Tour[] {
	const registryPath = deps.paths.join(projectPath, CONFIGS_DIR, "tours.json");
	if (!deps.disk.existsSync(registryPath)) return [];

	let registry: TourRegistry;
	try {
		registry = JSON.parse(deps.disk.readFileSync(registryPath, "utf-8")) as TourRegistry;
	} catch {
		return [];
	}

	const tours: Tour[] = [];
	for (const entry of registry.tours) {
		const tourPath = deps.paths.join(projectPath, CONFIGS_DIR, entry.path);
		if (!deps.disk.existsSync(tourPath)) continue;
		try {
			const tour = JSON.parse(deps.disk.readFileSync(tourPath, "utf-8")) as Tour;
			tours.push(tour);
		} catch { /* skip invalid tour files */ }
	}
	return tours;
}

// ── Helpers ──────────────────────────────────────────────────────────

const STEP_TYPE_LABELS: Record<string, string> = {
	narrate: "Narration",
	prompt: "User Input",
	delegate: "Delegation",
	auto: "Automated",
	checkpoint: "Checkpoint",
};

function appendTourOverview(doc: Document, tours: Tour[]): void {
	if (tours.length === 0) return;

	doc.heading(2, "Tour Overview").addBlank();
	doc.table(
		["Tour", "Role", "Steps", "Description"],
		tours.map((t) => [
			t.name,
			t.role,
			String(t.steps.length),
			t.description,
		]),
	).addBlank();
}

function appendTourDetails(doc: Document, tours: Tour[]): void {
	for (const tour of tours) {
		doc.heading(2, tour.name).addBlank();
		doc.text(`**Role**: ${tour.role}`).addBlank();
		doc.text(tour.description).addBlank();

		appendStepTypes(doc, tour.steps);

		doc.heading(3, "Steps").addBlank();
		doc.table(
			["#", "Step", "Type", "Details"],
			tour.steps.map((step, i) => [
				String(i + 1),
				step.id,
				STEP_TYPE_LABELS[step.type] ?? step.type,
				stepDetails(step),
			]),
		).addBlank();
	}
}

function appendStepTypes(doc: Document, steps: readonly TourStep[]): void {
	const counts = new Map<string, number>();
	for (const step of steps) {
		counts.set(step.type, (counts.get(step.type) ?? 0) + 1);
	}

	doc.text("Step types: " + [...counts.entries()]
		.map(([type, count]) => `${STEP_TYPE_LABELS[type] ?? type} (${count})`)
		.join(", ")).addBlank();
}

function stepDetails(step: TourStep): string {
	switch (step.type) {
		case "prompt": return `Field: \`${step.field}\`${step.validation ? `, validation: ${step.validation}` : ""}`;
		case "delegate": return `Target: ${step.target}`;
		case "auto": return `Action: \`${step.action}\``;
		case "checkpoint": return `Label: ${step.label}`;
		default: return step.content;
	}
}
