/**
 * Redirect stub — delegates to the CLI project.
 * Source: 01 - Projects/Flowti CLI/scripts/generate-trace-report.mjs
 */

import { spawnSync } from "node:child_process";
import path from "node:path";

const VAULT_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const SCRIPT = path.join(VAULT_ROOT, "01 - Projects", "Flowti CLI", "scripts", "generate-trace-report.mjs");
const result = spawnSync(process.execPath, [SCRIPT, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 0);
