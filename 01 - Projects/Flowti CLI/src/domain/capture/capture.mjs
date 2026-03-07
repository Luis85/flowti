/**
 * capture.mjs — Quick capture of ideas and notes into the vault.
 */

import fs from "node:fs";
import path from "node:path";
import { VAULT_ROOT, getCaptureDir } from "../../infrastructure/config.mjs";
import { RESET, BOLD, DIM, GREEN, RED, CYAN, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.mjs";
import { createRL, ask } from "../../infrastructure/readline.mjs";
import { Document } from "../../infrastructure/document.mjs";

// ── Constants ───────────────────────────────────────────────────────

const NOTE_TYPES = ["Task", "Bug", "Note", "Documentation", "Idea"];

// ── Helpers ─────────────────────────────────────────────────────────

function sanitizeFilename(name) {
	return name
		.replace(/[:/\\?*"<>|]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 80);
}

function createCaptureFile(type, title, body) {
	const dir = getCaptureDir(type.toLowerCase());
	fs.mkdirSync(dir, { recursive: true });

	const filename = sanitizeFilename(title) + ".md";
	const filePath = path.join(dir, filename);

	if (fs.existsSync(filePath)) {
		console.log(`\n  ${YELLOW}File already exists:${RESET} ${filename}`);
		return null;
	}

	const doc = Document.create(title)
		.mergeFrontmatter({ type, date: new Date().toISOString() })
		.addBlank()
		.heading(1, title);

	if (body) {
		doc.addBlank().text(body);
	}

	doc.addBlank();
	doc.save(filePath);
	const relPath = path.relative(VAULT_ROOT, filePath);
	console.log(`\n  ${GREEN}✓${RESET} Created: ${relPath}`);
	return filePath;
}

// ── Capture Idea ────────────────────────────────────────────────────

async function captureIdeaLoop() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		const rl = createRL();
		const idea = await ask(rl, "Idea");
		rl.close();

		if (!idea) {
			console.log(`\n  ${YELLOW}No idea entered — skipped.${RESET}`);
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

async function captureNoteLoop() {
	// eslint-disable-next-line no-constant-condition
	while (true) {
		printHeader("Capture Note — Type");
		printMenu(NOTE_TYPES.map((t, i) => ({ key: String(i + 1), label: t })));

		const rl = createRL();
		const typeChoice = await ask(rl, "Type", "3");
		rl.close();

		const typeIdx = parseInt(typeChoice, 10) - 1;
		if (typeIdx < 0 || typeIdx >= NOTE_TYPES.length) {
			console.log(`\n  ${RED}Invalid type — skipped.${RESET}`);
			return;
		}

		const type = NOTE_TYPES[typeIdx];

		const rl2 = createRL();
		const title = await ask(rl2, "Title");
		rl2.close();

		if (!title) {
			console.log(`\n  ${YELLOW}No title entered — skipped.${RESET}`);
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

export async function captureIdea() {
	printHeader("Capture Idea");
	await captureIdeaLoop();
	return "main";
}

export async function captureNote() {
	await captureNoteLoop();
	return "main";
}

// ── Non-interactive commands ────────────────────────────────────────

export const commands = {
	"capture:idea": (flags) => {
		const text = flags.text;
		if (!text || typeof text !== "string") {
			console.log(`\n  ${RED}Missing --text flag.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- capture:idea --text="My idea"${RESET}\n`);
			return;
		}
		const title = text.length > 60 ? text.slice(0, 60).trim() : text;
		createCaptureFile("Idea", title, text);
	},
	"capture:note": (flags) => {
		const type = flags.type;
		const title = flags.title;
		if (!type || typeof type !== "string" || !title || typeof title !== "string") {
			console.log(`\n  ${RED}Missing --type and/or --title flag.${RESET}`);
			console.log(`  ${DIM}Usage: npm run flowti -- capture:note --type=task --title="My note"${RESET}\n`);
			return;
		}
		const normalized = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
		if (!NOTE_TYPES.includes(normalized)) {
			console.log(`\n  ${RED}Invalid type: ${type}${RESET}`);
			console.log(`  ${DIM}Valid types: ${NOTE_TYPES.join(", ")}${RESET}\n`);
			return;
		}
		createCaptureFile(normalized, title, "");
	},
};
