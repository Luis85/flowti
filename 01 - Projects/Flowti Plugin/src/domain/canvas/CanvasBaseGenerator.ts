/**
 * Canvas base file generator — creates .base index files for imported canvas folders.
 *
 * Ported from QuickAdd canvas-import-basefile.js.
 *
 * The .base format is used by the Obsidian Base plugin for filtered table views.
 *
 * Pure function:
 *   buildBaseFileContent()  — generate .base file YAML content
 *
 * I/O function:
 *   writeBaseFile()         — write .base file to vault
 */

import type { IFileSystemClient } from "../../infrastructure/filesystem/types";

// ── Types ────────────────────────────────────────────────────

/** Result of writing a .base file. */
export interface WriteBaseFileResult {
	action: "created" | "updated" | "skipped";
	path: string;
}

// ── Pure function ────────────────────────────────────────────

/**
 * Build the content for a .base index file.
 *
 * Generates a filter for markdown files in the target folder
 * and a table view grouped by type with all canvas frontmatter columns.
 */
export function buildBaseFileContent(folderPath: string): string {
	const safePath = (folderPath || "").replace(/"/g, '\\"');

	const lines = [
		"filters:",
		"  and:",
		`    - file.inFolder("${safePath}")`,
		'    - file.ext == "md"',
		"views:",
		"  - type: table",
		"    name: Imported Files",
		"    groupBy:",
		"      property: type",
		"      direction: ASC",
		"    order:",
		"      - file.name",
		"      - status",
		"      - type",
		"      - parent",
		"      - up",
		"      - down",
		"      - prev",
		"      - next",
		"      - original_type",
		"      - color",
		"      - shape",
		"      - source",
		"      - tags",
	];

	return lines.join("\n") + "\n";
}

// ── I/O function ─────────────────────────────────────────────

/**
 * Write a .base index file for the target folder.
 *
 * Path: `targetFolder/folderName.base`
 * Creates folders if needed. Skips existing unless overwrite is true.
 */
export async function writeBaseFile(
	targetFolder: string,
	fileSystem: IFileSystemClient,
	overwrite = false,
): Promise<WriteBaseFileResult> {
	const folderName = (targetFolder || "").split("/").pop() || "index";
	const path = `${targetFolder}/${folderName}.base`;
	const content = buildBaseFileContent(targetFolder);

	const exists = await fileSystem.fileExists(path);
	if (exists) {
		if (overwrite) {
			await fileSystem.updateFile(path, content);
			return { action: "updated", path };
		}
		return { action: "skipped", path };
	}

	await fileSystem.createFile(path, content, { createFolders: true });
	return { action: "created", path };
}
