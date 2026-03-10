/**
 * knowledgebase.ts — Domain logic for the Flowti CLI knowledgebase.
 *
 * Pure domain checks only. Interactive menu is in ui/menus/knowledgebase-menu.ts.
 */

import { isCliAvailable, isVaultInitialized } from "./vault-service.js";

export function isKnowledgebaseAvailable(): boolean {
	return isCliAvailable() && isVaultInitialized();
}
