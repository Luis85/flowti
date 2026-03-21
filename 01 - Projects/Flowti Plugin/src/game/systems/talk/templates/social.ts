/**
 * social.ts — Cross-agent social templates (barrel).
 *
 * Used when agents are near each other or have high charisma.
 * More playful, personality-driven, and contextual. The "conversation"
 * category provides lines suitable for back-and-forth exchanges.
 */

import type { TemplateSet } from "../talk-types.js";
import { socialGreetingCategories } from "./social-greetings.js";
import { socialConversationCategories } from "./social-conversations.js";

export const socialTemplates: TemplateSet = {
	domain: "social",
	categories: {
		...socialGreetingCategories,
		...socialConversationCategories,
	},
};
