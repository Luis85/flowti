/**
 * Lifecycle Journey Templates — 5 generator functions.
 *
 * Each returns a valid ExecutableJourney JSON structure
 * for a Development Lifecycle phase. Users can export and customize.
 */

import type { JourneyAction } from "./types";

interface TemplateStep {
	id: string;
	title: string;
	description: string;
	actions: JourneyAction[];
}

interface LifecycleTemplate {
	journey: string;
	type: string;
	feature: string;
	category: string;
	domain: string;
	steps: TemplateStep[];
}

/** Generate a Backlog Review journey template. */
export function generateBacklogReview(featureName: string): LifecycleTemplate {
	return {
		journey: `Backlog Review — ${featureName}`,
		type: "functional",
		feature: featureName,
		category: "lifecycle",
		domain: "process",
		steps: [
			{
				id: "open-hub",
				title: "Open Event Catalog",
				description: "Navigate to the Event Catalog hub",
				actions: [
					{ tool: "command", id: "flowti:open-event-catalog" },
					{ tool: "wait", ms: 500 },
				],
			},
			{
				id: "navigate-features",
				title: "Navigate to Features tab",
				description: "Open the Features tab to find the feature",
				actions: [
					{ tool: "navigate", path: "features" },
					{ tool: "wait", ms: 300 },
				],
			},
			{
				id: "verify-feature",
				title: "Verify feature exists",
				description: "Check that the feature appears in the master list",
				actions: [
					{ tool: "assert", type: "visible", selector: `[data-feature-name="${featureName}"]` },
				],
			},
			{
				id: "check-stage",
				title: "Verify feature stage",
				description: "Confirm the feature is in a reviewable stage",
				actions: [
					{ tool: "manual", instruction: `Verify that "${featureName}" is in idea or draft stage and has a PRD link` },
				],
			},
			{
				id: "screenshot",
				title: "Capture backlog state",
				description: "Take a screenshot of the feature detail for the review record",
				actions: [
					{ tool: "screenshot", label: `backlog-review-${featureName}` },
				],
			},
		],
	};
}

/** Generate a Planning journey template. */
export function generatePlanning(featureName: string): LifecycleTemplate {
	return {
		journey: `Planning — ${featureName}`,
		type: "functional",
		feature: featureName,
		category: "lifecycle",
		domain: "process",
		steps: [
			{
				id: "open-hub",
				title: "Open Event Catalog",
				description: "Navigate to the Event Catalog hub",
				actions: [
					{ tool: "command", id: "flowti:open-event-catalog" },
					{ tool: "wait", ms: 500 },
				],
			},
			{
				id: "check-fri",
				title: "Check FRI score",
				description: "Verify the feature has been scored",
				actions: [
					{ tool: "manual", instruction: `Check that "${featureName}" has an FRI score >= 11 (continuation threshold)` },
				],
			},
			{
				id: "check-gate",
				title: "Verify gate readiness",
				description: "Check gate check status for advancing to approved",
				actions: [
					{ tool: "manual", instruction: `Verify gate checks for "${featureName}" — PRD exists, FRI scored, dependencies identified` },
				],
			},
			{
				id: "screenshot",
				title: "Capture planning state",
				description: "Screenshot the feature detail showing gate status",
				actions: [
					{ tool: "screenshot", label: `planning-${featureName}` },
				],
			},
		],
	};
}

/** Generate a Development journey template. */
export function generateDevelopment(featureName: string): LifecycleTemplate {
	return {
		journey: `Development — ${featureName}`,
		type: "functional",
		feature: featureName,
		category: "lifecycle",
		domain: "process",
		steps: [
			{
				id: "open-test-hub",
				title: "Open Test Management Hub",
				description: "Navigate to the Test Management hub",
				actions: [
					{ tool: "command", id: "flowti:open-test-management" },
					{ tool: "wait", ms: 500 },
				],
			},
			{
				id: "check-journeys",
				title: "Verify test journeys exist",
				description: "Check that journeys are linked to the feature",
				actions: [
					{ tool: "manual", instruction: `Verify journeys linked to "${featureName}" in the Feature Quality tab` },
				],
			},
			{
				id: "run-tests",
				title: "Execute linked journeys",
				description: "Run all journeys linked to this feature",
				actions: [
					{ tool: "manual", instruction: `Run all journeys for "${featureName}" and verify pass rate` },
				],
			},
			{
				id: "screenshot",
				title: "Capture development state",
				description: "Screenshot showing test results",
				actions: [
					{ tool: "screenshot", label: `development-${featureName}` },
				],
			},
		],
	};
}

