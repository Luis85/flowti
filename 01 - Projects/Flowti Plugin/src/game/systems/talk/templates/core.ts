/**
 * core.ts — Universal templates: filler, greetings, thinking, and waiting.
 *
 * These are the lowest-priority fallback templates used by any agent
 * regardless of domain. The "waiting" category is used when the agent
 * is processing a task or waiting for LLM response.
 */

import type { TemplateSet } from "../talk-types.js";

export const coreTemplates: TemplateSet = {
	domain: "core",
	categories: {
		filler: [
			{ template: "Hmm, let me think about that...", weight: 1, category: "filler" },
			{ template: "Interesting angle...", weight: 1, category: "filler" },
			{ template: "Getting somewhere with this", weight: 1, category: "filler" },
			{ template: "Okay, back to it", weight: 1, category: "filler" },
			{ template: "Deep focus mode", weight: 1, category: "filler" },
			{ template: "On it, one sec...", weight: 1, category: "filler" },
			{ template: "Processing...", weight: 1, category: "filler" },
			{ template: "Let me dig into this a bit more", weight: 1, category: "filler" },
		],
		thinking: [
			{ template: "Give me a moment to work through this...", weight: 1, category: "thinking" },
			{ template: "Good progress today, keep going", weight: 1, category: "thinking" },
			{ template: "Ah, that's clicking now", weight: 1, category: "thinking" },
			{ template: "Might need a coffee after this one", weight: 1, category: "thinking" },
			{ template: "This is the kind of problem I enjoy", weight: 1, category: "thinking" },
			{ template: "Okay, I see where this is going", weight: 1, category: "thinking" },
		],
		waiting: [
			{ template: "Still working on it, hang tight...", weight: 2, category: "waiting" },
			{ template: "Almost got something for you...", weight: 2, category: "waiting" },
			{ template: "Crunching through the details...", weight: 2, category: "waiting" },
			{ template: "Bear with me, this is a good one", weight: 1, category: "waiting" },
			{ template: "Formulating my thoughts...", weight: 2, category: "waiting" },
			{ template: "Hold on, pulling it together...", weight: 2, category: "waiting" },
			{ template: "This needs a bit more thought...", weight: 1, category: "waiting" },
			{ template: "Working through the nuances here", weight: 1, category: "waiting" },
			{ template: "Just a moment, I want to get this right", weight: 2, category: "waiting" },
			{ template: "Connecting the dots...", weight: 1, category: "waiting" },
		],
		greetings: [
			{ template: "Hey there! Ready when you are", weight: 1, category: "filler" },
			{ template: "Good to be here, what's on the agenda?", weight: 1, category: "filler" },
			{ template: "Morning! Let's make it a good one", weight: 1, category: "filler" },
		],
	},
};
