/**
 * _redirect.mjs — Shared redirect logic for stub scripts.
 *
 * All scripts have moved to "01 - Projects/Flowti CLI/".
 * Stubs in this folder delegate to the new location via this helper.
 *
 * - "main" runs the bundled CLI at bin/main.js
 * - Everything else runs via tsx from source
 *
 * Usage:
 *   import { redirect } from "./_redirect.mjs";
 *   redirect("generate-build-report.mjs");
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const VAULT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const CLI_PROJECT = path.join(VAULT_ROOT, "01 - Projects", "Flowti CLI");
const TSX = path.join(CLI_PROJECT, "node_modules", ".bin", "tsx");

/** Maps old script names to their TypeScript source paths. */
const SCRIPT_MAP = {
	// Report generators
	"generate-build-report": "src/domain/reports/generators/build-report.ts",
	"generate-test-report": "src/domain/reports/generators/test-report.ts",
	"generate-coverage-report": "src/domain/reports/generators/coverage-report.ts",
	"generate-codebase-report": "src/domain/reports/generators/codebase-report.ts",
	"generate-cycle-report": "src/domain/reports/generators/cycle-report.ts",
	"generate-trace-report": "src/domain/reports/generators/trace-report.ts",
	"generate-performance-report": "src/domain/reports/generators/performance-report.ts",
	"generate-complexity-report": "src/domain/reports/generators/complexity-report.ts",
	"generate-command-reference": "src/domain/reports/generators/command-reference.ts",
	"generate-event-catalog": "src/domain/reports/generators/event-catalog.ts",
	"generate-data-dictionary": "src/domain/reports/generators/data-dictionary.ts",
	"generate-tool-reference": "src/domain/reports/generators/tool-reference.ts",
	"generate-cli-reference": "src/domain/reports/generators/cli-reference.ts",
	"generate-e2e-report": "src/domain/reports/generators/e2e-report.ts",
	// Devtools utilities
	"cli-reload": "src/domain/devtools/cli-reload.ts",
	"fix-frontmatter": "src/domain/devtools/fix-frontmatter.ts",
	"generate-test-data": "src/domain/devtools/generate-test-data.ts",
	// Review
	"run-e2e": "src/domain/review/run-e2e.ts",
};

export function redirect(scriptName) {
	const baseName = scriptName.replace(/\.mjs$/, "");

	// Main CLI — use the bundled output
	if (baseName === "main") {
		const bin = path.join(CLI_PROJECT, "bin", "main.js");
		const result = spawnSync(process.execPath, [bin, ...process.argv.slice(2)], { stdio: "inherit" });
		process.exit(result.status ?? 0);
	}

	// Individual scripts — run via tsx from source
	const mapped = SCRIPT_MAP[baseName];
	if (!mapped) {
		console.error(`[redirect] Unknown script: ${baseName}`);
		process.exit(1);
	}
	const script = path.join(CLI_PROJECT, mapped);
	const result = spawnSync(TSX, [script, ...process.argv.slice(2)], { stdio: "inherit", cwd: CLI_PROJECT });
	process.exit(result.status ?? 0);
}
