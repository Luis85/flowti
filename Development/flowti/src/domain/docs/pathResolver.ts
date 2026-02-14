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

// ─────────────────────────────────────────────────────────────
// Legacy path functions (accept docsRootPath, build full path)
// ─────────────────────────────────────────────────────────────

export function getEventDocPath(basePath: string, eventType: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Events/${eventType}.md`;
}

export function getDomainsFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Domains`;
}

export function getDomainDocPath(basePath: string, domain: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Domains/${domain}.md`;
}

export function getArchitectureDocPath(basePath: string, domain: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Domains/${domain}.architecture.md`;
}

export function getServicesFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Services`;
}

export function getServiceDocPath(basePath: string, service: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Services/${service}.md`;
}

export function getServiceBlueprintPath(basePath: string, service: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Services/${service}.blueprint.md`;
}

export function getCategoriesFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Categories`;
}

export function getCategoryDocPath(basePath: string, category: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Categories/${category}.md`;
}

export function getSystemDocPath(basePath: string, system: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Systems/${system}.md`;
}

export function getSystemsFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Systems`;
}

export function getFlowDocPath(basePath: string, flow: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Flows/${flow}.md`;
}

export function getFlowsFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Flows`;
}

export function getActorDocPath(basePath: string, actor: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Actors/${actor}.md`;
}

export function getActorsFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Actors`;
}

export function getProductDocPath(basePath: string, product: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Products/${product}.md`;
}

export function getProductsFolderPath(basePath: string): string {
	const normalizedBase = basePath.replace(/\/+$/, "");
	return `${normalizedBase}/Products`;
}
