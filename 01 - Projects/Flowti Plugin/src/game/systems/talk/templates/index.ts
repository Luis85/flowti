/**
 * index.ts — Template registry collecting all domain template sets.
 *
 * Provides a lookup map from domain name to TemplateSet, plus the
 * core and social sets which are used as fallbacks.
 */

import type { TemplateSet } from "../talk-types.js";
import { engineeringTemplates, qualityTemplates, operationsTemplates } from "./engineering.js";
import { designTemplates, analysisTemplates } from "./design.js";
import { productTemplates, managementTemplates, orchestrationTemplates } from "./product.js";

/** All domain-specific template sets, keyed by domain name. */
export const DOMAIN_TEMPLATES: ReadonlyMap<string, TemplateSet> = new Map<string, TemplateSet>([
	["engineering", engineeringTemplates],
	["quality", qualityTemplates],
	["operations", operationsTemplates],
	["design", designTemplates],
	["analysis", analysisTemplates],
	["product", productTemplates],
	["management", managementTemplates],
	["orchestration", orchestrationTemplates],
]);

/** Core templates — universal fallback for any agent. */
export { coreTemplates } from "./core.js";

/** Social templates — used when agents are near each other. */
export { socialTemplates } from "./social.js";

// Conversation scripts
export { RIVAL_SCRIPTS } from "./conversation-scripts-rival.js";
export { ACQUAINTANCE_SCRIPTS } from "./conversation-scripts-acquaintance.js";
export { COLLEAGUE_SCRIPTS } from "./conversation-scripts-colleague.js";
export { FRIEND_SCRIPTS } from "./conversation-scripts-friend.js";
export { BESTFRIEND_SCRIPTS } from "./conversation-scripts-bestfriend.js";
export { GOSSIP_SCRIPTS } from "./conversation-scripts-gossip.js";
export { DRAMA_SCRIPTS } from "./conversation-scripts-drama.js";
export { PET_CATALYST_SCRIPTS } from "./conversation-scripts-pet.js";

// Running jokes
export { RUNNING_JOKES } from "./running-jokes.js";

// Pet phrases
export { PET_INSTINCT_FRAGMENTS, PET_ELOQUENT_FRAGMENTS, PET_GREMLIN_FRAGMENTS } from "./pet-phrases.js";
export { PET_REACTIVE_PHRASES } from "./pet-reactive-phrases.js";
export { PET_PHRASE_CHAINS } from "./pet-phrase-chains.js";

// Composable fragments
export { ALL_FRAGMENT_POOLS } from "./fragment-pools.js";

// Tier modifiers
export { TIER_PREFIXES, TIER_SUFFIXES } from "./tier-modifiers.js";
