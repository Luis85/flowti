/**
 * CLI command runner and storybook detection helpers for VaultProjectService.
 *
 * Extracted from vault-project-service.ts to stay under max-lines.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { App } from "obsidian";
import type { StorybookStatus, OutputCallback } from "../../domain/projects/types.js";

export const PROJECTS_FOLDER = "01 - Projects";

/** Max wall time for Flowti CLI (`node main.mjs`) and comparable Node jobs. */
export const FLOWTI_CLI_TIMEOUT_MS = 15 * 60 * 1000;
/** Storybook static builds can exceed CLI work on large trees. */
export const STORYBOOK_BUILD_TIMEOUT_MS = 20 * 60 * 1000;
/** Git clone / submodule add on slow or large remotes. */
export const GIT_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;
/** taskkill, port cleanup, quick shell helpers. */
export const SHORT_SHELL_COMMAND_TIMEOUT_MS = 60 * 1000;

const STORYBOOK_DIRS = [".storybook", "components/.storybook"];
const EMPTY_STORYBOOK: StorybookStatus = { installed: false, framework: null, running: false, url: null, pid: null, hasStaticBuild: false };

/** Detect storybook using Node.js fs (not vault API — Obsidian ignores dot-folders). */
export function detectStorybookOnDisk(absProjectPath: string): StorybookStatus {
	for (const dir of STORYBOOK_DIRS) {
		const sbPath = join(absProjectPath, dir);
		if (existsSync(sbPath)) {
			let framework: string | null = null;
			try {
				const mainPath = join(sbPath, "main.ts");
				if (existsSync(mainPath)) {
					const content = readFileSync(mainPath, "utf-8");
					const fwMatch = content.match(/@storybook\/([\w-]+)/);
					if (fwMatch) framework = fwMatch[1];
				}
			} catch { /* can't read */ }
			const sbParent = join(sbPath, "..");
			const hasStaticBuild = existsSync(join(sbParent, "storybook-static", "index.html"));
			return { installed: true, framework, running: false, url: null, pid: null, hasStaticBuild };
		}
	}
	return EMPTY_STORYBOOK;
}

export function getVaultBasePath(app: App): string {
	return (app.vault.adapter as unknown as { basePath: string }).basePath;
}

/** Strip ANSI escape codes from terminal output. */
export function stripAnsi(text: string): string {
	// eslint-disable-next-line no-control-regex -- stripping ANSI escape sequences requires matching control chars
	return text.replace(/\x1B\[[0-9;]*[A-Za-z]|\x1B\][^\x07]*\x07|\x1B\][^\x1B]*\x1B\\/g, "");
}

/** Quote an arg for shell usage if it contains spaces and isn't already quoted. */
export function shellQuote(arg: string): string {
	if (arg.includes(" ") && !arg.startsWith('"') && !arg.startsWith("'")) {
		return `"${arg}"`;
	}
	return arg;
}

/** Filter noisy output lines from child processes. */
function isNoisyLine(line: string): boolean {
	const trimmed = line.trim();
	if (/^\|?\s+[A-Z]:[/\\]/.test(trimmed)) return true;
	if (/^\|?\s+at\s/.test(trimmed)) return true;
	if (/telemetry|completely anonymous/i.test(trimmed)) return true;
	if (trimmed === "|" || trimmed === "\u2502") return true;
	return false;
}

export type RunAsyncOptions = { timeoutMs?: number };

/** Run a shell command asynchronously — streams output via callback. Optional timeout kills the child (best-effort on Windows shell trees). */
export function runAsync(
	command: string,
	args: string[],
	cwd: string,
	onOutput?: OutputCallback,
	options?: RunAsyncOptions,
): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		let settled = false;
		let timeoutId: ReturnType<typeof setTimeout> | undefined;

		const finish = (result: { ok: boolean; error?: string }) => {
			if (settled) return;
			settled = true;
			if (timeoutId !== undefined) clearTimeout(timeoutId);
			resolve(result);
		};

		const child = spawn(command, args.map(shellQuote), {
			cwd, shell: true, windowsHide: true, stdio: "pipe",
			env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
		});

		let stderr = "";
		const emit = (line: string) => { if (!isNoisyLine(line)) onOutput?.(line); };

		const timeoutMs = options?.timeoutMs;
		if (timeoutMs !== undefined && timeoutMs > 0) {
			timeoutId = setTimeout(() => {
				onOutput?.(`Timed out after ${Math.round(timeoutMs / 1000)}s — stopping process.`);
				try {
					child.kill();
				} catch {
					/* ignore */
				}
				finish({ ok: false, error: `Timed out after ${timeoutMs}ms` });
			}, timeoutMs);
		}

		child.stdout?.on("data", (chunk: Buffer) => {
			for (const line of stripAnsi(chunk.toString()).split("\n").filter(Boolean)) emit(line);
		});
		child.stderr?.on("data", (chunk: Buffer) => {
			const text = chunk.toString();
			stderr += text;
			for (const line of stripAnsi(text).split("\n").filter(Boolean)) emit(line);
		});
		child.on("error", (err) => {
			onOutput?.(`Error: ${err.message}`);
			finish({ ok: false, error: err.message });
		});
		child.on("close", (code) => {
			if (settled) return;
			if (code === 0) {
				onOutput?.("Done.");
				finish({ ok: true });
			} else {
				const meaningful = stderr.split("\n").map((l) => l.trim())
					.filter((l) => /^(fatal|error|warning):/i.test(l)).slice(-3).join("\n");
				finish({ ok: false, error: meaningful || stderr.trim().split("\n").pop() || `Exit code ${code}` });
			}
		});
	});
}

export function findStorybookConfigDir(absProjectPath: string): string | null {
	for (const dir of STORYBOOK_DIRS) {
		const sbPath = join(absProjectPath, dir);
		if (existsSync(sbPath)) return join(absProjectPath, dir.replace("/.storybook", "").replace(".storybook", "."));
	}
	return null;
}

export function findStorybookDir(absProjectPath: string): string {
	for (const dir of STORYBOOK_DIRS) {
		const sbPath = join(absProjectPath, dir);
		if (existsSync(sbPath)) return sbPath;
	}
	return join(absProjectPath, ".storybook");
}
