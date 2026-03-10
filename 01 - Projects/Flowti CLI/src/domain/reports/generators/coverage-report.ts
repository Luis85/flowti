/**
 * generate-coverage-report.ts
 *
 * Reads the V8 coverage-final.json and generates a CoverageReport vault note
 * with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-coverage-report.ts [--build-type=flow|full]
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

import { proc } from "../../../infrastructure/proc.js";
import { clock } from "../../../infrastructure/clock.js";

const buildTypeArg = proc.argv().find((a) => a.startsWith("--build-type="));
const buildType = buildTypeArg ? buildTypeArg.split("=")[1] : "flow";

const COVERAGE_JSON = paths.join(PLUGIN_ROOT, "docs", "reports", "coverage", "coverage-final.json");
const OUTPUT_DIR = paths.join(PLUGIN_ROOT, "docs", "reports", "coverage");

interface CoverageEntry {
	s?: Record<string, number>;
	b?: Record<string, number[]>;
	f?: Record<string, number>;
}

function collectCovCounts(entry: CoverageEntry, kind: string): number[] {
	if (kind === "statements") return Object.values(entry.s ?? {});
	if (kind === "branches") return Object.values(entry.b ?? {}).flat();
	return Object.values(entry.f ?? {});
}

function computeCoverage(entries: CoverageEntry[], kind: string): number {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		for (const v of collectCovCounts(entry, kind)) {
			total++;
			if (v > 0) covered++;
		}
	}

	if (total === 0) return 0;
	return Math.round((covered / total) * 10000) / 100;
}

function main(): void {
	if (!disk.existsSync(COVERAGE_JSON)) {
		return;
	}

	const json = JSON.parse(disk.readFileSync(COVERAGE_JSON, "utf-8"));
	const entries: CoverageEntry[] = Object.values(json);
	const date = clock.iso();

	const fm: Record<string, string | number> = {
		type: "CoverageReport",
		build_type: buildType,
		date,
		lines_pct: computeCoverage(entries, "statements"),
		branches_pct: computeCoverage(entries, "branches"),
		functions_pct: computeCoverage(entries, "functions"),
		statements_pct: computeCoverage(entries, "statements"),
		files_covered: entries.length,
	};

	const doc = Document.create("Coverage Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Coverage Report")
		.addBlank()
		.callout("info", "Summary", [
			`Statements: ${fm.statements_pct}% | Branches: ${fm.branches_pct}%`,
			`Functions: ${fm.functions_pct}% | Lines: ${fm.lines_pct}%`,
			`Files: ${fm.files_covered}`,
		])
		.addBlank();

	const safeTimestamp = clock.safeIso();
	const prefix = buildType === "full" ? "" : `${buildType}-`;
	const filename = `${safeTimestamp}-${prefix}coverage-report.md`;
	const outputPath = paths.join(OUTPUT_DIR, filename);

	doc.save(outputPath);
}

main();
