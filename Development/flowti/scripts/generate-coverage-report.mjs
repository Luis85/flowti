/**
 * generate-coverage-report.mjs
 *
 * Reads the V8 coverage-final.json and generates a CoverageReport vault note
 * with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-coverage-report.mjs [--build-type=flow|full]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const buildTypeArg = process.argv.find((a) => a.startsWith("--build-type="));
const buildType = buildTypeArg ? buildTypeArg.split("=")[1] : "flow";

const COVERAGE_JSON = path.join(ROOT, "docs", "reports", "tests", "coverage-final.json");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "coverage");

function yamlEscape(value) {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

function computeCoverage(entries, kind) {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		if (kind === "statements") {
			for (const v of Object.values(entry.s ?? {})) {
				total++;
				if (v > 0) covered++;
			}
		} else if (kind === "branches") {
			for (const branches of Object.values(entry.b ?? {})) {
				for (const v of branches) {
					total++;
					if (v > 0) covered++;
				}
			}
		} else {
			for (const v of Object.values(entry.f ?? {})) {
				total++;
				if (v > 0) covered++;
			}
		}
	}

	if (total === 0) return 0;
	return Math.round((covered / total) * 10000) / 100;
}

function main() {
	if (!fs.existsSync(COVERAGE_JSON)) {
		console.log("[report] No coverage-final.json found — run tests with --coverage first.");
		return;
	}

	const json = JSON.parse(fs.readFileSync(COVERAGE_JSON, "utf-8"));
	const entries = Object.values(json);
	const now = new Date();
	const date = now.toISOString();

	const fm = {
		type: "CoverageReport",
		build_type: buildType,
		date,
		lines_pct: computeCoverage(entries, "statements"),
		branches_pct: computeCoverage(entries, "branches"),
		functions_pct: computeCoverage(entries, "functions"),
		statements_pct: computeCoverage(entries, "statements"),
		files_covered: entries.length,
	};

	const frontmatter = ["---", ...Object.entries(fm).map(([k, v]) => `${k}: ${yamlEscape(v)}`), "---"].join("\n");

	const body = [
		"",
		"# Coverage Report",
		"",
		"> [!info] Summary",
		`> Statements: ${fm.statements_pct}% | Branches: ${fm.branches_pct}%`,
		`> Functions: ${fm.functions_pct}% | Lines: ${fm.lines_pct}%`,
		`> Files: ${fm.files_covered}`,
		"",
	].join("\n");

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const prefix = buildType === "full" ? "" : `${buildType}-`;
	const filename = `${safeTimestamp}-${prefix}coverage-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	fs.mkdirSync(OUTPUT_DIR, { recursive: true });
	fs.writeFileSync(outputPath, frontmatter + body, "utf-8");

	console.log(`[report] CoverageReport written: ${outputPath}`);
}

main();
