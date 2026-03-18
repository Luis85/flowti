/**
 * core.ts — Universal templates: filler, greetings, and generic thinking.
 *
 * These are the lowest-priority fallback templates used by any agent
 * regardless of domain.
 */

import type { TemplateSet } from "../talk-types.js";

export const coreTemplates: TemplateSet = {
	domain: "core",
	categories: {
		filler: [
			{ template: "Hmm...", weight: 1, category: "filler" },
			{ template: "Interesting...", weight: 1, category: "filler" },
			{ template: "Almost there...", weight: 1, category: "filler" },
			{ template: "Back to it", weight: 1, category: "filler" },
			{ template: "Focus time", weight: 1, category: "filler" },
			{ template: "On it!", weight: 1, category: "filler" },
		],
		thinking: [
			{ template: "Let me think...", weight: 1, category: "thinking" },
			{ template: "Good progress today", weight: 1, category: "thinking" },
			{ template: "That works!", weight: 1, category: "thinking" },
			{ template: "Need a quick break soon", weight: 1, category: "thinking" },
		],
		greetings: [
			{ template: "Hey there!", weight: 1, category: "filler" },
			{ template: "Morning!", weight: 1, category: "filler" },
			{ template: "Good to be here", weight: 1, category: "filler" },
		],
	},
};
