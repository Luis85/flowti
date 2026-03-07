/**
 * _redirect.mjs — Shared redirect logic for stub scripts.
 *
 * All scripts have moved to "01 - Projects/Flowti CLI/".
 * Stubs in this folder delegate to the new location via this helper.
 *
 * Usage:
 *   import { redirect } from "./_redirect.mjs";
 *   redirect("generate-build-report.mjs");              // → CLI bin/
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const VAULT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const CLI_PROJECT = path.join(VAULT_ROOT, "01 - Projects", "Flowti CLI");

/** Maps old script names to their new DDD paths under src/. */
const SCRIPT_MAP = {
	// Report generators → src/domain/reports/generators/
	"generate-build-report": "src/domain/reports/generators/build-report",
	"generate-test-report": "src/domain/reports/generators/test-report",
	"generate-coverage-report": "src/domain/reports/generators/coverage-report",
	"generate-codebase-report": "src/domain/reports/generators/codebase-report",
	"generate-cycle-report": "src/domain/reports/generators/cycle-report",
	"generate-trace-report": "src/domain/reports/generators/trace-report",
	"generate-performance-report": "src/domain/reports/generators/performance-report",
	"generate-complexity-report": "src/domain/reports/generators/complexity-report",
	"generate-command-reference": "src/domain/reports/generators/command-reference",
	"generate-event-catalog": "src/domain/reports/generators/event-catalog",
	"generate-data-dictionary": "src/domain/reports/generators/data-dictionary",
	"generate-tool-reference": "src/domain/reports/generators/tool-reference",
	"generate-cli-reference": "src/domain/reports/generators/cli-reference",
	"generate-e2e-report": "src/domain/reports/generators/e2e-report",
	// Devtools utilities → src/domain/devtools/
	"cli-reload": "src/domain/devtools/cli-reload",
	"fix-frontmatter": "src/domain/devtools/fix-frontmatter",
	"generate-test-data": "src/domain/devtools/generate-test-data",
	// Review → src/domain/review/
	"run-e2e": "src/domain/review/run-e2e",
	// Entry point
	"main": "src/main",
};

export function redirect(scriptName) {
	const baseName = scriptName.replace(/\.mjs$/, "");
	const mapped = SCRIPT_MAP[baseName];
	const script = mapped
		? path.join(CLI_PROJECT, "bin", `${mapped}.js`)
		: path.join(CLI_PROJECT, "bin", "src", `${baseName}.js`);
	const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: "inherit" });
	process.exit(result.status ?? 0);
}
