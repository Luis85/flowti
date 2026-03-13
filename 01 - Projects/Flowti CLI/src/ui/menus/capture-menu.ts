/**
 * capture-menu.ts — Interactive capture menus (idea, note, bug).
 *
 * Moved from domain/capture/capture.ts to separate display/input
 * concerns from pure domain logic.
 */

import { RESET, DIM, GREEN, RED, YELLOW, printHeader, printMenu } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { log } from "../../infrastructure/logger.js";
import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { getCaptureDir } from "../../infrastructure/config.js";
import type { MenuResult } from "../../infrastructure/types.js";
import { createCaptureFile, NOTE_TYPES } from "../../domain/capture/capture.js";

function captureDeps() { return { disk, paths, clock } as const; }

// ── Capture Idea ────────────────────────────────────────────────────

async function captureIdeaLoop(): Promise<void> {
	while (true) {
		const idea = await input.ask("Idea");

		if (!idea) {
			log(`\n  ${YELLOW}No idea entered — skipped.${RESET}`);
		} else {
			const title = idea.length > 60 ? idea.slice(0, 60).trim() : idea;
			const path = createCaptureFile(getCaptureDir("idea"), captureDeps(), "Idea", title, idea);
			if (path) {
				log(`\n  ${GREEN}✓${RESET} Created: ${path}`);
			} else {
				log(`\n  ${YELLOW}File already exists — skipped.${RESET}`);
			}
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
			const path = createCaptureFile(getCaptureDir(type.toLowerCase()), captureDeps(), type, title, "");
			if (path) {
				log(`\n  ${GREEN}✓${RESET} Created: ${path}`);
			} else {
				log(`\n  ${YELLOW}File already exists — skipped.${RESET}`);
			}
		}

		const next = await input.ask(`${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");

		if (next.toLowerCase() !== "a") return;
	}
}

// ── Interactive entry points (called from main menu) ────────────────

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
			const path = createCaptureFile(getCaptureDir("bug"), captureDeps(), "Bug", title, description || "");
			if (path) {
				log(`\n  ${GREEN}✓${RESET} Created: ${path}`);
			} else {
				log(`\n  ${YELLOW}File already exists — skipped.${RESET}`);
			}
		}
		const next = await input.ask(`${DIM}(a)${RESET}nother or ${DIM}(b)${RESET}ack`, "b");
		if (next.toLowerCase() !== "a") break;
	}
	return "main";
}
