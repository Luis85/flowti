/**
 * capture.ts — Quick capture of ideas and notes into the vault.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { VAULT_ROOT, getCaptureDir } from "../../infrastructure/config.js";
import { RESET, DIM, GREEN, RED, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.js";
import { createRL, ask } from "../../infrastructure/readline.js";
import { Document } from "../../infrastructure/document.js";
import { clock } from "../../infrastructure/clock.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { log } from "../../infrastructure/logger.js";

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

function createCaptureFile(type: string, title: string, body: string): string | null {
	const dir = getCaptureDir(type.toLowerCase());
	disk.mkdirSync(dir, { recursive: true });

	const filename = sanitizeFilename(title) + ".md";
	const filePath = paths.join(dir, filename);

	if (disk.existsSync(filePath)) {
		log(`\n  ${YELLOW}File already exists:${RESET} ${filename}`);
		return null;
	}

	const doc = Document.create(title)
		.mergeFrontmatter({ type, date: clock.iso() })
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
		const rl = createRL();
		const idea = await ask(rl, "Idea");
		rl.close();

		if (!idea) {
			log(`\n  ${YELLOW}No idea entered — skipped.${RESET}`);
		} else {
			const title = idea.length > 60 ? idea.slice(0, 60).trim() : idea;
			createCaptureFile("Idea", title, idea);
		}

		const rl2 = createRL();
		const next = await ask(rl2, `${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");
		rl2.close();

		if (next.toLowerCase() !== "a") return;
	}
}

// ── Capture Note ────────────────────────────────────────────────────

async function captureNoteLoop(): Promise<void> {
	 
	while (true) {
		printHeader("Capture Note — Type");
		printMenu(NOTE_TYPES.map((t, i) => ({ key: String(i + 1), label: t, action: () => {} })));

		const rl = createRL();
		const typeChoice = await ask(rl, "Type", "3");
		rl.close();

		const typeIdx = parseInt(typeChoice, 10) - 1;
		if (typeIdx < 0 || typeIdx >= NOTE_TYPES.length) {
			log(`\n  ${RED}Invalid type — skipped.${RESET}`);
			return;
		}

		const type = NOTE_TYPES[typeIdx];

		const rl2 = createRL();
		const title = await ask(rl2, "Title");
		rl2.close();

		if (!title) {
			log(`\n  ${YELLOW}No title entered — skipped.${RESET}`);
		} else {
			createCaptureFile(type, title, "");
		}

		const rl3 = createRL();
		const next = await ask(rl3, `${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");
		rl3.close();

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

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"capture:idea": (flags: Record<string, string | boolean>) => {
		const text = flags.text;
		if (!text || typeof text !== "string") {
			log(`\n  ${RED}Missing --text flag.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- capture:idea --text="My idea"${RESET}\n`);
			return;
		}
		const title = text.length > 60 ? text.slice(0, 60).trim() : text;
		createCaptureFile("Idea", title, text);
	},
	"capture:note": (flags: Record<string, string | boolean>) => {
		const type = flags.type;
		const title = flags.title;
		if (!type || typeof type !== "string" || !title || typeof title !== "string") {
			log(`\n  ${RED}Missing --type and/or --title flag.${RESET}`);
			log(`  ${DIM}Usage: npm run flowti -- capture:note --type=task --title="My note"${RESET}\n`);
			return;
		}
		const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		if (!NOTE_TYPES.includes(normalized)) {
			log(`\n  ${RED}Invalid type: ${type}${RESET}`);
			log(`  ${DIM}Valid types: ${NOTE_TYPES.join(", ")}${RESET}\n`);
			return;
		}
		createCaptureFile(normalized, title, "");
	},
};
