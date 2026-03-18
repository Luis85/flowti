/**
 * design.ts — Design and analysis domain templates.
 *
 * Covers UX design, visual design, data analysis, and research
 * with character-driven, contextual phrases.
 */

import type { TemplateSet } from "../talk-types.js";

export const designTemplates: TemplateSet = {
	domain: "design",
	categories: {
		thinking: [
			{ template: "The spacing feels off... let me eyeball this again", weight: 2, category: "thinking" },
			{ template: "Color contrast needs work — accessibility isn't optional", weight: 2, category: "thinking" },
			{ template: "This flow could be three steps instead of five", weight: 2, category: "thinking" },
			{ template: "Typography sets the entire tone. Getting this right matters", weight: 1, category: "thinking" },
			{ template: "Less is more, but not less than what's needed", weight: 1, category: "thinking" },
			{ template: "The user's eye should naturally flow left to right here", weight: 1, category: "thinking" },
			{ template: "Whitespace is a feature, not wasted space", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Users would definitely expect that interaction here", weight: 2, category: "personality" },
			{ template: "Wireframes are coming together — the story is clear now", weight: 2, category: "personality" },
			{ template: "Accessibility audit passed. Everyone gets to use this", weight: 1, category: "personality" },
			{ template: "The design system is paying dividends already", weight: 1, category: "personality" },
			{ template: "That grid alignment is *chef's kiss*", weight: 2, category: "personality" },
			{ template: "Prototyped three variants — let's test them", weight: 1, category: "personality" },
		],
		waiting: [
			{ template: "Sketching out a few approaches in my head...", weight: 2, category: "waiting" },
			{ template: "Thinking about the user journey holistically...", weight: 2, category: "waiting" },
			{ template: "Considering edge cases in the UI flow...", weight: 1, category: "waiting" },
			{ template: "Let me think about how this feels, not just how it looks", weight: 2, category: "waiting" },
			{ template: "Balancing aesthetics with usability here...", weight: 1, category: "waiting" },
		],
	},
};

export const analysisTemplates: TemplateSet = {
	domain: "analysis",
	categories: {
		thinking: [
			{ template: "The data is telling a story... let me listen", weight: 2, category: "thinking" },
			{ template: "Interesting correlation here, but correlation isn't causation", weight: 2, category: "thinking" },
			{ template: "Hypothesis confirmed — with statistical significance", weight: 1, category: "thinking" },
			{ template: "Anomaly detected... could be noise, could be signal", weight: 2, category: "thinking" },
			{ template: "The trend line is clear once you remove the outliers", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Sample size is solid, I trust these numbers", weight: 2, category: "personality" },
			{ template: "A/B results are in — variant B wins by 12%", weight: 2, category: "personality" },
			{ template: "Funnel analysis shows drop-off at step 3. Investigating", weight: 1, category: "personality" },
			{ template: "Segmentation reveals three distinct user cohorts", weight: 1, category: "personality" },
			{ template: "Report is ready for stakeholder review", weight: 2, category: "personality" },
		],
		waiting: [
			{ template: "Crunching the numbers, give me a moment...", weight: 2, category: "waiting" },
			{ template: "Running the analysis model... interesting early signals", weight: 2, category: "waiting" },
			{ template: "Cross-referencing with historical data...", weight: 1, category: "waiting" },
			{ template: "The pattern is emerging, let me quantify it", weight: 2, category: "waiting" },
		],
	},
};
