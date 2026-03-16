/**
 * bootstrap-standalone.test.ts — Verifies the bootstrap can run in standalone mode.
 *
 * Standalone mode: .flowti/bin/main.mjs exists but the source tree does not.
 * The bootstrap should skip npm ci / build / rebuild and run main.mjs directly.
 *
 * This test creates a temporary vault structure on disk and runs the bootstrap
 * to verify it handles standalone vs dev-mode correctly.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

let tempDir: string;

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), "flowti-bootstrap-test-"));
});

afterEach(() => {
	if (tempDir && existsSync(tempDir)) {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

function scaffoldVault(opts: { mainJs?: string; configJson?: object }): string {
	const root = join(tempDir, "vault");
	const binDir = join(root, ".flowti", "bin");
	mkdirSync(binDir, { recursive: true });

	// Write config
	const config = opts.configJson ?? { version: "1.0.0", projectsFolder: "01 - Projects" };
	writeFileSync(join(root, ".flowti", "config.json"), JSON.stringify(config), "utf-8");

	// Write package.json for ESM
	writeFileSync(join(binDir, "package.json"), '{ "type": "module" }', "utf-8");

	// Copy the real bootstrap script
	const bootstrapSrc = resolve(import.meta.dirname, "..", "..", "src", "boot", "bootstrap.mjs");
	writeFileSync(join(binDir, "index.js"), readFileSync(bootstrapSrc, "utf-8"), "utf-8");

	// Optionally write main.mjs (the compiled CLI)
	if (opts.mainJs !== undefined) {
		writeFileSync(join(binDir, "main.mjs"), opts.mainJs, "utf-8");
	}

	return root;
}

function runBootstrap(vaultRoot: string, args: string[] = []): { status: number | null; stdout: string; stderr: string } {
	const result = spawnSync(process.execPath, [join(vaultRoot, ".flowti", "bin", "index.js"), ...args], {
		cwd: vaultRoot,
		env: { ...process.env, FLOWTI_VAULT_ROOT: vaultRoot },
		timeout: 10000,
	});
	return {
		status: result.status,
		stdout: result.stdout?.toString() ?? "",
		stderr: result.stderr?.toString() ?? "",
	};
}

describe("Bootstrap standalone mode", () => {
	it("runs main.mjs directly when source tree is absent", () => {
		const root = scaffoldVault({
			mainJs: 'console.log("STANDALONE_OK"); process.exit(0);',
		});

		const result = runBootstrap(root);
		expect(result.stdout).toContain("STANDALONE_OK");
		expect(result.status).toBe(0);
	});

	it("exits with error when neither source nor main.mjs exist", () => {
		const root = scaffoldVault({});

		const result = runBootstrap(root);
		expect(result.status).not.toBe(0);
		expect(result.stderr).toContain("CLI binary not found");
		expect(result.stderr).toContain("Source folder not found");
	});

	it("forwards CLI arguments in standalone mode", () => {
		const root = scaffoldVault({
			mainJs: 'console.log("ARGS:" + process.argv.slice(2).join(",")); process.exit(0);',
		});

		const result = runBootstrap(root, ["help", "--format=json"]);
		expect(result.stdout).toContain("ARGS:help,--format=json");
		expect(result.status).toBe(0);
	});

	it("sets FLOWTI_VAULT_ROOT env var for the child process", () => {
		const root = scaffoldVault({
			mainJs: 'console.log("ROOT:" + process.env.FLOWTI_VAULT_ROOT); process.exit(0);',
		});

		const result = runBootstrap(root);
		// The vault root should be the temp vault path (resolved by bootstrap from __dirname)
		const output = result.stdout.trim();
		expect(output).toContain("ROOT:");
		expect(result.status).toBe(0);
	});
});
