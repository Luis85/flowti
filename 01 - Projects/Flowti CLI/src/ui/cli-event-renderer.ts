/**
 * cli-event-renderer.ts — Subscribes to CLI EventBus events and renders output.
 *
 * This is the only place ANSI formatting is applied to domain events.
 * Domain code emits plain-text events; this renderer adds colors and icons.
 */

import type { ICliBus } from "../infrastructure/event-bus.js";
import { log } from "../infrastructure/logger.js";
import { RESET, DIM, GREEN, RED, YELLOW, CYAN } from "../infrastructure/ui.js";

const E2E_ICONS = {
	ok: `${GREEN}✓${RESET}`,
	fail: `${RED}✗${RESET}`,
	warn: `${YELLOW}○${RESET}`,
	info: `${DIM}·${RESET}`,
} as const;

export function attachCliRenderer(bus: ICliBus): () => void {
	const unsubs: (() => void)[] = [];

	// ── Report events ───────────────────────────────────────────────
	unsubs.push(bus.on("report.progress", ({ payload }) => {
		log(`  ${DIM}${payload.message}${RESET}`);
	}));

	unsubs.push(bus.on("report.warning", ({ payload }) => {
		log(`  ${YELLOW}⚠${RESET} ${payload.message}`);
	}));

	unsubs.push(bus.on("report.written", ({ payload }) => {
		log(`  ${GREEN}✓${RESET} ${payload.outputPath}`);
	}));

	// ── E2E events ──────────────────────────────────────────────────
	unsubs.push(bus.on("e2e.step.progress", ({ payload }) => {
		log(`  ${E2E_ICONS[payload.level]} ${payload.message}`);
	}));

	unsubs.push(bus.on("e2e.prereq.result", ({ payload }) => {
		const icon = payload.passed ? E2E_ICONS.ok : E2E_ICONS.fail;
		const detail = payload.detail ? ` ${DIM}(${payload.detail})${RESET}` : "";
		log(`  ${icon} ${payload.name}${detail}`);
	}));

	unsubs.push(bus.on("e2e.build.progress", ({ payload }) => {
		log(`  ${DIM}[${payload.phase}]${RESET} ${payload.message}`);
	}));

	unsubs.push(bus.on("e2e.teardown.progress", ({ payload }) => {
		const icon = payload.success ? E2E_ICONS.ok : E2E_ICONS.fail;
		log(`  ${icon} ${payload.step}`);
	}));

	unsubs.push(bus.on("e2e.session.info", ({ payload }) => {
		log(`  ${DIM}${payload.message}${RESET}`);
	}));

	// ── Generic CLI events ──────────────────────────────────────────
	unsubs.push(bus.on("cli.progress", ({ payload }) => {
		log(`  ${CYAN}${payload.message}${RESET}`);
	}));

	unsubs.push(bus.on("cli.warn", ({ payload }) => {
		log(`  ${YELLOW}${payload.message}${RESET}`);
	}));

	return () => unsubs.forEach(fn => fn());
}
