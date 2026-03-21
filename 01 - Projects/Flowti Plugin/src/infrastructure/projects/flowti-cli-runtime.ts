/**
 * The vault CLI bundle (`main.mjs`) leaves `react` and `ink` as external imports
 * (Ink-based menus). Node resolves them from `.flowti/bin/node_modules`.
 * If missing, any CLI command fails with ERR_MODULE_NOT_FOUND.
 *
 * This module ensures those packages are installed once under `.flowti/bin`.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

/** Versions compatible with Flowti CLI bundles using Ink 4.x. */
const CLI_UI_DEPS: Record<string, string> = {
	react: "^18.3.1",
	ink: "^4.4.1",
};

export type CliOutputLine = (line: string) => void;

/** Prefer explicit entry file so behavior matches `node main.mjs`. */
export function resolveFlowtiCliEntry(binDir: string): string {
	const mainMjs = join(binDir, "main.mjs");
	if (existsSync(mainMjs)) return mainMjs;
	const indexMjs = join(binDir, "index.mjs");
	if (existsSync(indexMjs)) return indexMjs;
	return binDir;
}

function cliRuntimeReady(binDir: string): boolean {
	return existsSync(join(binDir, "node_modules", "react", "package.json"))
		&& existsSync(join(binDir, "node_modules", "ink", "package.json"));
}

function writeMergedPackageJson(binDir: string): void {
	const pkgPath = join(binDir, "package.json");
	let base: Record<string, unknown> = {
		type: "module",
		private: true,
	};
	if (existsSync(pkgPath)) {
		try {
			const parsed = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
			base = { ...base, ...parsed };
		} catch {
			/* keep defaults */
		}
	}
	const prevDeps = (base.dependencies as Record<string, string> | undefined) ?? {};
	base.dependencies = { ...prevDeps, ...CLI_UI_DEPS };
	mkdirSync(binDir, { recursive: true });
	writeFileSync(pkgPath, `${JSON.stringify(base, null, 2)}\n`, "utf-8");
}

function runNpmInstall(binDir: string, onLine?: CliOutputLine): Promise<{ ok: boolean; error?: string }> {
	return new Promise((resolve) => {
		const child = spawn("npm", ["install", "--no-fund", "--no-audit"], {
			cwd: binDir,
			shell: true,
			windowsHide: true,
			stdio: "pipe",
			env: { ...process.env },
		});
		let stderr = "";
		const emit = (chunk: Buffer) => {
			const text = chunk.toString();
			for (const line of text.split(/\r?\n/).filter(Boolean)) {
				onLine?.(line);
			}
		};
		child.stdout?.on("data", emit);
		child.stderr?.on("data", (c: Buffer) => {
			stderr += c.toString();
			emit(c);
		});
		child.on("error", (err) => {
			onLine?.(`npm install failed: ${err.message}`);
			resolve({ ok: false, error: err.message });
		});
		child.on("close", (code) => {
			if (code === 0) resolve({ ok: true });
			else resolve({ ok: false, error: stderr.trim().split("\n").pop() ?? `npm exited ${code}` });
		});
	});
}

/**
 * Ensures `react` and `ink` exist under `binDir/node_modules`.
 * Writes/merges `package.json` and runs `npm install` when needed.
 */
export async function ensureFlowtiCliRuntimeDeps(
	binDir: string,
	onLine?: CliOutputLine,
): Promise<{ ok: boolean; error?: string }> {
	if (!existsSync(binDir)) {
		return { ok: false, error: `Flowti CLI folder missing: ${binDir}` };
	}
	const entry = resolveFlowtiCliEntry(binDir);
	if (entry !== binDir && !existsSync(entry)) {
		return { ok: false, error: `Flowti CLI bundle missing in ${binDir} (expected main.mjs or index.mjs)` };
	}
	if (cliRuntimeReady(binDir)) return { ok: true };

	onLine?.("One-time setup: installing Flowti CLI UI dependencies (react, ink) in .flowti/bin …");
	try {
		writeMergedPackageJson(binDir);
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, error: `Could not write .flowti/bin/package.json: ${msg}` };
	}
	return runNpmInstall(binDir, onLine);
}
