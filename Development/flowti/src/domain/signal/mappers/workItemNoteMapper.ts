/**
 * Transforms WorkItemMapping objects into vault notes.
 *
 * Pure functions for content generation + an I/O function for
 * writing notes with conflict resolution (skip / update / overwrite).
 */

import type { IFileSystemClient } from "../../../infrastructure/filesystem/types";
import type { SignalConfig, WorkItemMapping } from "../types";
import { htmlToMarkdown } from "./htmlToMarkdown";

// ── Path / filename helpers ───────────────────────────────────

const UNSAFE_CHARS = /[\\/:*?"<>|#^[\]]/g;
const MAX_TITLE_LENGTH = 80;

function sanitizeTitle(title: string): string {
	if (!title) return "Untitled";
	return title
		.replace(UNSAFE_CHARS, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_TITLE_LENGTH)
		.trimEnd();
}

export function toNotePath(mapping: WorkItemMapping, targetFolder: string): string {
	const title = sanitizeTitle(mapping.title);
	return `${targetFolder}/${mapping.id} - ${title}.md`;
}

// ── Content generation ────────────────────────────────────────

export function toNoteFrontmatter(mapping: WorkItemMapping, signalId: string): Record<string, unknown> {
	return {
		id: mapping.id,
		type: mapping.type,
		state: mapping.state,
		assignedTo: mapping.assignedTo,
		areaPath: mapping.areaPath,
		iterationPath: mapping.iterationPath,
		priority: mapping.priority,
		tags: mapping.tags,
		url: mapping.url,
		signalSource: signalId,
		lastSynced: new Date().toISOString(),
	};
}

export function toNoteContent(mapping: WorkItemMapping, signalId: string): string {
	const fm = toNoteFrontmatter(mapping, signalId);
	const tagsYaml = (fm.tags as string[]).length > 0
		? `tags:\n${(fm.tags as string[]).map(t => `  - "${t}"`).join("\n")}`
		: "tags: []";

	const frontmatter = [
		"---",
		`id: ${fm.id}`,
		`type: "${fm.type}"`,
		`state: "${fm.state}"`,
		`assignedTo: "${fm.assignedTo}"`,
		`areaPath: "${fm.areaPath}"`,
		`iterationPath: "${fm.iterationPath}"`,
		`priority: ${fm.priority}`,
		tagsYaml,
		`url: "${fm.url}"`,
		`signalSource: "${fm.signalSource}"`,
		`lastSynced: "${fm.lastSynced}"`,
		"---",
	].join("\n");

	const body = htmlToMarkdown(mapping.description);

	return `${frontmatter}\n\n# ${mapping.title}\n\n${body}`;
}

// ── File writing with conflict resolution ─────────────────────

export interface WriteNoteResult {
	action: "created" | "updated" | "skipped";
	path: string;
}

export async function writeWorkItemNote(
	mapping: WorkItemMapping,
	config: Pick<SignalConfig, "id" | "targetFolder" | "conflictStrategy">,
	fileSystem: IFileSystemClient,
): Promise<WriteNoteResult> {
	const path = toNotePath(mapping, config.targetFolder);
	const exists = await fileSystem.fileExists(path);

	if (exists) {
		switch (config.conflictStrategy) {
			case "skip":
				return { action: "skipped", path };
			case "update":
				await fileSystem.updateFrontmatter(path, toNoteFrontmatter(mapping, config.id));
				return { action: "updated", path };
			case "overwrite":
				await fileSystem.updateFile(path, toNoteContent(mapping, config.id));
				return { action: "updated", path };
		}
	}

	await fileSystem.createFile(path, toNoteContent(mapping, config.id), { createFolders: true });
	return { action: "created", path };
}