/** Generate a Testing journey template. */
export function generateTesting(featureName: string): LifecycleTemplate {
	return {
		journey: `Testing — ${featureName}`,
		type: "regression",
		feature: featureName,
		category: "lifecycle",
		domain: "process",
		steps: [
			{
				id: "open-test-hub",
				title: "Open Test Management Hub",
				description: "Navigate to the Test Management hub",
				actions: [
					{ tool: "command", id: "flowti:open-test-management" },
					{ tool: "wait", ms: 500 },
				],
			},
			{
				id: "check-pyramid",
				title: "Verify test pyramid",
				description: "Check coverage across test pyramid layers",
				actions: [
					{ tool: "navigate", path: "pyramid" },
					{ tool: "wait", ms: 300 },
					{ tool: "manual", instruction: "Verify test pyramid balance — unit > integration > e2e" },
				],
			},
			{
				id: "check-coverage",
				title: "Verify PRD coverage",
				description: "Check that PRD requirements are covered by journeys",
				actions: [
					{ tool: "navigate", path: "coverage" },
					{ tool: "wait", ms: 300 },
					{ tool: "manual", instruction: `Check PRD coverage for "${featureName}" — all FRs should have linked journeys` },
				],
			},
			{
				id: "run-regression",
				title: "Run regression suite",
				description: "Execute full regression test suite",
				actions: [
					{ tool: "manual", instruction: `Run regression journeys for "${featureName}" and verify 100% pass rate` },
				],
			},
			{
				id: "screenshot",
				title: "Capture testing state",
				description: "Screenshot showing coverage and pass rates",
				actions: [
					{ tool: "screenshot", label: `testing-${featureName}` },
				],
			},
		],
	};
}

/** Generate a Review journey template. */
export function generateReview(featureName: string): LifecycleTemplate {
	return {
		journey: `Review — ${featureName}`,
		type: "functional",
		feature: featureName,
		category: "lifecycle",
		domain: "process",
		steps: [
			{
				id: "open-catalog",
				title: "Open Event Catalog",
				description: "Navigate to the Event Catalog",
				actions: [
					{ tool: "command", id: "flowti:open-event-catalog" },
					{ tool: "wait", ms: 500 },
				],
			},
			{
				id: "check-compliance",
				title: "Verify process compliance",
				description: "Check that feature has high process compliance",
				actions: [
					{ tool: "manual", instruction: `Verify "${featureName}" shows >= 80% process compliance in the detail panel` },
				],
			},
			{
				id: "check-gate-review",
				title: "Verify review gate",
				description: "Check all review gate checks pass",
				actions: [
					{ tool: "manual", instruction: `Verify all gate checks for review stage pass for "${featureName}"` },
				],
			},
			{
				id: "create-review",
				title: "Create Three Amigos review",
				description: "Create the review document for the feature",
				actions: [
					{ tool: "manual", instruction: `Create Three Amigos review document for "${featureName}" and complete TASM scoring` },
				],
			},
			{
				id: "screenshot",
				title: "Capture review state",
				description: "Screenshot showing completed review",
				actions: [
					{ tool: "screenshot", label: `review-${featureName}` },
				],
			},
		],
	};
}

/** All lifecycle template generators. */
export const LIFECYCLE_TEMPLATES = [
	{ id: "backlog-review", label: "Backlog Review", generate: generateBacklogReview },
	{ id: "planning", label: "Planning", generate: generatePlanning },
	{ id: "development", label: "Development", generate: generateDevelopment },
	{ id: "testing", label: "Testing", generate: generateTesting },
	{ id: "review", label: "Review", generate: generateReview },
] as const;
