/**
 * social.ts — Cross-agent social templates.
 *
 * Used when agents are near each other or have high charisma.
 * Supports variable interpolation for nearby agent references.
 */

import type { TemplateSet } from "../talk-types.js";

export const socialTemplates: TemplateSet = {
	domain: "social",
	categories: {
		greeting: [
			{ template: "Hey, how's it going?", weight: 2, category: "social" },
			{ template: "Nice work on that!", weight: 2, category: "social" },
			{ template: "Great teamwork", weight: 1, category: "social" },
		],
		collaboration: [
			{ template: "Let's sync up later", weight: 2, category: "social" },
			{ template: "Shall we pair on this?", weight: 2, category: "social" },
			{ template: "Coffee break anyone?", weight: 1, category: "social" },
		],
		interpolated: [
			{ template: "Hey {nearby_agent}, got a sec?", weight: 2, category: "social" },
			{ template: "Nice one, {nearby_agent}!", weight: 2, category: "social" },
			{ template: "{nearby_agent} and I are on it", weight: 1, category: "social" },
		],
	},
};
