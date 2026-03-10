/**
 * scaffold.ts — Public facade for the scaffold domain.
 *
 * The scaffold domain creates new Flowti-compatible projects from
 * declarative JSON definitions. Each definition declares the full
 * project structure, dependencies, and CLI tool integration.
 */

export { commands } from "./scaffold-commands.js";
export { menu, scaffold, listDefinitions, loadAllDefinitionsFromProject, getKnownTemplateIds, BUNDLED_DEFINITIONS } from "./scaffold-service.js";
export type { ScaffoldOptions } from "./scaffold-service.js";
export type { ScaffoldDefinition, ScaffoldVariables, FileEntry } from "./scaffold-types.js";
export type { MarketplaceEntry, ImportResult } from "./marketplace.js";
export { buildMarketplaceListing, discoverLocalDefinitions, validateAndClassify, importDefinition, displayMarketplace, resolveDefinitionsDir } from "./marketplace.js";
