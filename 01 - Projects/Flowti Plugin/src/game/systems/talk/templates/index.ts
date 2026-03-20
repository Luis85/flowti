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
