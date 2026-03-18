/**
 * social.ts — Cross-agent social templates.
 *
 * Used when agents are near each other or have high charisma.
 * More playful, personality-driven, and contextual.
 */

import type { TemplateSet } from "../talk-types.js";

export const socialTemplates: TemplateSet = {
	domain: "social",
	categories: {
		greeting: [
			{ template: "Hey, how's your sprint going?", weight: 2, category: "social" },
			{ template: "Nice work on that last commit!", weight: 2, category: "social" },
			{ template: "Great teamwork today, seriously", weight: 1, category: "social" },
			{ template: "You look like you're in the zone", weight: 1, category: "social" },
			{ template: "Glad we're on the same page now", weight: 1, category: "social" },
		],
		collaboration: [
			{ template: "Let's sync up after this — I have ideas", weight: 2, category: "social" },
			{ template: "Want to pair on this problem?", weight: 2, category: "social" },
			{ template: "Coffee break? I need to think away from the screen", weight: 1, category: "social" },
			{ template: "I found something that might help your work too", weight: 1, category: "social" },
			{ template: "Quick question before I go down this rabbit hole...", weight: 2, category: "social" },
		],
		interpolated: [
			{ template: "Hey {nearby_agent}, got a moment? Quick thought", weight: 2, category: "social" },
			{ template: "Nice approach, {nearby_agent}! Clean solution", weight: 2, category: "social" },
			{ template: "{nearby_agent} and I were just discussing this", weight: 1, category: "social" },
			{ template: "{nearby_agent}, you seeing the same thing I'm seeing?", weight: 1, category: "social" },
		],
	},
};
