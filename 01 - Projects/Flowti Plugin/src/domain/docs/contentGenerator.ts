/**
 * Barrel re-export for all content generators.
 *
 * Split into focused modules:
 * - entityDocContent: EventDoc, DomainDoc, ServiceDoc, CategoryDoc
 * - architectureDocContent: ArchitectureDoc, ServiceBlueprintDoc
 * - simpleDocContent: SystemDoc, FlowDoc, ActorDoc, ProductDoc
 */

export { generateEventDocContent, generateDomainDocContent, generateServiceDocContent, generateCategoryDocContent } from "./entityDocContent";
export { generateArchitectureDocContent, generateServiceBlueprintContent } from "./architectureDocContent";
export { generateSystemDocContent, generateFlowDocContent, generateActorDocContent, generateProductDocContent } from "./simpleDocContent";
