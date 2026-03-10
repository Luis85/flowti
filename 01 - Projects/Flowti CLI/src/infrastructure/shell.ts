/**
 * shell.ts — Shell execution service.
 *
 * Centralizes all child_process usage behind an IShell interface.
 * Production code uses the `shell` singleton; tests inject a mock.
 */

import { execSync, execFileSync, spawnSync, spawn } from "node:child_process";
import { CLI_PROJECT } from "./config.js";
import { RESET, GREEN, RED, CYAN, DIM } from "./ui.js";
import { log } from "./logger.js";
import { clock } from "./clock.js";
import type { IShell, BackgroundProcess } from "./types.js";

class NodeShell implements IShell {
	run(cmd: string, opts: { cwd?: string; label?: string } = {}): number {
		const cwd = opts.cwd ?? CLI_PROJECT;
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
				cwd: opts.cwd ?? CLI_PROJECT,
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
			cwd: opts.cwd ?? CLI_PROJECT,
			encoding: "utf-8",
			timeout: opts.timeout ?? 30_000,
			windowsHide: true,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		return (result.stdout ?? "") + "\n" + (result.stderr ?? "");
	}

	runCaptureStatus(cmd: string, opts: { cwd?: string; timeout?: number } = {}): { output: string; exitCode: number } {
		const result = spawnSync(cmd, {
			cwd: opts.cwd ?? CLI_PROJECT,
			encoding: "utf-8",
			timeout: opts.timeout ?? 120_000,
			windowsHide: true,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
		});
		const output = (result.stdout ?? "") + "\n" + (result.stderr ?? "");
		return { output, exitCode: result.status ?? 1 };
	}

	runCaptureDetailed(cmd: string, opts: { cwd?: string; timeout?: number; env?: Record<string, string> } = {}): { stdout: string; stderr: string; exitCode: number } {
		const result = spawnSync(cmd, {
			cwd: opts.cwd ?? CLI_PROJECT,
			encoding: "utf-8",
			timeout: opts.timeout ?? 30_000,
			windowsHide: true,
			shell: true,
			stdio: ["pipe", "pipe", "pipe"],
			env: opts.env ? { ...process.env, ...opts.env } : undefined,
		});
		return {
			stdout: result.stdout ?? "",
			stderr: result.stderr ?? "",
			exitCode: result.status ?? 1,
		};
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

	spawnBackground(cmd: string, opts: { cwd?: string; env?: Record<string, string> } = {}): BackgroundProcess {
		const child = spawn(cmd, {
			cwd: opts.cwd ?? CLI_PROJECT,
			shell: true,
			windowsHide: true,
			stdio: ["ignore", "pipe", "pipe"],
			env: opts.env ? { ...process.env, ...opts.env } : undefined,
		});

		let running = true;
		const outputLines: string[] = [];
		const listeners: Set<(line: string) => void> = new Set();

		function collectOutput(chunk: Buffer): void {
			const text = chunk.toString("utf-8");
			for (const line of text.split(/\r?\n/)) {
				if (line.trim()) {
					outputLines.push(line);
					for (const cb of listeners) cb(line);
				}
			}
		}

		child.stdout?.on("data", collectOutput);
		child.stderr?.on("data", collectOutput);
		child.on("exit", () => { running = false; });

		return {
			get running() { return running; },
			get output() { return outputLines; },
			onOutput(callback: (line: string) => void): () => void {
				listeners.add(callback);
				return () => { listeners.delete(callback); };
			},
			kill() {
				if (running) {
					if (process.platform === "win32" && child.pid) {
						// On Windows with shell: true, child.kill() only kills the
						// cmd.exe wrapper. taskkill /T kills the entire process tree.
						try { execSync(`taskkill /T /F /PID ${child.pid}`, { stdio: "ignore", windowsHide: true }); } catch { /* already dead */ }
					} else {
						child.kill();
					}
					running = false;
				}
			},
			waitForOutput(pattern: RegExp, timeoutMs = 60_000): Promise<string | null> {
				return new Promise((resolve) => {
					const timer = setTimeout(() => {
						cleanup();
						resolve(null);
					}, timeoutMs);

					function onData(chunk: Buffer): void {
						const text = chunk.toString("utf-8");
						for (const line of text.split(/\r?\n/)) {
							if (pattern.test(line)) {
								cleanup();
								resolve(line);
								return;
							}
						}
					}

					function onExit(): void {
						cleanup();
						resolve(null);
					}

					function cleanup(): void {
						clearTimeout(timer);
						child.stdout?.off("data", onData);
						child.stderr?.off("data", onData);
						child.off("exit", onExit);
					}

					child.stdout?.on("data", onData);
					child.stderr?.on("data", onData);
					child.on("exit", onExit);
				});
			},
		};
	}
}

export const shell: IShell = new NodeShell();
