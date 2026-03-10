/**
 * capture.ts — Quick capture of ideas and notes into the vault.
 *
 * Pure domain logic — no display or interactive I/O.
 * Interactive menus live in ui/menus/capture-menu.ts.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { VAULT_ROOT, getCaptureDir } from "../../infrastructure/config.js";
import { Document } from "../../infrastructure/document.js";
import { clock } from "../../infrastructure/clock.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";

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

export function createCaptureFile(type: string, title: string, body: string, tags: string[] = []): string | null {
	const dir = getCaptureDir(type.toLowerCase());
	disk.mkdirSync(dir, { recursive: true });

	const filename = sanitizeFilename(title) + ".md";
	const filePath = paths.join(dir, filename);

	if (disk.existsSync(filePath)) {
		return null;
	}

	const fm: Record<string, string | string[]> = { type, date: clock.iso() };
	if (tags.length > 0) fm.tags = tags;

	const doc = Document.create(title)
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, title);

	if (body) {
		doc.addBlank().text(body);
	}

	doc.addBlank();
	doc.save(filePath);
	return filePath;
}

// ── Import helper ───────────────────────────────────────────────────

function importSingleItem(item: unknown): boolean | null {
	const entry = item as Record<string, unknown>;
	const type = typeof entry.type === "string" ? entry.type : "Note";
	const title = typeof entry.title === "string" ? entry.title : "";
	const body = typeof entry.body === "string" ? entry.body : "";
	const tags = Array.isArray(entry.tags) ? (entry.tags as string[]).filter((t) => typeof t === "string") : [];
	if (!title) return null;
	return createCaptureFile(type, title, body, tags) !== null;
}

export function importCaptureItems(absPath: string): { created: number; skipped: number; error?: string } {
	try {
		const raw = JSON.parse(disk.readFileSync(absPath, "utf-8")) as unknown;
		if (!Array.isArray(raw)) {
			return { created: 0, skipped: 0, error: "Expected a JSON array." };
		}
		let created = 0;
		let skipped = 0;
		for (const item of raw) {
			const result = importSingleItem(item);
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
	filePath: string,
	subType: string,
	query: string,
	typeFilter?: string,
	tagFilter?: string,
): CaptureSearchResult | null {
	const content = disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterContent(content);
	if (!fm) return null;

	const type = typeof fm.type === "string" ? fm.type : subType;
	const date = typeof fm.date === "string" ? fm.date : "";
	const tags = Array.isArray(fm.tags) ? (fm.tags as string[]) : [];
	const segments = filePath.split(/[\\/]/);
	const title = (segments[segments.length - 1] ?? "").replace(/\.md$/, "");

	if (!matchesCaptureFilters(type, tags, typeFilter, tagFilter)) return null;
	if (!matchesCaptureQuery(query, [title, type, ...tags, content])) return null;

	return { file: paths.relative(VAULT_ROOT, filePath), title, type, date, tags };
}

export function searchCaptures(query: string, typeFilter?: string, tagFilter?: string): CaptureSearchResult[] {
	const baseDir = getCaptureDir("");
	if (!disk.existsSync(baseDir)) return [];

	const results: CaptureSearchResult[] = [];

	const subdirs = disk.readdirSync(baseDir);
	for (const sub of subdirs) {
		const subPath = paths.join(baseDir, sub);
		let files: string[];
		try {
			files = disk.readdirSync(subPath).filter((f) => f.endsWith(".md"));
		} catch {
			continue;
		}
		for (const file of files) {
			const filePath = paths.join(subPath, file);
			const result = parseCaptureMeta(filePath, sub, query, typeFilter, tagFilter);
			if (result) results.push(result);
		}
	}

	return results;
}
