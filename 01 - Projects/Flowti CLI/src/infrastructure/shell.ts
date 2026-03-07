/**
 * shell.ts — Shell execution wrappers.
 */

import { execSync } from "node:child_process";
import { ROOT } from "./config.js";
import { RESET, GREEN, RED, CYAN, DIM } from "./ui.js";
import { log } from "./logger.js";

export function run(cmd: string, label?: string): number {
	const startTime = Date.now();
	log(`\n  ${CYAN}▸${RESET} ${label ?? cmd}\n`);
	try {
		execSync(cmd, { cwd: ROOT, stdio: "inherit" });
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		log(`\n  ${GREEN}✓${RESET} Done ${DIM}(${duration}s)${RESET}\n`);
		return 0;
	} catch (err: unknown) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		log(`\n  ${RED}✗${RESET} Failed ${DIM}(${duration}s)${RESET}\n`);
		return (err as { status?: number }).status ?? 1;
	}
}

export function runIn(cmd: string, cwd: string, label?: string): number {
	const startTime = Date.now();
	log(`\n  ${CYAN}▸${RESET} ${label ?? cmd}\n`);
	try {
		execSync(cmd, { cwd, stdio: "inherit" });
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		log(`\n  ${GREEN}✓${RESET} Done ${DIM}(${duration}s)${RESET}\n`);
		return 0;
	} catch (err: unknown) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		log(`\n  ${RED}✗${RESET} Failed ${DIM}(${duration}s)${RESET}\n`);
		return (err as { status?: number }).status ?? 1;
	}
}

export function runSilent(cmd: string): string | null {
	try {
		return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 10_000, windowsHide: true }).trim();
	} catch {
		return null;
	}
}
