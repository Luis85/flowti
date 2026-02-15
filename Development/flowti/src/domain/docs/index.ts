/**
 * Documentation domain — path resolution, content generation, and
 * centralized doc creation via DocService.
 *
 * Safe to import from any layer (domain, infrastructure, UI).
 */

export type { EntityType } from "./pathResolver";
export type { DocType, DocCreateRequest } from "./types";
export type { DocEventMap } from "./events";
export { DocService } from "./DocService";

export {
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
} from "./pathResolver";

export {
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
} from "./contentGenerator";
