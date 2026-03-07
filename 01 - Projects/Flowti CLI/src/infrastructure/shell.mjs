/**
 * shell.mjs — Shell execution wrappers.
 */

import { execSync } from "node:child_process";
import { ROOT } from "./config.mjs";
import { RESET, GREEN, RED, CYAN, DIM } from "./ui.mjs";

export function run(cmd, label) {
	const startTime = Date.now();
	console.log(`\n  ${CYAN}▸${RESET} ${label ?? cmd}\n`);
	try {
		execSync(cmd, { cwd: ROOT, stdio: "inherit" });
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n  ${GREEN}✓${RESET} Done ${DIM}(${duration}s)${RESET}\n`);
		return 0;
	} catch (err) {
		const duration = ((Date.now() - startTime) / 1000).toFixed(1);
		console.log(`\n  ${RED}✗${RESET} Failed ${DIM}(${duration}s)${RESET}\n`);
		return err.status ?? 1;
	}
}

export function runSilent(cmd) {
	try {
		return execSync(cmd, { cwd: ROOT, encoding: "utf-8", timeout: 10_000, windowsHide: true }).trim();
	} catch {
		return null;
	}
}
