/**
 * Documentation domain — pure path resolution and content generation.
 *
 * Safe to import from any layer (domain, infrastructure, UI).
 */

export type { EntityType } from "./pathResolver";

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
	getEventDocPath,
	getDomainsFolderPath,
	getDomainDocPath,
	getArchitectureDocPath,
	getServicesFolderPath,
	getServiceDocPath,
	getServiceBlueprintPath,
	getCategoriesFolderPath,
	getCategoryDocPath,
	getSystemDocPath,
	getSystemsFolderPath,
	getFlowDocPath,
	getFlowsFolderPath,
	getActorDocPath,
	getActorsFolderPath,
	getProductDocPath,
	getProductsFolderPath,
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
