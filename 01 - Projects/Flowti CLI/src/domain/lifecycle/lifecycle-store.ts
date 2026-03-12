/**
 * lifecycle-store.ts — CRUD operations for lifecycle items.
 *
 * Stores lifecycle state as markdown files with YAML frontmatter.
 * Transition history is tracked as a markdown table in the body.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { EntityType, LifecycleState, LifecycleTransitionRecord } from "../../infrastructure/types.js";
import type { LifecycleRecord, LifecycleSummary, TransitionResult } from "./lifecycle-types.js";
import { getTemplate, validateTransition } from "./lifecycle-engine.js";
import { resolveDir } from "../shared/markdown-store.js";

export type LifecycleStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Directory resolution ────────────────────────────────────────────

/** Resolve the lifecycle directory for nested items within a project. */
export function lifecycleDir(deps: Pick<CliDeps, "paths">, basePath: string, subdir?: string): string {
	return resolveDir(deps, basePath, subdir, ".");
}

// ── Helpers ─────────────────────────────────────────────────────────

function lifecycleFilePath(deps: Pick<CliDeps, "paths">, basePath: string, name: string, subdir?: string): string {
	const dir = lifecycleDir(deps, basePath, subdir);
	return deps.paths.join(dir, toKebab(name), "lifecycle.md");
}

function listItemDirs(deps: Pick<CliDeps, "disk" | "paths">, basePath: string, subdir?: string): string[] {
	const dir = lifecycleDir(deps, basePath, subdir);
	if (!deps.disk.existsSync(dir)) return [];
	return deps.disk.readdirSync(dir).filter((f: string) => {
		const itemDir = deps.paths.join(dir, f);
		try {
			const stat = deps.disk.statSync(itemDir);
			return stat.isDirectory();
		} catch { return false; }
	});
}

