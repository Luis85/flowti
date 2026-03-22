/**
 * pet-domain-templates.ts — TalkEngine domain templates for pets (`domain: "pet"`).
 *
 * Pulls inner-monologue fragments into weighted pools so resolveDomainPhrase
 * and tier/social fallbacks have pet-flavoured lines, not only core templates.
 */

import type { TemplateSet, WeightedTemplate } from "../talk-types.js";
import { PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS } from "./pet-phrases.js";

function asThinking(fragments: readonly string[]): WeightedTemplate[] {
	return fragments.map((template) => ({ template, weight: 1, category: "thinking" as const }));
}

/** Flat pool used as domain "thinking" lines for registered pet chatterers. */
export const petDomainTemplates: TemplateSet = {
	domain: "pet",
	categories: {
		thinking: [
			...asThinking(PET_INSTINCT_FRAGMENTS),
			...asThinking(PET_ELOQUENT_FRAGMENTS),
			...asThinking(PET_GREMLIN_FRAGMENTS),
		],
		waiting: [],
		social: [],
		personality: [],
		filler: [],
	},
};
