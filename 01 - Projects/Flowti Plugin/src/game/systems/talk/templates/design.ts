/**
 * design.ts — Design domain templates.
 *
 * Covers design and analysis domains with domain-specific chatter lines.
 */

import type { TemplateSet } from "../talk-types.js";

export const designTemplates: TemplateSet = {
	domain: "design",
	categories: {
		thinking: [
			{ template: "The spacing feels off...", weight: 2, category: "thinking" },
			{ template: "Color contrast needs work", weight: 2, category: "thinking" },
			{ template: "This flow could be simpler", weight: 2, category: "thinking" },
			{ template: "Typography is key", weight: 1, category: "thinking" },
			{ template: "Less is more", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Users would expect this here", weight: 2, category: "personality" },
			{ template: "Wireframes coming along nicely", weight: 2, category: "personality" },
			{ template: "Accessibility first", weight: 1, category: "personality" },
			{ template: "Consistent icons everywhere", weight: 1, category: "personality" },
			{ template: "The grid is satisfying", weight: 2, category: "personality" },
		],
	},
};

export const analysisTemplates: TemplateSet = {
	domain: "analysis",
	categories: {
		thinking: [
			{ template: "The data tells a story...", weight: 2, category: "thinking" },
			{ template: "Interesting correlation here", weight: 2, category: "thinking" },
			{ template: "Hypothesis confirmed", weight: 1, category: "thinking" },
			{ template: "Anomaly detected...", weight: 2, category: "thinking" },
		],
		progress: [
			{ template: "Dashboards need updating", weight: 1, category: "personality" },
			{ template: "Sample size looks good", weight: 2, category: "personality" },
			{ template: "Time for A/B results", weight: 2, category: "personality" },
			{ template: "Funnel drop-off at step 3", weight: 1, category: "personality" },
			{ template: "Segmentation reveals patterns", weight: 1, category: "personality" },
			{ template: "Report ready for review", weight: 2, category: "personality" },
		],
	},
};
