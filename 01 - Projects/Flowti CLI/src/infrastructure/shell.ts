/**
 * shell.ts — Shell execution service.
 *
 * Centralizes all child_process usage behind an IShell interface.
 * Production code uses the `shell` singleton; tests inject a mock.
 */

import { execSync, execFileSync, spawnSync } from "node:child_process";
import { ROOT } from "./config.js";
import { RESET, GREEN, RED, CYAN, DIM } from "./ui.js";
import { log } from "./logger.js";
import { clock } from "./clock.js";
import type { IShell } from "./types.js";

class NodeShell implements IShell {
	run(cmd: string, opts: { cwd?: string; label?: string } = {}): number {
		const cwd = opts.cwd ?? ROOT;
		const startTime = clock.ms();
		log(`\n  ${CYAN}▸${RESET} ${opts.label ?? cmd}\n`);
		try {
			execSync(cmd, { cwd, stdio: "inherit" });
			const duration = ((clock.ms() - startTime) / 1000).toFixed(1);
			log(`\n  ${GREEN}✓${RESET} Done ${DIM}(${duration}s)${RESET}\n`);
			return 0;
		} catch (err: unknown) {
			const duration = ((clock.ms() - startTime) / 1000).toFixed(1);
			log(`\n  ${RED}✗${RESET} Failed ${DIM}(${duration}s)${RESET}\n`);
			return (err as { status?: number }).status ?? 1;
		}
	}

	runSilent(cmd: string, opts: { cwd?: string } = {}): string | null {
		try {
			return execSync(cmd, {
				cwd: opts.cwd ?? ROOT,
				encoding: "utf-8",
				timeout: 10_000,
				windowsHide: true,
			}).trim();
		} catch {
			return null;
		}
	}

	check(cmd: string): boolean {
		try {
			execSync(cmd, { stdio: "ignore", windowsHide: true });
			return true;
		} catch {
			return false;
		}
	}

	runCapture(cmd: string, opts: { cwd?: string; timeout?: number } = {}): string {
		const result = spawnSync(cmd, {
			cwd: opts.cwd ?? ROOT,
			encoding: "utf-8",
			timeout: opts.timeout ?? 30_000,
			windowsHide: true,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		return (result.stdout ?? "") + "\n" + (result.stderr ?? "");
	}

	execFile(cmd: string, args: string[], opts: { timeout?: number; stdio?: string } = {}): string | null {
		try {
			const result = execFileSync(cmd, args, {
				encoding: "utf-8",
				timeout: opts.timeout ?? 10_000,
				windowsHide: true,
				...(opts.stdio ? { stdio: opts.stdio as "inherit" } : {}),
			});
			return typeof result === "string" ? result.trim() : "";
		} catch {
			return null;
		}
	}
}

export const shell: IShell = new NodeShell();
