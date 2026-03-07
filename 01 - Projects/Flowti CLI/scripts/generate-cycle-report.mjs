/**
 * generate-cycle-report.mjs
 *
 * Reads the latest completed cycle document and generates a CycleReport
 * vault note with queryable YAML frontmatter.
 *
 * Usage: node scripts/generate-cycle-report.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../src/infrastructure/config.mjs";
import { Document } from "../src/infrastructure/document.mjs";

const CYCLES_DIR = path.join(ROOT, "docs", "cycles");
const OUTPUT_DIR = path.join(ROOT, "docs", "reports", "cycles");

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the frontmatter as a plain object.
 */
function parseFrontmatter(content) {
	const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const fm = {};
	const lines = match[1].split(/\r?\n/);
	let currentKey = null;
	let inArray = false;

	for (const line of lines) {
		// Array item (indented with "- ")
		if (inArray && /^\s+-\s+/.test(line)) {
			const value = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
			fm[currentKey].push(value);
			continue;
		}

		// Key-value pair
		const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) {
			inArray = false;
			continue;
		}

		const key = kvMatch[1];
		const rawValue = kvMatch[2].trim();

		// Empty value followed by array items
		if (rawValue === "" || rawValue === "[]") {
			currentKey = key;
			fm[key] = rawValue === "[]" ? [] : [];
			inArray = rawValue === "";
			continue;
		}

		// Scalar value
		inArray = false;
		currentKey = null;

		if (rawValue === "true") fm[key] = true;
		else if (rawValue === "false") fm[key] = false;
		else if (/^-?\d+$/.test(rawValue)) fm[key] = parseInt(rawValue, 10);
		else if (/^-?\d+\.\d+$/.test(rawValue)) fm[key] = parseFloat(rawValue);
		else fm[key] = rawValue.replace(/^["']|["']$/g, "");
	}

	return fm;
}

/**
 * Find the latest cycle document with stage: done.
 */
function findLatestDoneCycle() {
	if (!fs.existsSync(CYCLES_DIR)) return null;

	const files = fs.readdirSync(CYCLES_DIR).filter((f) => f.startsWith("Cycle ") && f.endsWith(".md"));

	let best = null;
	let bestCycle = -1;

	for (const file of files) {
		const content = fs.readFileSync(path.join(CYCLES_DIR, file), "utf-8");
		const fm = parseFrontmatter(content);
		if (!fm || fm.stage !== "done") continue;
		const cycle = fm.cycle ?? 0;
		if (cycle > bestCycle) {
			bestCycle = cycle;
			best = { file, frontmatter: fm };
		}
	}

	return best;
}

function main() {
	const latest = findLatestDoneCycle();
	if (!latest) {
		console.log("[report] No completed cycle document found — skipping cycle report.");
		return;
	}

	const fm = latest.frontmatter;
	const now = new Date();
	const date = now.toISOString();

	const preCycleTests = fm.pre_cycle_tests ?? 0;
	const totalTests = fm.total_tests_after ?? preCycleTests;
	const preCycleSuites = fm.pre_cycle_suites ?? 0;
	const totalSuites = fm.total_test_files_after ?? preCycleSuites;
	const pbis = fm.pbis ?? [];
	const techDebt = fm.tech_debt ?? [];

	const report = {
		type: "CycleReport",
		date,
		cycle: fm.cycle ?? 0,
		stage: fm.stage ?? "unknown",
		date_planned: fm.date_planned ?? "",
		date_completed: fm.date_completed ?? "",
		increments: fm.actual_increments ?? fm.estimated_increments ?? 0,
		estimated_increments: fm.estimated_increments ?? 0,
		tests_added: totalTests - preCycleTests,
		total_tests: totalTests,
		suites_added: totalSuites - preCycleSuites,
		total_suites: totalSuites,
		pbis_delivered: pbis.length,
		debt_resolved: techDebt.length,
	};

	const cycleDocTitle = latest.file.replace(/\.md$/, "");

	const doc = Document.create(`Cycle ${report.cycle} Report`)
		.mergeFrontmatter(report)
		.addBlank()
		.heading(1, `Cycle ${report.cycle} Report`)
		.addBlank()
		.callout("info", "Summary", [
			`Stage: ${report.stage} | Increments: ${report.increments} (est. ${report.estimated_increments})`,
			`Tests added: ${report.tests_added} | Total: ${report.total_tests}`,
			`Suites added: ${report.suites_added} | Total: ${report.total_suites}`,
			`PBIs delivered: ${report.pbis_delivered} | Debt resolved: ${report.debt_resolved}`,
			`Planned: ${report.date_planned || "N/A"} | Completed: ${report.date_completed || "N/A"}`,
		])
		.addBlank()
		.heading(2, "Source")
		.addBlank()
		.list([Document.wikilink(cycleDocTitle)])
		.addBlank();

	if (pbis.length > 0) {
		doc.heading(2, "PBIs Delivered").addBlank();
		doc.list(pbis);
		doc.addBlank();
	}

	if (techDebt.length > 0) {
		doc.heading(2, "Tech Debt Resolved").addBlank();
		doc.list(techDebt);
		doc.addBlank();
	}

	// Find latest reports to link as related artifacts
	const reportLinks = [];
	const reportDirs = [
		{ dir: path.join(ROOT, "docs", "reports", "tests"), suffix: "test-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "coverage"), suffix: "coverage-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "codebase"), suffix: "codebase-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "builds"), suffix: "build-report" },
	];
	for (const { dir, suffix } of reportDirs) {
		if (!fs.existsSync(dir)) continue;
		const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f.includes(suffix));
		if (files.length > 0) {
			files.sort();
			const latestReport = files[files.length - 1].replace(/\.md$/, "");
			reportLinks.push(latestReport);
		}
	}

	if (reportLinks.length > 0) {
		doc.heading(2, "Related Reports").addBlank();
		doc.list(reportLinks.map((link) => Document.wikilink(link)));
		doc.addBlank();
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const filename = `${safeTimestamp}-cycle-${report.cycle}-report.md`;
	const outputPath = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] CycleReport written: ${outputPath}`);
}

main();
