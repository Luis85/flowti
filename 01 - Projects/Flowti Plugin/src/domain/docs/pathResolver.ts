/**
 * Pure path resolution functions for entity documentation files.
 *
 * No Obsidian or UI dependencies — safe to import from any layer.
 */

import type { EntityPathConfig } from "../settings/settings";

// ─────────────────────────────────────────────────────────────
// Entity types
// ─────────────────────────────────────────────────────────────

/** The supported documentation entity types within the vault. */
export type EntityType = "events" | "domains" | "services" | "categories" | "flows" | "systems" | "actors" | "products";

// ─────────────────────────────────────────────────────────────
// Entity path resolution
// ─────────────────────────────────────────────────────────────

/**
 * Resolves the vault-relative folder path for an entity type.
 * If overridePath is set, returns that directly.
 * Otherwise, combines docsRootPath with the subfolder name.
 */
export function resolveEntityPath(
	docsRootPath: string,
	config: EntityPathConfig,
): string {
	if (config.overridePath?.trim()) {
		return config.overridePath.trim().replace(/\/+$/, "");
	}
	const normalizedBase = docsRootPath.replace(/\/+$/, "");
	return `${normalizedBase}/${config.subfolder}`;
}

// ─────────────────────────────────────────────────────────────
// Resolved path functions (accept pre-resolved entity folder)
// ─────────────────────────────────────────────────────────────

export function getEventDocPathResolved(eventsFolder: string, eventType: string): string {
	return `${eventsFolder.replace(/\/+$/, "")}/${eventType}.md`;
}

export function getDomainDocPathResolved(domainsFolder: string, domain: string): string {
	return `${domainsFolder.replace(/\/+$/, "")}/${domain}.md`;
}

export function getArchitectureDocPathResolved(domainsFolder: string, domain: string): string {
	return `${domainsFolder.replace(/\/+$/, "")}/${domain}.architecture.md`;
}

export function getServiceDocPathResolved(servicesFolder: string, service: string): string {
	return `${servicesFolder.replace(/\/+$/, "")}/${service}.md`;
}

export function getServiceBlueprintPathResolved(servicesFolder: string, service: string): string {
	return `${servicesFolder.replace(/\/+$/, "")}/${service}.blueprint.md`;
}

export function getCategoryDocPathResolved(categoriesFolder: string, category: string): string {
	return `${categoriesFolder.replace(/\/+$/, "")}/${category}.md`;
}

export function getFlowDocPathResolved(flowsFolder: string, flow: string): string {
	return `${flowsFolder.replace(/\/+$/, "")}/${flow}.md`;
}

export function getSystemDocPathResolved(systemsFolder: string, system: string): string {
	return `${systemsFolder.replace(/\/+$/, "")}/${system}.md`;
}

export function getActorDocPathResolved(actorsFolder: string, actor: string): string {
	return `${actorsFolder.replace(/\/+$/, "")}/${actor}.md`;
}

export function getProductDocPathResolved(productsFolder: string, product: string): string {
	return `${productsFolder.replace(/\/+$/, "")}/${product}.md`;
}
