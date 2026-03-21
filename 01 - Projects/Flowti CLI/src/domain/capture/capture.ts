/**
 * capture.ts — Quick capture of ideas and notes into the vault.
 *
 * Pure domain logic — no display or interactive I/O.
 * Flag-based capture uses `capture.controller` (`capture:idea`, `capture:note`, etc.).
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { CliDeps } from "../../infrastructure/deps.js";

// ── Constants ───────────────────────────────────────────────────────

export const NOTE_TYPES = ["Task", "Bug", "Note", "Documentation", "Idea"];

// ── Helpers ─────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
	return name
		.replace(/[:/\\?*"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

export function parseTags(raw: string | boolean | undefined): string[] {
	if (!raw || typeof raw !== "string") return [];
	return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

export function createCaptureFile(captureDir: string, deps: Pick<CliDeps, "disk" | "paths" | "clock">, type: string, title: string, body: string, tags: string[] = []): string | null {
	const dir = captureDir;
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = sanitizeFilename(title) + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) {
		return null;
	}

	const fm: Record<string, string | string[]> = { type, date: deps.clock.iso() };
	if (tags.length > 0) fm.tags = tags;

	const doc = Document.create(title)
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, title);

	if (body) {
		doc.addBlank().text(body);
	}

	doc.addBlank();
	doc.save(filePath, deps.disk);
	return filePath;
}

// ── Import helper ───────────────────────────────────────────────────

function importSingleItem(getCaptureDir: (type: string) => string, deps: Pick<CliDeps, "disk" | "paths" | "clock">, item: unknown): boolean | null {
	const entry = item as Record<string, unknown>;
	const type = typeof entry.type === "string" ? entry.type : "Note";
	const title = typeof entry.title === "string" ? entry.title : "";
	const body = typeof entry.body === "string" ? entry.body : "";
	const tags = Array.isArray(entry.tags) ? (entry.tags as string[]).filter((t) => typeof t === "string") : [];
	if (!title) return null;
	return createCaptureFile(getCaptureDir(type.toLowerCase()), deps, type, title, body, tags) !== null;
}

export function importCaptureItems(getCaptureDir: (type: string) => string, deps: Pick<CliDeps, "disk" | "paths" | "clock">, absPath: string): { created: number; skipped: number; error?: string } {
	try {
		const raw = JSON.parse(deps.disk.readFileSync(absPath, "utf-8")) as unknown;
		if (!Array.isArray(raw)) {
			return { created: 0, skipped: 0, error: "Expected a JSON array." };
		}
		let created = 0;
		let skipped = 0;
		for (const item of raw) {
			const result = importSingleItem(getCaptureDir, deps, item);
			if (result === null) skipped++;
			else if (result) created++;
			else skipped++;
		}
		return { created, skipped };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		return { created: 0, skipped: 0, error: `Failed to parse JSON: ${msg}` };
	}
}

// ── Search ──────────────────────────────────────────────────────────

export interface CaptureSearchResult {
	file: string;
	title: string;
	type: string;
	date: string;
	tags: string[];
}

function matchesCaptureFilters(
	type: string,
	tags: string[],
	typeFilter?: string,
	tagFilter?: string,
): boolean {
	if (typeFilter && type.toLowerCase() !== typeFilter.toLowerCase()) return false;
	if (tagFilter && !tags.some((t) => t.toLowerCase() === tagFilter.toLowerCase())) return false;
	return true;
}

function matchesCaptureQuery(query: string, searchable: string[]): boolean {
	const lowerQuery = query.toLowerCase();
	return searchable.some((s) => s.toLowerCase().includes(lowerQuery));
}

function parseCaptureMeta(
	vaultRoot: string,
	deps: Pick<CliDeps, "disk" | "paths">,
	filePath: string,
	subType: string,
	query: string,
	typeFilter?: string,
	tagFilter?: string,
): CaptureSearchResult | null {
	const content = deps.disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterContent(content);
	if (!fm) return null;

	const type = typeof fm.type === "string" ? fm.type : subType;
	const date = typeof fm.date === "string" ? fm.date : "";
	const tags = Array.isArray(fm.tags) ? (fm.tags as string[]) : [];
	const segments = filePath.split(/[\\/]/);
	const title = (segments[segments.length - 1] ?? "").replace(/\.md$/, "");

	if (!matchesCaptureFilters(type, tags, typeFilter, tagFilter)) return null;
	if (!matchesCaptureQuery(query, [title, type, ...tags, content])) return null;

	return { file: deps.paths.relative(vaultRoot, filePath), title, type, date, tags };
}

export function searchCaptures(vaultRoot: string, getCaptureDir: (type: string) => string, deps: Pick<CliDeps, "disk" | "paths">, query: string, typeFilter?: string, tagFilter?: string): CaptureSearchResult[] {
	const baseDir = getCaptureDir("");
	if (!deps.disk.existsSync(baseDir)) return [];

	const results: CaptureSearchResult[] = [];

	const subdirs = deps.disk.readdirSync(baseDir);
	for (const sub of subdirs) {
		const subPath = deps.paths.join(baseDir, sub);
		let files: string[];
		try {
			files = deps.disk.readdirSync(subPath).filter((f) => f.endsWith(".md"));
		} catch {
			continue;
		}
		for (const file of files) {
			const filePath = deps.paths.join(subPath, file);
			const result = parseCaptureMeta(vaultRoot, deps, filePath, sub, query, typeFilter, tagFilter);
			if (result) results.push(result);
		}
	}

	return results;
}
