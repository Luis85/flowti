/**
 * _redirect.mjs — Shared redirect logic for stub scripts.
 *
 * All scripts have moved to "01 - Projects/Flowti CLI/".
 * Stubs in this folder delegate to the new location via this helper.
 *
 * Usage:
 *   import { redirect } from "./_redirect.mjs";
 *   redirect("generate-build-report.mjs");              // → CLI scripts/
 *   redirect("flowti-cli.mjs", "src");                  // → CLI src/
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const VAULT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const CLI_PROJECT = path.join(VAULT_ROOT, "01 - Projects", "Flowti CLI");

export function redirect(scriptName, subdir = "scripts") {
	const tsName = scriptName.replace(/\.mjs$/, ".js");
	const script = path.join(CLI_PROJECT, "dist", subdir, tsName);
	const result = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: "inherit" });
	process.exit(result.status ?? 0);
}
