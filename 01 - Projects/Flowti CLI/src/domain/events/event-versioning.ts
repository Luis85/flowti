/**
 * event-versioning.ts — Event versioning support for the Flowti CLI.
 *
 * Handles version history sections in event markdown files,
 * and the `events:version` command to bump event versions.
 */

import type { ProjectContext } from "../../infrastructure/types.js";
import type { Document } from "../../infrastructure/document.js";
import type { EventDefinition } from "./event-catalog.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Types ──────────────────────────────────────────────────────────

export interface VersionEntry {
	version: string;
	date: string;
	migrationNotes?: string;
}

// ── Helpers ────────────────────────────────────────────────────────

function eventsDir(deps: Pick<CliDeps, "paths">, projectPath: string): string {
	return deps.paths.join(projectPath, "docs", "events");
}

/** Render a Version History section into a Document builder. */
export function renderVersionHistory(deps: Pick<CliDeps, "clock">, doc: Document, def: EventDefinition): void {
	doc.heading(2, "Version History").addBlank();
	doc.text(`- **v${def.version}** — ${deps.clock.iso().slice(0, 10)}`);
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
	deps: Pick<CliDeps, "clock">,
	content: string,
	newVersion: string,
	previousVersion: string,
	migrationNotes: string,
): string {
	const entry = `- **v${newVersion}** — ${deps.clock.iso().slice(0, 10)}\n  - Migrated from v${previousVersion}: ${migrationNotes}`;

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

export interface VersionEventResult {
	success: boolean;
	name: string;
	newVersion: string;
	previousVersion: string;
	error?: string;
}

/** Execute the events:version command. */
export function versionEvent(
	deps: Pick<CliDeps, "disk" | "paths" | "clock">,
	projectPath: string,
	name: string,
	newVersion: string,
	migrationNotes: string,
): VersionEventResult {
	const dir = eventsDir(deps, projectPath);
	if (!deps.disk.existsSync(dir)) {
		return { success: false, name, newVersion, previousVersion: "", error: "No events directory found." };
	}

	// Find the event file by scanning frontmatter
	const files = deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	let targetFile: string | null = null;
	let previousVersion = "1.0.0";

	for (const file of files) {
		const filePath = deps.paths.join(dir, file);
		const content = deps.disk.readFileSync(filePath, "utf-8");
		const nameMatch = content.match(/^name:\s*(.*)$/m);
		if (nameMatch && nameMatch[1].trim() === name) {
			targetFile = filePath;
			const versionMatch = content.match(/^version:\s*(.*)$/m);
			if (versionMatch) previousVersion = versionMatch[1].trim();
			break;
		}
	}

	if (!targetFile) {
		return { success: false, name, newVersion, previousVersion, error: `Event not found: ${name}` };
	}

	let content = deps.disk.readFileSync(targetFile, "utf-8");
	content = updateFrontmatterVersion(content, newVersion, previousVersion, migrationNotes);
	content = appendVersionHistory(deps, content, newVersion, previousVersion, migrationNotes);
	deps.disk.writeFileSync(targetFile, content, "utf-8");

	return { success: true, name, newVersion, previousVersion };
}

// ── Non-interactive command (legacy signature — will be moved to controller) ──

export const versionCommands: Record<string, (flags: Record<string, string | boolean>, rawArgs: string[], command?: string, project?: ProjectContext, deps?: Pick<CliDeps, "disk" | "paths" | "clock">) => VersionEventResult | undefined> = {
	"events:version": (flags, _rawArgs, _command, project, deps) => {
		if (!project || !deps) return undefined;
		const name = flags.name;
		const version = flags.version;
		const migration = flags.migration;

		if (!name || typeof name !== "string" || !version || typeof version !== "string") {
			return { success: false, name: "", newVersion: "", previousVersion: "", error: "Missing required flags. Usage: flowti events:version --name=\"user.created\" --version=\"2.0.0\" --migration=\"Added email field\"" };
		}

		const migrationNotes = typeof migration === "string" ? migration : "";
		return versionEvent(deps, project.path, name, version, migrationNotes);
	},
};
