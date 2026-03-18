/**
 * engineering.ts — Engineering domain templates.
 *
 * Covers engineering, quality, and operations domains with
 * domain-specific chatter lines.
 */

import type { TemplateSet } from "../talk-types.js";

export const engineeringTemplates: TemplateSet = {
	domain: "engineering",
	categories: {
		thinking: [
			{ template: "This could use some refactoring...", weight: 2, category: "thinking" },
			{ template: "Let me trace this logic...", weight: 2, category: "thinking" },
			{ template: "That edge case though...", weight: 2, category: "thinking" },
			{ template: "Clean architecture matters", weight: 1, category: "thinking" },
			{ template: "Interesting pattern here...", weight: 2, category: "thinking" },
		],
		progress: [
			{ template: "Tests are green!", weight: 2, category: "personality" },
			{ template: "The build looks clean", weight: 2, category: "personality" },
			{ template: "Ship it!", weight: 1, category: "personality" },
			{ template: "Time to review that PR", weight: 2, category: "personality" },
			{ template: "Need to update the docs", weight: 1, category: "personality" },
		],
	},
};

export const qualityTemplates: TemplateSet = {
	domain: "quality",
	categories: {
		thinking: [
			{ template: "Found an edge case...", weight: 2, category: "thinking" },
			{ template: "This needs a test", weight: 2, category: "thinking" },
			{ template: "Coverage is improving", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Regression suite passed", weight: 2, category: "personality" },
			{ template: "Load test results are in", weight: 2, category: "personality" },
			{ template: "Bug triage complete", weight: 1, category: "personality" },
			{ template: "Smoke tests look good", weight: 2, category: "personality" },
			{ template: "Performance baseline set", weight: 1, category: "personality" },
			{ template: "Test data refreshed", weight: 1, category: "personality" },
			{ template: "Quality gates are green", weight: 2, category: "personality" },
		],
	},
};

export const operationsTemplates: TemplateSet = {
	domain: "operations",
	categories: {
		thinking: [
			{ template: "Alert thresholds adjusted", weight: 2, category: "thinking" },
			{ template: "Scaling config optimized", weight: 2, category: "thinking" },
			{ template: "Cost optimization opportunity", weight: 1, category: "thinking" },
			{ template: "Infrastructure as code", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Systems running smoothly", weight: 2, category: "personality" },
			{ template: "Deployment pipeline green", weight: 2, category: "personality" },
			{ template: "Monitoring dashboard updated", weight: 1, category: "personality" },
			{ template: "Incident response drilled", weight: 1, category: "personality" },
			{ template: "Backup verified", weight: 2, category: "personality" },
			{ template: "Latency looking good", weight: 2, category: "personality" },
		],
	},
};
