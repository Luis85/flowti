/**
 * Types for the Documentation domain.
 */

import type { EntityType } from "./pathResolver";

/** All supported documentation file types (frontmatter `type` values). */
export type DocType =
	// Catalog entity docs
	| "EventDoc"
	| "DomainDoc"
	| "ArchitectureDoc"
	| "ServiceDoc"
	| "ServiceBlueprintDoc"
	| "CategoryDoc"
	| "FlowDoc"
	| "SystemDoc"
	| "ActorDoc"
	| "ProductDoc"
	// Special docs
	| "AreaDoc"
	// Data exchange docs
	| "CsvDoc"
	| "PropertyDoc"
	| "ImportConfigDoc"
	| "ExportConfigDoc"
	| "PipelineConfigDoc"
	| "TypeDoc";

/**
 * Request payload for creating a documentation file.
 *
 * Callers can provide:
 * - Just `docType` + `name` + `entityType` — DocService resolves path and generates content
 * - `content` — bypasses content generator (for complex docs with context)
 * - `path` — bypasses path resolver (for non-standard locations like AreaDoc)
 * - `upsert: true` — updates the file if it already exists
 */
export interface DocCreateRequest {
	/** The documentation type (determines handler selection). */
	docType: DocType;
	/** The entity/item name (used for path resolution + content generation). */
	name: string;
	/** Pre-generated content (bypasses content generator). */
	content?: string;
	/** Pre-resolved path (bypasses path resolver). */
	path?: string;
	/** Entity type for path resolution via entityPaths settings. */
	entityType?: EntityType;
	/** Whether to update the file if it already exists (default: false). */
	upsert?: boolean;
	/** Source identifier for tracing (e.g. "FlowsTab", "ConfigDocService"). */
	source?: string;
}
