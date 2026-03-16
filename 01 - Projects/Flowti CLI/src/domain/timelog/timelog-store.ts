/**
 * timelog-store.ts — CRUD operations for project time-log entries.
 *
 * Stores entries as markdown files with YAML frontmatter in docs/timelog/.
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toKebab } from "../make/naming.js";
import type { TimeLogConfig } from "../../infrastructure/types.js";
import type { TimeLogEntry, TimeLogSummary } from "./timelog-types.js";

export const timelogStore = createStore<TimeLogEntry, TimeLogEntry>({
	name: "timelog",
	defaultDir: "docs/timelog",
	configPath: "dir",
	typeTag: "TimeLog",
	needsClock: true,
	fields: {
		date: { type: "string", default: "" },
		person: { type: "string", default: "" },
		hours: { type: "number", default: 0 },
		category: { type: "string", default: "" },
		task: { type: "string", default: "" },
		description: { type: "string", default: "" },
	},
	filename: (def, deps) => {
		const datePart = def.date || (deps.clock ? deps.clock.iso().slice(0, 10) : "");
		return `${datePart}-${toKebab(def.person)}.md`;
	},
	sort: (a, b) => b.date.localeCompare(a.date),
	parseBody: (body) => ({ description: body.trim() }),
	buildBody: (def) => def.description ?? "",
});

export type TimeLogStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

export function createTimeLogEntry(deps: TimeLogStoreDeps, projectPath: string, entry: TimeLogEntry, config?: TimeLogConfig): string | null {
	const dir = timelogStore.resolveDir(deps, projectPath, config ? { dir: config.dir } : undefined);
	deps.disk.mkdirSync(dir, { recursive: true });

	const datePart = entry.date || deps.clock.iso().slice(0, 10);
	const personKebab = toKebab(entry.person);
	const baseFilename = `${datePart}-${personKebab}.md`;
	const basePath = deps.paths.join(dir, baseFilename);

	// Allow multiple entries per person per day — append suffix if needed
	let finalPath = basePath;
	let suffix = 1;
	while (deps.disk.existsSync(finalPath)) {
		finalPath = deps.paths.join(dir, `${datePart}-${personKebab}-${suffix}.md`);
		suffix++;
	}

	const category = entry.category || "general";
	const yamlLines = [
		`type: TimeLog`,
		`date: ${datePart}`,
		`person: ${entry.person}`,
		`hours: ${entry.hours}`,
		`category: ${category}`,
		`task: ${entry.task}`,
	];
	const body = entry.description ?? "";
	const content = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
	deps.disk.writeFileSync(finalPath, content, "utf-8");
	return finalPath;
}

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
