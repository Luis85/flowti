/**
 * flowti-cli.mjs — REDIRECT STUB
 *
 * The Flowti CLI has moved to: 01 - Projects/Flowti CLI/src/flowti-cli.mjs
 * This stub redirects all invocations to the new location for backwards compatibility.
 */
import { execSync } from "node:child_process";
import path from "node:path";

const newPath = path.resolve(import.meta.dirname, "..", "..", "..", "01 - Projects", "Flowti CLI", "src", "flowti-cli.mjs");

try {
	execSync(`node "${newPath}" ${process.argv.slice(2).join(" ")}`, { stdio: "inherit" });
} catch (e) {
	process.exit(e.status ?? 1);
}
