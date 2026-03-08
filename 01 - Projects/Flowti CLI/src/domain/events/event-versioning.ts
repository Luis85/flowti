/**
 * event-versioning.ts — Event versioning support for the Flowti CLI.
 *
 * Handles version history sections in event markdown files,
 * and the `events:version` command to bump event versions.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { RESET, DIM, GREEN, RED } from "../../infrastructure/ui.js";
import { log } from "../../infrastructure/logger.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import type { Document } from "../../infrastructure/document.js";
import type { EventDefinition } from "./event-catalog.js";

// ── Types ──────────────────────────────────────────────────────────

export interface VersionEntry {
	version: string;
	date: string;
	migrationNotes?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function eventsDir(projectPath: string): string {
	return paths.join(projectPath, "docs", "events");
}

/** Render a Version History section into a Document builder. */
export function renderVersionHistory(doc: Document, def: EventDefinition): void {
	doc.heading(2, "Version History").addBlank();
	doc.text(`- **v${def.version}** — ${clock.iso().slice(0, 10)}`);
	if (def.previousVersion && def.migrationNotes) {
		doc.text(`  - Migrated from v${def.previousVersion}: ${def.migrationNotes}`);
	}
	doc.addBlank();
}

/** Update frontmatter fields for version in an existing markdown file. */
function updateFrontmatterVersion(
	content: string,
	newVersion: string,
	previousVersion: string,
	migrationNotes: string,
): string {
	// Update or add version field
	let updated = content.replace(
		/^(version:\s*).*$/m,
		`$1${newVersion}`,
	);

	// Add previous_version and migration_notes after version line
	const fmMatch = updated.match(/^---\n([\s\S]*?)\n---/);
	if (fmMatch) {
		let fm = fmMatch[1];
		// Remove old previous_version / migration_notes if present
		fm = fm.replace(/^previous_version:.*\n?/m, "");
		fm = fm.replace(/^migration_notes:.*\n?/m, "");
		// Add after version line
		fm = fm.replace(
			/^(version:\s*.*)$/m,
			`$1\nprevious_version: ${previousVersion}\nmigration_notes: ${migrationNotes}`,
		);
		updated = updated.replace(/^---\n[\s\S]*?\n---/, `---\n${fm}\n---`);
	}

	return updated;
}

/** Append a version entry to the Version History section, or create it. */
function appendVersionHistory(
	content: string,
	newVersion: string,
	previousVersion: string,
	migrationNotes: string,
): string {
	const entry = `- **v${newVersion}** — ${clock.iso().slice(0, 10)}\n  - Migrated from v${previousVersion}: ${migrationNotes}`;

	if (content.includes("## Version History")) {
		// Insert after the heading line
		return content.replace(
			/(## Version History\n\n?)/,
			`$1${entry}\n`,
		);
	}

	// Add before ## Related Components if it exists, otherwise append
	if (content.includes("## Related Components")) {
		return content.replace(
			/(## Related Components)/,
			`## Version History\n\n${entry}\n\n$1`,
		);
	}

	return content + `\n## Version History\n\n${entry}\n`;
}

/** Execute the events:version command. */
export function versionEvent(
	projectPath: string,
	name: string,
	newVersion: string,
	migrationNotes: string,
): boolean {
	const dir = eventsDir(projectPath);
	if (!disk.existsSync(dir)) {
		log(`\n  ${RED}No events directory found.${RESET}\n`);
		return false;
	}

	// Find the event file by scanning frontmatter
	const files = disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	let targetFile: string | null = null;
	let previousVersion = "1.0.0";

	for (const file of files) {
		const filePath = paths.join(dir, file);
		const content = disk.readFileSync(filePath, "utf-8");
		const nameMatch = content.match(/^name:\s*(.*)$/m);
		if (nameMatch && nameMatch[1].trim() === name) {
			targetFile = filePath;
			const versionMatch = content.match(/^version:\s*(.*)$/m);
			if (versionMatch) previousVersion = versionMatch[1].trim();
			break;
		}
	}

	if (!targetFile) {
		log(`\n  ${RED}Event not found:${RESET} ${name}\n`);
		return false;
	}

	let content = disk.readFileSync(targetFile, "utf-8");
	content = updateFrontmatterVersion(content, newVersion, previousVersion, migrationNotes);
	content = appendVersionHistory(content, newVersion, previousVersion, migrationNotes);
	disk.writeFileSync(targetFile, content, "utf-8");

	log(`\n  ${GREEN}✓${RESET} Updated ${name} to v${newVersion}`);
	log(`  ${DIM}Previous version: v${previousVersion}${RESET}\n`);
	return true;
}

// ── Non-interactive command ────────────────────────────────────────

export const versionCommands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext) => void> = {
	"events:version": (flags, _rawArgs, _command, project) => {
		if (!project) return;
		const name = flags.name;
		const version = flags.version;
		const migration = flags.migration;

		if (!name || typeof name !== "string" || !version || typeof version !== "string") {
			log(`\n  ${RED}Missing required flags.${RESET}`);
			log(`  ${DIM}Usage: flowti events:version --name="user.created" --version="2.0.0" --migration="Added email field"${RESET}\n`);
			return;
		}

		const migrationNotes = typeof migration === "string" ? migration : "";
		versionEvent(project.path, name, version, migrationNotes);
	},
};
