import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

// Developer Onboarding E2E journey — CLI-only, no Obsidian required.
//
// Run via: npx vitest run tests/e2e/60-journey-developer-onboarding.test.ts --config configs/vitest.config.ts
//
// The journey definition is loaded from: tests/e2e/journeys/developer-onboarding.journey

const CLI_ROOT = path.resolve(import.meta.dirname, "..", "..");
const PROJECTS_DIR = path.resolve(CLI_ROOT, "..", "..");

const MAIN_TS = path.join(CLI_ROOT, "src", "main.ts");

function runCli(...args: string[]): { code: number; stdout: string; stderr: string } {
	// On Windows, .cmd files need shell=true. Build a single command string
	// with proper quoting to handle spaces in paths.
	const tsxBin = path.join(CLI_ROOT, "node_modules", ".bin", "tsx");
	const cmd = `"${tsxBin}" "${MAIN_TS}" ${args.join(" ")}`;

	const result = spawnSync(cmd, {
		cwd: PROJECTS_DIR,
		encoding: "utf-8",
		timeout: 15_000,
		env: { ...process.env, FLOWTI_VAULT_ROOT: PROJECTS_DIR },
		shell: true,
	});
	return {
		code: result.status ?? 1,
		stdout: result.stdout ?? "",
		stderr: result.stderr ?? "",
	};
}

describe("Journey: Developer Onboarding", () => {
	it("help command exits with code 0", () => {
		const { code } = runCli("help");
		expect(code).toBe(0);
	});

	it("help build section exits with code 0", () => {
		const { code } = runCli("help", "build");
		expect(code).toBe(0);
	});

	it("scaffold:list exits with code 0", () => {
		const { code } = runCli("scaffold:list");
		expect(code).toBe(0);
	});

	it("scaffold:list outputs available definitions", () => {
		const { stdout } = runCli("scaffold:list");
		expect(stdout.length).toBeGreaterThan(0);
	});

	it("unknown command exits with code 0 (shows error message)", () => {
		const { code } = runCli("nonexistent-command");
		expect(code).toBe(0);
	});

	it("invalid --project shows error with available projects", () => {
		const { code, stdout } = runCli("info", "--project=NonExistentProject");
		expect(code).toBe(0);
		expect(stdout).toContain("Unknown project");
	});

	it("journey definition is valid JSON", () => {
		const journeyPath = path.join(import.meta.dirname, "journeys", "developer-onboarding.journey");
		const content = fs.readFileSync(journeyPath, "utf-8");
		const journey = JSON.parse(content);
		expect(journey.journey).toBe("Developer Onboarding");
		expect(journey.steps.length).toBeGreaterThan(0);
	});
});
