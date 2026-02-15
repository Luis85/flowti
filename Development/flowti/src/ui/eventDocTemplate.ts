/**
 * Re-export barrel for backward compatibility.
 *
 * All path resolution and content generation functions have moved to
 * `src/domain/docs/` to fix the DDD layer violation (domain importing from UI).
 *
 * UI consumers continue importing from this file — no changes needed.
 */

export type { EntityType } from "../domain/docs";

export {
	// Path resolution
	resolveEntityPath,
	getEventDocPathResolved,
	getDomainDocPathResolved,
	getArchitectureDocPathResolved,
	getServiceDocPathResolved,
	getServiceBlueprintPathResolved,
	getCategoryDocPathResolved,
	getFlowDocPathResolved,
	getSystemDocPathResolved,
	getActorDocPathResolved,
	getProductDocPathResolved,
	// Content generators
	generateEventDocContent,
	generateDomainDocContent,
	generateArchitectureDocContent,
	generateServiceDocContent,
	generateServiceBlueprintContent,
	generateCategoryDocContent,
	generateSystemDocContent,
	generateFlowDocContent,
	generateActorDocContent,
	generateProductDocContent,
} from "../domain/docs";
