/**
 * Canvas importer — converts parsed canvas items to vault notes.
 *
 * Ported from QuickAdd canvas-import-notes.js.
 *
 * Architecture:
 *   Pure content functions (testable without mocks):
 *     toCanvasNotePath()       — build file path from item + hierarchy mode
 *     toCanvasNoteFrontmatter()— build frontmatter record with wikilinks
 *     toCanvasNoteContent()    — build full note (YAML frontmatter + body)
 *
 *   I/O function:
 *     writeCanvasNote()        — write single note with conflict strategy
 *
 *   Orchestrator:
 *     importCanvas()           — import all items with progress events
 */

import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { CanvasImportConfig, CanvasImportError, CanvasImportResult, CanvasItem } from "./types";
import { TYPE_FOLDER_MAP } from "./types";
import { slugifyTitle } from "./CanvasParser";

// ── Types ─────────────────────────────────────────────────────

/** Result of writing a single canvas note. */
export interface WriteCanvasNoteResult {
	action: "created" | "updated" | "skipped";
	path: string;
}

/** Dependencies for the import orchestrator. */
export interface CanvasImporterDeps {
	fileSystem: IFileSystemClient;
	emit: (type: string, payload: Record<string, unknown>) => Promise<void>;
}

// ── Pure content functions ────────────────────────────────────

/**
 * Walk the parentId chain to build a group-based folder path.
 * Returns segments joined by "/", e.g. "outer-group/inner-group".
 */
export function resolveGroupPath(item: CanvasItem, itemsById: Map<string, CanvasItem>): string {
	const segments: string[] = [];
	let currentId = item.parentId;
	const visited = new Set<string>();
	while (currentId && !visited.has(currentId)) {
		visited.add(currentId);
		const parent = itemsById.get(currentId);
		if (!parent || parent.originalType !== "group") break;
		segments.unshift(slugifyTitle(parent.title));
		currentId = parent.parentId;
	}
	return segments.join("/");
}

/**
 * Build the file path for a canvas note.
 *
 * In "flat" mode: `targetFolder/slug.md`
 * In "product" mode: `targetFolder/TypeFolder/slug.md`
 * In "group" mode: `targetFolder/groupPath/slug.md`
 */
export function toCanvasNotePath(
	item: CanvasItem,
	targetFolder: string,
	hierarchyMode: "flat" | "product" | "group",
	itemsById?: Map<string, CanvasItem>,
): string {
	const slug = slugifyTitle(item.title);
	if (hierarchyMode === "product") {
		const subfolder = TYPE_FOLDER_MAP[item.type] || "Other";
		return `${targetFolder}/${subfolder}/${slug}.md`;
	}
	if (hierarchyMode === "group" && itemsById) {
		const groupPath = resolveGroupPath(item, itemsById);
		// Groups place their note inside their own folder to avoid
		// a slug.md file conflicting with a slug/ folder for children.
		if (item.originalType === "group") {
			const ownFolder = groupPath ? `${groupPath}/${slug}` : slug;
			return `${targetFolder}/${ownFolder}/${slug}.md`;
		}
		return groupPath
			? `${targetFolder}/${groupPath}/${slug}.md`
			: `${targetFolder}/${slug}.md`;
	}
	return `${targetFolder}/${slug}.md`;
}

/**
 * Resolve an array of item IDs to Obsidian wikilinks.
 * IDs not found in the map are silently dropped.
 */
function resolveWikilinks(ids: string[], itemsById: Map<string, CanvasItem>): string[] {
	return ids
		.map(id => itemsById.get(id))
		.filter((item): item is CanvasItem => item != null)
		.map(item => `[[${slugifyTitle(item.title)}]]`);
}

/**
 * Build frontmatter record for a canvas note.
 * Relation arrays (up/down/prev/next) are resolved to wikilinks.
 */
export function toCanvasNoteFrontmatter(
	item: CanvasItem,
	canvasPath: string,
	itemsById: Map<string, CanvasItem>,
): Record<string, unknown> {
	const fm: Record<string, unknown> = {
		type: item.type,
		status: item.status,
		canvas_id: item.id,
	};

	// Resolve parent from parentId (group containment) using the items map
	if (item.parentId) {
		const parentItem = itemsById.get(item.parentId);
		if (parentItem) {
			fm.parent = `[[${slugifyTitle(parentItem.title)}]]`;
		}
	} else if (item.parent) {
		fm.parent = `[[${item.parent}]]`;
	}
	if (item.color) {
		fm.color = item.color;
	}

	const up = resolveWikilinks(item.up, itemsById);
	const down = resolveWikilinks(item.down, itemsById);
	const prev = resolveWikilinks(item.prev, itemsById);
	const next = resolveWikilinks(item.next, itemsById);

	if (up.length) fm.up = up;
	if (down.length) fm.down = down;
	if (prev.length) fm.prev = prev;
	if (next.length) fm.next = next;

	if (canvasPath) {
		fm.source = `[[${canvasPath}]]`;
	}

	return fm;
}

