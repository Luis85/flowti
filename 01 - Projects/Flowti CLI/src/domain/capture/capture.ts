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
import { resolveFormat, printOutput } from "../../infrastructure/output.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";
import { proc } from "../../infrastructure/proc.js";

// ── Constants ───────────────────────────────────────────────────────

const NOTE_TYPES = ["Task", "Bug", "Note", "Documentation", "Idea"];

// ── Helpers ─────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
	return name
		.replace(/[:/\\?*"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

function parseTags(raw: string | boolean | undefined): string[] {
	if (!raw || typeof raw !== "string") return [];
	return raw.split(",").map((t) => t.trim()).filter(Boolean);
}

function createCaptureFile(type: string, title: string, body: string, tags: string[] = []): string | null {
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

function importCaptureItems(absPath: string): { created: number; skipped: number; error?: string } {
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

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"capture:idea": (flags: Record<string, string | boolean>) => {
		const text = flags.text;
		if (!text || typeof text !== "string") {
			log(`\n  ${RED}Missing --text flag.${RESET}`);
			log(`  ${DIM}Usage: flowti capture:idea --text="My idea" [--tags=a,b]${RESET}\n`);
			return;
		}
		const tags = parseTags(flags.tags);
		const title = text.length > 60 ? text.slice(0, 60).trim() : text;
		createCaptureFile("Idea", title, text, tags);
	},
	"capture:note": (flags: Record<string, string | boolean>) => {
		const type = flags.type;
		const title = flags.title;
		if (!type || typeof type !== "string" || !title || typeof title !== "string") {
			log(`\n  ${RED}Missing --type and/or --title flag.${RESET}`);
			log(`  ${DIM}Usage: flowti capture:note --type=task --title="My note" [--tags=a,b]${RESET}\n`);
			return;
		}
		const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		if (!NOTE_TYPES.includes(normalized)) {
			log(`\n  ${RED}Invalid type: ${type}${RESET}`);
			log(`  ${DIM}Valid types: ${NOTE_TYPES.join(", ")}${RESET}\n`);
			return;
		}
		const tags = parseTags(flags.tags);
		createCaptureFile(normalized, title, "", tags);
	},
	"capture:search": (flags: Record<string, string | boolean>) => {
		const query = flags.query;
		if (!query || typeof query !== "string") {
			log(`\n  ${RED}Missing --query flag.${RESET}`);
			log(`  ${DIM}Usage: flowti capture:search --query="keyword" [--type=idea] [--tag=urgent]${RESET}\n`);
			return;
		}
		const typeFilter = typeof flags.type === "string" ? flags.type.charAt(0).toUpperCase() + flags.type.slice(1).toLowerCase() : undefined;
		const tagFilter = typeof flags.tag === "string" ? flags.tag : undefined;
		const results = searchCaptures(query, typeFilter, tagFilter);
		const format = resolveFormat(flags);
		printOutput(format, results, () => {
			if (results.length === 0) {
				log(`\n  ${DIM}No captures matching "${query}".${RESET}\n`);
				return;
			}
			log(`\n  ${GREEN}Found ${results.length} capture${results.length === 1 ? "" : "s"}:${RESET}\n`);
			for (const r of results) {
				const tagsStr = r.tags.length > 0 ? ` ${DIM}[${r.tags.join(", ")}]${RESET}` : "";
				log(`  ${DIM}${r.type}${RESET}  ${r.title}${tagsStr}`);
			}
			log();
		});
	},
	"capture:import": (flags: Record<string, string | boolean>) => {
		const file = flags.file;
		if (!file || typeof file !== "string") {
			log(`\n  ${RED}Missing --file flag.${RESET}`);
			log(`  ${DIM}Usage: flowti capture:import --file=items.json${RESET}`);
			log(`  ${DIM}JSON format: [{ "type": "Idea", "title": "...", "body": "...", "tags": ["a"] }]${RESET}\n`);
			return;
		}
		const absPath = paths.isAbsolute(file) ? file : paths.join(proc.cwd(), file);
		if (!disk.existsSync(absPath)) {
			log(`\n  ${RED}File not found: ${file}${RESET}\n`);
			return;
		}
		const result = importCaptureItems(absPath);
		if (result.error) {
			log(`\n  ${RED}${result.error}${RESET}\n`);
			return;
		}
		log(`\n  ${GREEN}✓${RESET} Imported ${result.created} item${result.created === 1 ? "" : "s"}${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}\n`);
	},
};

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
