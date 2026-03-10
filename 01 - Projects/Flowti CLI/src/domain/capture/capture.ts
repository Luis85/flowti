/**
 * capture.ts — Quick capture of ideas and notes into the vault.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { VAULT_ROOT, getCaptureDir } from "../../infrastructure/config.js";
import { RESET, DIM, GREEN, RED, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { Document } from "../../infrastructure/document.js";
import { clock } from "../../infrastructure/clock.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";

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
		log(`\n  ${YELLOW}File already exists:${RESET} ${filename}`);
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
	const relPath = paths.relative(VAULT_ROOT, filePath);
	log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
	return filePath;
}

// ── Capture Idea ────────────────────────────────────────────────────

async function captureIdeaLoop(): Promise<void> {
	while (true) {
		const idea = await input.ask("Idea");

		if (!idea) {
			log(`\n  ${YELLOW}No idea entered — skipped.${RESET}`);
		} else {
			const title = idea.length > 60 ? idea.slice(0, 60).trim() : idea;
			createCaptureFile("Idea", title, idea);
		}

		const next = await input.ask(`${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");

		if (next.toLowerCase() !== "a") return;
	}
}

// ── Capture Note ────────────────────────────────────────────────────

async function captureNoteLoop(): Promise<void> {
	while (true) {
		printHeader("Capture Note — Type");
		printMenu(NOTE_TYPES.map((t, i) => ({ key: String(i + 1), label: t, action: () => {} })));

		const typeChoice = await input.ask("Type", "3");

		const typeIdx = parseInt(typeChoice, 10) - 1;
		if (isNaN(typeIdx) || typeIdx < 0 || typeIdx >= NOTE_TYPES.length) {
			log(`\n  ${RED}Invalid type — skipped.${RESET}`);
			return;
		}

		const type = NOTE_TYPES[typeIdx];

		const title = await input.ask("Title");

		if (!title) {
			log(`\n  ${YELLOW}No title entered — skipped.${RESET}`);
		} else {
			createCaptureFile(type, title, "");
		}

		const next = await input.ask(`${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");

		if (next.toLowerCase() !== "a") return;
	}
}

// ── Interactive entry points (called directly from main menu) ───────

export async function captureIdea(): Promise<MenuResult> {
	printHeader("Capture Idea");
	await captureIdeaLoop();
	return "main";
}

export async function captureNote(): Promise<MenuResult> {
	await captureNoteLoop();
	return "main";
}

export async function captureBug(): Promise<MenuResult> {
	printHeader("Capture Bug");
	while (true) {
		const title = await input.ask("Bug title");
		if (!title) {
			log(`\n  ${YELLOW}No title entered — skipped.${RESET}`);
		} else {
			const description = await input.ask("Description (optional)");
			createCaptureFile("Bug", title, description || "");
		}
		const next = await input.ask(`${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");
		if (next.toLowerCase() !== "a") break;
	}
	return "main";
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