/** Escape a value for YAML output. */
function escapeYaml(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/**
 * Build full note content: YAML frontmatter + markdown body.
 */
export function toCanvasNoteContent(
	item: CanvasItem,
	canvasPath: string,
	itemsById: Map<string, CanvasItem>,
): string {
	const fm = toCanvasNoteFrontmatter(item, canvasPath, itemsById);

	const lines = ["---"];
	for (const [key, value] of Object.entries(fm)) {
		if (value == null) continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			lines.push(`${key}:`);
			for (const v of value) {
				lines.push(`  - "${escapeYaml(String(v))}"`);
			}
		} else {
			const str = String(value);
			const needsQuotes = /[:#{}[\],&*?|>!%@`\n]/.test(str);
			lines.push(needsQuotes ? `${key}: "${escapeYaml(str)}"` : `${key}: ${str}`);
		}
	}
	lines.push("---", "");

	const title = slugifyTitle(item.title);
	lines.push(`# ${title}`, "");

	return lines.join("\n");
}

// ── I/O function ──────────────────────────────────────────────

/**
 * Write a single canvas note with conflict resolution.
 *
 * Strategies:
 *   skip     — no-op if file exists
 *   update   — merge frontmatter, preserve body
 *   overwrite— replace entire file
 */
export async function writeCanvasNote(
	item: CanvasItem,
	config: Pick<CanvasImportConfig, "canvasPath" | "targetFolder" | "conflictStrategy" | "hierarchyMode">,
	fileSystem: IFileSystemClient,
	itemsById: Map<string, CanvasItem>,
): Promise<WriteCanvasNoteResult> {
	const path = toCanvasNotePath(item, config.targetFolder, config.hierarchyMode, itemsById);
	const exists = await fileSystem.fileExists(path);

	if (exists) {
		switch (config.conflictStrategy) {
			case "skip":
				return { action: "skipped", path };
			case "update":
				await fileSystem.updateFrontmatter(path, toCanvasNoteFrontmatter(item, config.canvasPath, itemsById));
				return { action: "updated", path };
			case "overwrite":
				await fileSystem.updateFile(path, toCanvasNoteContent(item, config.canvasPath, itemsById));
				return { action: "updated", path };
		}
	}

	await fileSystem.createFile(path, toCanvasNoteContent(item, config.canvasPath, itemsById), { createFolders: true });
	return { action: "created", path };
}

// ── Orchestrator ──────────────────────────────────────────────

/**
 * Import canvas items as vault notes.
 *
 * Iterates items, writes each as a note with conflict resolution,
 * emits progress events per node, and captures per-node errors
 * without aborting the entire import.
 */
export async function importCanvas(
	items: CanvasItem[],
	config: Pick<CanvasImportConfig, "canvasPath" | "targetFolder" | "conflictStrategy" | "hierarchyMode">,
	deps: CanvasImporterDeps,
): Promise<CanvasImportResult> {
	const startTime = Date.now();
	const errors: CanvasImportError[] = [];
	const importedPaths: Record<string, string> = {};
	let imported = 0;
	let skipped = 0;
	const itemsById = new Map(items.map(i => [i.id, i]));

	await deps.emit("canvas.import.started", {
		canvasPath: config.canvasPath,
		targetFolder: config.targetFolder,
		totalNodes: items.length,
	});

	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		try {
			const result = await writeCanvasNote(item, config, deps.fileSystem, itemsById);

			if (result.action === "skipped") {
				skipped++;
			} else {
				imported++;
				importedPaths[item.id] = result.path;
			}

			await deps.emit("canvas.import.progress", {
				canvasPath: config.canvasPath,
				current: i + 1,
				total: items.length,
				title: item.title,
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			errors.push({ nodeId: item.id, title: item.title, error: message });
		}
	}

	const result: CanvasImportResult = {
		canvasPath: config.canvasPath,
		targetFolder: config.targetFolder,
		totalNodes: items.length,
		imported,
		skipped,
		errors,
		duration: Date.now() - startTime,
		importedPaths,
	};

	if (errors.length > 0 && imported === 0) {
		await deps.emit("canvas.import.failed", {
			canvasPath: config.canvasPath,
			error: `All ${items.length} nodes failed to import`,
		});
	} else {
		await deps.emit("canvas.import.completed", { result });
	}

	return result;
}
