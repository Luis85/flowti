/**
 * timelog-store.ts — CRUD operations for project time-log entries.
 *
 * Stores entries as markdown files with YAML frontmatter in docs/timelog/.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { TimeLogConfig } from "../../infrastructure/types.js";
import type { TimeLogEntry, TimeLogSummary } from "./timelog-types.js";
import { resolveDir, listMdFiles } from "../shared/markdown-store.js";

export type TimeLogStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

/** Resolve the time-log directory for a project. */
export function timelogDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: TimeLogConfig): string {
	return resolveDir(deps, projectPath, config?.dir, "docs/timelog");
}

/** List all time-log entries from the timelog directory. */
export function listTimeLogEntries(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: TimeLogConfig): TimeLogEntry[] {
	const dir = timelogDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const entries: TimeLogEntry[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		const bodyMatch = content.match(/^---[\s\S]*?---\s*([\s\S]*)/);
		entries.push({
			date: fm.date ?? "",
			person: fm.person ?? "",
			hours: parseFloat(fm.hours ?? "0"),
			category: fm.category ?? "",
			task: fm.task ?? "",
			description: bodyMatch ? bodyMatch[1].trim() : "",
		});
	}

	return entries.sort((a, b) => b.date.localeCompare(a.date));
}

/** Create a new time-log entry. Returns the file path or null on failure. */
export function createTimeLogEntry(deps: TimeLogStoreDeps, projectPath: string, entry: TimeLogEntry, config?: TimeLogConfig): string | null {
	const dir = timelogDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const datePart = entry.date || deps.clock.iso().slice(0, 10);
	const personKebab = toKebab(entry.person);
	const filename = `${datePart}-${personKebab}.md`;
	const filePath = deps.paths.join(dir, filename);

	// Allow multiple entries per person per day — append suffix if needed
	let finalPath = filePath;
	let suffix = 1;
	while (deps.disk.existsSync(finalPath)) {
		finalPath = deps.paths.join(dir, `${datePart}-${personKebab}-${suffix}.md`);
		suffix++;
	}

	const frontmatter: Record<string, string> = {
		type: "TimeLog",
		date: datePart,
		person: entry.person,
		hours: String(entry.hours),
		category: entry.category || "general",
		task: entry.task,
	};

	const doc = Document.create(`Time Log - ${entry.person}`)
		.mergeFrontmatter(frontmatter)
		.addBlank();

	if (entry.description) {
		doc.text(entry.description);
	}

	doc.save(finalPath, deps.disk);
	return finalPath;
}

/** Summarize time-log entries by person and category. */
export function summarizeTimeLog(entries: TimeLogEntry[]): TimeLogSummary {
	const byPerson: Record<string, number> = {};
	const byCategory: Record<string, number> = {};
	let totalHours = 0;

	for (const e of entries) {
		totalHours += e.hours;
		byPerson[e.person] = (byPerson[e.person] ?? 0) + e.hours;
		byCategory[e.category] = (byCategory[e.category] ?? 0) + e.hours;
	}

	return { totalHours, byPerson, byCategory, entries };
}
