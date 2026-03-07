/**
 * generate-cycle-report.ts
 *
 * Reads the latest completed cycle document and generates a CycleReport
 * vault note with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-cycle-report.ts
 */

import fs from "node:fs";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document } from "../../../infrastructure/document.js";

const CYCLES_DIR: string = path.join(ROOT, "docs", "cycles");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reports", "cycles");

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the frontmatter as a plain object.
 */
function parseFrontmatter(content: string): Record<string, unknown> | null {
	const match: RegExpMatchArray | null = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const fm: Record<string, unknown> = {};
	const lines: string[] = match[1].split(/\r?\n/);
	let currentKey: string | null = null;
	let inArray: boolean = false;

	for (const line of lines) {
		// Array item (indented with "- ")
		if (inArray && /^\s+-\s+/.test(line)) {
			const value: string = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
			(fm[currentKey!] as string[]).push(value);
			continue;
		}

		// Key-value pair
		const kvMatch: RegExpMatchArray | null = line.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) {
			inArray = false;
			continue;
		}

		const key: string = kvMatch[1];
		const rawValue: string = kvMatch[2].trim();

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
function findLatestDoneCycle(): { file: string; frontmatter: Record<string, unknown> } | null {
	if (!fs.existsSync(CYCLES_DIR)) return null;

	const files: string[] = fs.readdirSync(CYCLES_DIR).filter((f: string) => f.startsWith("Cycle ") && f.endsWith(".md"));

	let best: { file: string; frontmatter: Record<string, unknown> } | null = null;
	let bestCycle: number = -1;

	for (const file of files) {
		const content: string = fs.readFileSync(path.join(CYCLES_DIR, file), "utf-8");
		const fm: Record<string, unknown> | null = parseFrontmatter(content);
		if (!fm || fm.stage !== "done") continue;
		const cycle: number = (fm.cycle as number) ?? 0;
		if (cycle > bestCycle) {
			bestCycle = cycle;
			best = { file, frontmatter: fm };
		}
	}

	return best;
}

function main(): void {
	const latest = findLatestDoneCycle();
	if (!latest) {
		console.log("[report] No completed cycle document found — skipping cycle report.");
		return;
	}

	const fm: Record<string, unknown> = latest.frontmatter;
	const now: Date = new Date();
	const date: string = now.toISOString();

	const preCycleTests: number = (fm.pre_cycle_tests as number) ?? 0;
	const totalTests: number = (fm.total_tests_after as number) ?? preCycleTests;
	const preCycleSuites: number = (fm.pre_cycle_suites as number) ?? 0;
	const totalSuites: number = (fm.total_test_files_after as number) ?? preCycleSuites;
	const pbis: string[] = (fm.pbis as string[]) ?? [];
	const techDebt: string[] = (fm.tech_debt as string[]) ?? [];

	const report = {
		type: "CycleReport",
		date,
		cycle: (fm.cycle as number) ?? 0,
		stage: (fm.stage as string) ?? "unknown",
		date_planned: (fm.date_planned as string) ?? "",
		date_completed: (fm.date_completed as string) ?? "",
		increments: (fm.actual_increments as number) ?? (fm.estimated_increments as number) ?? 0,
		estimated_increments: (fm.estimated_increments as number) ?? 0,
		tests_added: totalTests - preCycleTests,
		total_tests: totalTests,
		suites_added: totalSuites - preCycleSuites,
		total_suites: totalSuites,
		pbis_delivered: pbis.length,
		debt_resolved: techDebt.length,
	};

	const cycleDocTitle: string = latest.file.replace(/\.md$/, "");

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
	const reportLinks: string[] = [];
	const reportDirs: { dir: string; suffix: string }[] = [
		{ dir: path.join(ROOT, "docs", "reports", "tests"), suffix: "test-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "coverage"), suffix: "coverage-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "codebase"), suffix: "codebase-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "builds"), suffix: "build-report" },
	];
	for (const { dir, suffix } of reportDirs) {
		if (!fs.existsSync(dir)) continue;
		const files: string[] = fs.readdirSync(dir).filter((f: string) => f.endsWith(".md") && f.includes(suffix));
		if (files.length > 0) {
			files.sort();
			const latestReport: string = files[files.length - 1].replace(/\.md$/, "");
			reportLinks.push(latestReport);
		}
	}

	if (reportLinks.length > 0) {
		doc.heading(2, "Related Reports").addBlank();
		doc.list(reportLinks.map((link: string) => Document.wikilink(link)));
		doc.addBlank();
	}

	const safeTimestamp: string = now.toISOString().replace(/:/g, "-");
	const filename: string = `${safeTimestamp}-cycle-${report.cycle}-report.md`;
	const outputPath: string = path.join(OUTPUT_DIR, filename);

	doc.save(outputPath);

	console.log(`[report] CycleReport written: ${outputPath}`);
}

main();
