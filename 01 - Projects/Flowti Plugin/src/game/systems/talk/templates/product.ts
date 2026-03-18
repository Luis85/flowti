/**
 * product.ts — Product, management, and orchestration domain templates.
 *
 * Character-driven phrases for product managers, team leads,
 * delivery managers, and orchestration agents.
 */

import type { TemplateSet } from "../talk-types.js";

export const productTemplates: TemplateSet = {
	domain: "product",
	categories: {
		thinking: [
			{ template: "Stakeholders are going to love this... if we scope it right", weight: 2, category: "thinking" },
			{ template: "Scope is manageable — we can ship this iteration", weight: 2, category: "thinking" },
			{ template: "That's a solid MVP. Resist the urge to gold-plate", weight: 1, category: "thinking" },
			{ template: "Feature flag it first, measure, then decide", weight: 2, category: "thinking" },
			{ template: "What's the user story behind this request?", weight: 1, category: "thinking" },
			{ template: "The roadmap needs this win before Q3", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Backlog is prioritized and the team is aligned", weight: 2, category: "personality" },
			{ template: "User feedback just came in — lots of signal to work with", weight: 2, category: "personality" },
			{ template: "Release notes drafted. Marketing wants to see them", weight: 1, category: "personality" },
			{ template: "Key metrics are trending up. The strategy is working", weight: 2, category: "personality" },
			{ template: "Customer interview scheduled — keeping close to the problem", weight: 1, category: "personality" },
			{ template: "OKRs updated, we're tracking green on 3 of 4", weight: 1, category: "personality" },
		],
		waiting: [
			{ template: "Thinking about the strategic implications here...", weight: 2, category: "waiting" },
			{ template: "Weighing priorities against our roadmap...", weight: 2, category: "waiting" },
			{ template: "Let me consider the user impact carefully", weight: 2, category: "waiting" },
			{ template: "Aligning this with our product vision...", weight: 1, category: "waiting" },
			{ template: "Checking how this fits the bigger picture...", weight: 1, category: "waiting" },
		],
	},
};

export const managementTemplates: TemplateSet = {
	domain: "management",
	categories: {
		thinking: [
			{ template: "Cross-team sync needed — I'll set it up", weight: 2, category: "thinking" },
			{ template: "Capacity planning for next sprint... we're tight", weight: 2, category: "thinking" },
			{ template: "Risk register updated — one new amber item", weight: 1, category: "thinking" },
			{ template: "The team is in flow state. Protect that at all costs", weight: 1, category: "thinking" },
			{ template: "Impediment spotted. Let me clear it before standup", weight: 2, category: "thinking" },
		],
		progress: [
			{ template: "Team velocity is steady — no surprises this sprint", weight: 2, category: "personality" },
			{ template: "Sprint planning went smooth. Clear commitment from everyone", weight: 2, category: "personality" },
			{ template: "All blockers cleared. Shipping lane is open", weight: 2, category: "personality" },
			{ template: "One-on-ones done — everyone's in a good headspace", weight: 1, category: "personality" },
			{ template: "Budget is tracking. No surprises for finance", weight: 1, category: "personality" },
			{ template: "Retro action items are actually getting done this time", weight: 1, category: "personality" },
		],
		waiting: [
			{ template: "Reviewing the team's workload distribution...", weight: 2, category: "waiting" },
			{ template: "Checking for dependencies that could block us...", weight: 2, category: "waiting" },
			{ template: "Let me think about how to communicate this to stakeholders", weight: 1, category: "waiting" },
			{ template: "Considering the team dynamics here...", weight: 1, category: "waiting" },
		],
	},
};

export const orchestrationTemplates: TemplateSet = {
	domain: "orchestration",
	categories: {
		thinking: [
			{ template: "All dependencies resolved — ready to sequence", weight: 2, category: "thinking" },
			{ template: "The execution order matters here... thinking", weight: 2, category: "thinking" },
			{ template: "Integration point verified. Handshake complete", weight: 1, category: "thinking" },
			{ template: "Parallel lanes are syncing nicely", weight: 1, category: "thinking" },
		],
		progress: [
			{ template: "Coordinating across teams — everyone is in the loop", weight: 2, category: "personality" },
			{ template: "All agents reporting in. Status is green", weight: 2, category: "personality" },
			{ template: "The workflow is flowing. No bottlenecks", weight: 1, category: "personality" },
			{ template: "Clean handoff between phases. That's how it should be", weight: 2, category: "personality" },
			{ template: "Pipeline stages are aligned and ready", weight: 1, category: "personality" },
		],
		waiting: [
			{ template: "Coordinating the moving pieces...", weight: 2, category: "waiting" },
			{ template: "Making sure all the agents have what they need...", weight: 2, category: "waiting" },
			{ template: "Checking the execution sequence...", weight: 1, category: "waiting" },
			{ template: "Aligning the workflow stages... almost ready", weight: 1, category: "waiting" },
		],
	},
};
