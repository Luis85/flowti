/**
 * knowledgebase.ts — Domain logic for the Flowti CLI knowledgebase.
 *
 * Pure domain checks only. Interactive menu is in ui/menus/knowledgebase-menu.ts.
 */

import { isCliAvailable, isVaultInitialized } from "./vault-service.js";
import type { CliDeps } from "../../infrastructure/deps.js";

export function isKnowledgebaseAvailable(deps: Pick<CliDeps, "disk" | "paths" | "shell">): boolean {
	return isCliAvailable(deps) && isVaultInitialized(deps);
}
