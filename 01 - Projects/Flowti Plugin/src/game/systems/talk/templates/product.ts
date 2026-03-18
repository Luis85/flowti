/**
 * product.ts — Product and management domain templates.
 *
 * Covers product, management, and orchestration domains with
 * domain-specific chatter lines.
 */

import type { TemplateSet } from "../talk-types.js";

export const productTemplates: TemplateSet = {
	domain: "product",
	categories: {
		thinking: [
			{ template: "Stakeholders want this soon", weight: 2, category: "thinking" },
			{ template: "Scope looks manageable", weight: 2, category: "thinking" },
			{ template: "That's a good MVP scope", weight: 1, category: "thinking" },
			{ template: "Feature flag it first", weight: 2, category: "thinking" },
		],
		progress: [
			{ template: "Let's prioritize the backlog", weight: 2, category: "personality" },
			{ template: "User feedback is in", weight: 2, category: "personality" },
			{ template: "Release notes drafted", weight: 1, category: "personality" },
			{ template: "Metrics are trending up", weight: 2, category: "personality" },
			{ template: "Customer interview tomorrow", weight: 1, category: "personality" },
			{ template: "OKRs need updating", weight: 1, category: "personality" },
		],
	},
};

export const managementTemplates: TemplateSet = {
	domain: "management",
	categories: {
		thinking: [
			{ template: "Cross-team sync needed", weight: 2, category: "thinking" },
			{ template: "Capacity planning time", weight: 2, category: "thinking" },
			{ template: "Risk register updated", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Team velocity looks good", weight: 2, category: "personality" },
			{ template: "Sprint planning soon", weight: 2, category: "personality" },
			{ template: "Blockers cleared", weight: 2, category: "personality" },
			{ template: "One-on-ones scheduled", weight: 1, category: "personality" },
			{ template: "Budget looks on track", weight: 1, category: "personality" },
			{ template: "Good progress this week", weight: 2, category: "personality" },
			{ template: "Retro action items done", weight: 1, category: "personality" },
		],
	},
};

export const orchestrationTemplates: TemplateSet = {
	domain: "orchestration",
	categories: {
		thinking: [
			{ template: "Dependencies resolved", weight: 2, category: "thinking" },
			{ template: "Sequencing looks right", weight: 2, category: "thinking" },
			{ template: "Integration point verified", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Coordinating the teams", weight: 2, category: "personality" },
			{ template: "All agents reporting in", weight: 2, category: "personality" },
			{ template: "Workflow is flowing", weight: 1, category: "personality" },
			{ template: "Handoff complete", weight: 2, category: "personality" },
			{ template: "Sync meeting went well", weight: 1, category: "personality" },
			{ template: "Pipeline stages aligned", weight: 1, category: "personality" },
			{ template: "Everything on track", weight: 2, category: "personality" },
		],
	},
};