function parseHistory(body: string): LifecycleTransitionRecord[] {
	const history: LifecycleTransitionRecord[] = [];
	const tableMatch = body.match(/## Transition History\s*\n\n\|[^\n]*\n\|[^\n]*\n([\s\S]*?)(?:\n##|\n*$)/);
	if (!tableMatch) return history;

	for (const line of tableMatch[1].split("\n")) {
		const cols = line.split("|").map((c) => c.trim()).filter(Boolean);
		if (cols.length >= 4) {
			history.push({ date: cols[0], from: cols[1], to: cols[2], reason: cols[3] });
		}
	}
	return history;
}

// ── CRUD ────────────────────────────────────────────────────────────

/** List all lifecycle items in a directory of item subfolders. */
export function listLifecycleItems(deps: Pick<CliDeps, "disk" | "paths">, basePath: string, subdir?: string): LifecycleSummary[] {
	const dirs = listItemDirs(deps, basePath, subdir);
	const items: LifecycleSummary[] = [];

	const baseDir = lifecycleDir(deps, basePath, subdir);

	for (const dirName of dirs) {
		const filePath = deps.paths.join(baseDir, dirName, "lifecycle.md");
		if (!deps.disk.existsSync(filePath)) continue;

		const content = deps.disk.readFileSync(filePath, "utf-8");
		const fm = parseFrontmatterStrings(content);
		items.push({
			name: fm.name ?? dirName,
			entityType: (fm.entityType as EntityType) ?? "feature",
			currentState: fm.currentState ?? "",
			transitionCount: parseInt(fm.transitionCount ?? "0", 10),
			createdDate: fm.createdDate ?? "",
			file: deps.paths.join(dirName, "lifecycle.md"),
		});
	}

	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Read a single lifecycle record by name. */
export function readLifecycleItem(deps: Pick<CliDeps, "disk" | "paths">, basePath: string, name: string, subdir?: string): LifecycleRecord | null {
	const filePath = lifecycleFilePath(deps, basePath, name, subdir);
	if (!deps.disk.existsSync(filePath)) return null;

	const content = deps.disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterStrings(content);
	const body = content.replace(/^---[\s\S]*?---\s*/, "");
	const history = parseHistory(body);

	return {
		name: fm.name ?? name,
		entityType: (fm.entityType as EntityType) ?? "feature",
		currentState: (fm.currentState as LifecycleState) ?? "",
		history,
		createdDate: fm.createdDate ?? "",
		lastTransitionDate: fm.lastTransitionDate ?? "",
		description: fm.description ?? "",
	};
}

/** Create a new lifecycle item. Returns file path or null if it already exists. */
export function createLifecycleFile(
	deps: LifecycleStoreDeps,
	basePath: string,
	entityType: EntityType,
	name: string,
	description?: string,
	subdir?: string,
): string | null {
	const filePath = lifecycleFilePath(deps, basePath, name, subdir);

	if (deps.disk.existsSync(filePath)) return null;

	const template = getTemplate(entityType);
	const itemDir = deps.paths.join(lifecycleDir(deps, basePath, subdir), toKebab(name));
	deps.disk.mkdirSync(itemDir, { recursive: true });

	const frontmatter: Record<string, string> = {
		type: "Lifecycle",
		entityType,
		name,
		currentState: template.initialState,
		transitionCount: "0",
		createdDate: deps.clock.iso(),
		lastTransitionDate: "",
	};

	if (description) frontmatter.description = description;

	const doc = Document.create(name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, name)
		.addBlank();

	if (description) {
		doc.text(description).addBlank();
	}

	doc.heading(2, "Transition History")
		.addBlank()
		.text("| Date | From | To | Reason |")
		.text("|---|---|---|---|");

	doc.save(filePath, deps.disk);
	return filePath;
}

/** Transition a lifecycle item to a new state. Validates the transition, appends history, updates frontmatter. */
export function transitionLifecycleItem(
	deps: LifecycleStoreDeps,
	basePath: string,
	name: string,
	newState: LifecycleState,
	reason: string,
	subdir?: string,
): TransitionResult {
	const filePath = lifecycleFilePath(deps, basePath, name, subdir);
	if (!deps.disk.existsSync(filePath)) {
		return { success: false, error: `Lifecycle file not found for "${name}".` };
	}

	const content = deps.disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterStrings(content);
	const currentState = fm.currentState ?? "";
	const entityType = (fm.entityType as EntityType) ?? "feature";

	const template = getTemplate(entityType);
	const validation = validateTransition(template, currentState, newState);
	if (!validation.success) return validation;

	const now = deps.clock.iso();
	const count = parseInt(fm.transitionCount ?? "0", 10) + 1;

	// Update frontmatter fields
	let updated = content;
	updated = updated.replace(/^currentState:\s*.+$/m, `currentState: ${newState}`);
	updated = updated.replace(/^transitionCount:\s*.+$/m, `transitionCount: ${count}`);
	updated = updated.replace(/^lastTransitionDate:\s*.*$/m, `lastTransitionDate: ${now}`);

	// Append row to history table
	const historyRow = `| ${now.slice(0, 10)} | ${currentState} | ${newState} | ${reason} |`;
	updated = updated.replace(
		/(\|---\|---\|---\|---\|)/,
		`$1\n${historyRow}`,
	);

	deps.disk.writeFileSync(filePath, updated, "utf-8");
	return { success: true, from: currentState, to: newState };
}

/** Get the transition history for an item. */
export function getLifecycleHistory(deps: Pick<CliDeps, "disk" | "paths">, basePath: string, name: string, subdir?: string): LifecycleTransitionRecord[] {
	const filePath = lifecycleFilePath(deps, basePath, name, subdir);
	if (!deps.disk.existsSync(filePath)) return [];

	const content = deps.disk.readFileSync(filePath, "utf-8");
	const body = content.replace(/^---[\s\S]*?---\s*/, "");
	return parseHistory(body);
}
