/**
 * Frontmatter reading, parsing, and normalization utilities
 * used by catalog entity scanners and tabs.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { IVaultQueryService } from "../../../infrastructure/services/VaultQueryService";
import type { DiscoveredEvent } from "../../../domain/discovery/types";

/** Category label for discovered events without an assigned category */
export const UNCATEGORIZED_CATEGORY = "Uncategorized";

/** Returns true if the event type belongs to a user-discovered event (not a system catalog event). */
export function isDiscoveredEvent(
	eventType: string,
	discoveredEvents: DiscoveredEvent[],
): boolean {
	return discoveredEvents.some((d) => d.eventName === eventType);
}

export function readFrontmatter(vaultQuery: IVaultQueryService, path: string): Record<string, unknown> | undefined {
	return vaultQuery.getFrontmatter(path);
}

export function fmString(fm: Record<string, unknown> | undefined, key: string): string | undefined {
	const val = fm?.[key];
	return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

export function fmStringArray(fm: Record<string, unknown> | undefined, key: string): string[] {
	if (!fm) return [];
	const val = fm[key];
	if (!Array.isArray(val)) return [];
	return val.filter((v: unknown) => typeof v === "string") as string[];
}

export function normalizeDocFrontmatter(
	app: App,
	file: TFile,
	docType: string,
	nameField: string,
	name: string,
	metadata: { description: string; events?: string[]; domains: string[]; services: string[] },
): void {
	void app.fileManager.processFrontMatter(file, (fm) => {
		fm.type = docType;
		fm[nameField] = name;
		if (!fm.description) fm.description = metadata.description;
		fm.domains = metadata.domains;
		fm.services = metadata.services;
		if (metadata.events !== undefined) {
			fm.events = metadata.events;
		}
		if (!fm.created) fm.created = new Date().toISOString();
	});
}

// ─────────────────────────────────────────────────────────────
// Deferred normalization (TD-32: no writes during render)
// ─────────────────────────────────────────────────────────────

/** Describes a non-conforming file collected during a read-only scan. */
export interface NonConformingFile {
	file: TFile;
	docType: string;
	nameField: string;
	name: string;
	metadata: { description: string; events?: string[]; domains: string[]; services: string[] };
}

/** Tracks files already normalised this session to avoid repeated writes. */
const normalizedThisSession = new Set<string>();

/**
 * Normalizes non-conforming files, skipping any already normalised this session.
 * Call this after a read-only scan to apply writes outside the render path.
 */
export function normalizeNonConformingFiles(app: App, files: NonConformingFile[]): void {
	for (const f of files) {
		if (normalizedThisSession.has(f.file.path)) continue;
		normalizedThisSession.add(f.file.path);
		normalizeDocFrontmatter(app, f.file, f.docType, f.nameField, f.name, f.metadata);
	}
}

/** Resets the normalisation tracker (useful for testing). */
export function resetNormalizationTracker(): void {
	normalizedThisSession.clear();
}
