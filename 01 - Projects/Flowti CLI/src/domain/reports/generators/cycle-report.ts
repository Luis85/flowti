/**
 * generate-cycle-report.ts
 *
 * Reads the latest completed cycle document and generates a CycleReport
 * vault note with queryable YAML frontmatter.
 *
 * Usage: npx tsx scripts/generate-cycle-report.ts
 */

import { disk } from "../../../infrastructure/filesystem.js";
import path from "node:path";
import { ROOT } from "../../../infrastructure/config.js";
import { Document, type FrontmatterValue } from "../../../infrastructure/document.js";
import { log } from "../../../infrastructure/logger.js";

const CYCLES_DIR: string = path.join(ROOT, "docs", "cycles");
const OUTPUT_DIR: string = path.join(ROOT, "docs", "reports", "cycles");

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns the frontmatter as a plain object.
 */
function parseScalar(rawValue: string): unknown {
	if (rawValue === "true") return true;
	if (rawValue === "false") return false;
	if (/^-?\d+$/.test(rawValue)) return parseInt(rawValue, 10);
	if (/^-?\d+\.\d+$/.test(rawValue)) return parseFloat(rawValue);
	return rawValue.replace(/^["']|["']$/g, "");
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
	const match: RegExpMatchArray | null = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) return null;

	const fm: Record<string, unknown> = {};
	const lines: string[] = match[1].split(/\r?\n/);
	let currentKey: string | null = null;
	let inArray: boolean = false;

	for (const line of lines) {
		if (inArray && /^\s+-\s+/.test(line)) {
			const value: string = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
			(fm[currentKey!] as string[]).push(value);
			continue;
		}

		const kvMatch: RegExpMatchArray | null = line.match(/^(\w[\w_]*):\s*(.*)/);
		if (!kvMatch) { inArray = false; continue; }

		const key: string = kvMatch[1];
		const rawValue: string = kvMatch[2].trim();

		if (rawValue === "" || rawValue === "[]") {
			currentKey = key;
			fm[key] = [];
			inArray = rawValue === "";
			continue;
		}

		inArray = false;
		currentKey = null;
		fm[key] = parseScalar(rawValue);
	}

	return fm;
}

/**
 * Find the latest cycle document with stage: done.
 */
function findLatestDoneCycle(): { file: string; frontmatter: Record<string, unknown> } | null {
	if (!disk.existsSync(CYCLES_DIR)) return null;

	const files: string[] = disk.readdirSync(CYCLES_DIR).filter((f: string) => f.startsWith("Cycle ") && f.endsWith(".md"));

	let best: { file: string; frontmatter: Record<string, unknown> } | null = null;
	let bestCycle: number = -1;

	for (const file of files) {
		const content: string = disk.readFileSync(path.join(CYCLES_DIR, file), "utf-8");
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

interface CycleReportData extends Record<string, FrontmatterValue> {
	type: string;
	date: string;
	cycle: number;
	stage: string;
	date_planned: string;
	date_completed: string;
	increments: number;
	estimated_increments: number;
	tests_added: number;
	total_tests: number;
	suites_added: number;
	total_suites: number;
	pbis_delivered: number;
	debt_resolved: number;
}

function fmNum(fm: Record<string, unknown>, key: string, fallback = 0): number {
	return (fm[key] as number) ?? fallback;
}

function fmStr(fm: Record<string, unknown>, key: string, fallback = ""): string {
	return (fm[key] as string) ?? fallback;
}

function fmArr(fm: Record<string, unknown>, key: string): string[] {
	return (fm[key] as string[]) ?? [];
}

function buildCycleReportData(fm: Record<string, unknown>, date: string): CycleReportData {
	const preCycleTests = fmNum(fm, "pre_cycle_tests");
	const totalTests = fmNum(fm, "total_tests_after", preCycleTests);
	const preCycleSuites = fmNum(fm, "pre_cycle_suites");
	const totalSuites = fmNum(fm, "total_test_files_after", preCycleSuites);
	const increments = fmNum(fm, "actual_increments", fmNum(fm, "estimated_increments"));

	return {
		type: "CycleReport",
		date,
		cycle: fmNum(fm, "cycle"),
		stage: fmStr(fm, "stage", "unknown"),
		date_planned: fmStr(fm, "date_planned"),
		date_completed: fmStr(fm, "date_completed"),
		increments,
		estimated_increments: fmNum(fm, "estimated_increments"),
		tests_added: totalTests - preCycleTests,
		total_tests: totalTests,
		suites_added: totalSuites - preCycleSuites,
		total_suites: totalSuites,
		pbis_delivered: fmArr(fm, "pbis").length,
		debt_resolved: fmArr(fm, "tech_debt").length,
	};
}

function collectReportLinks(): string[] {
	const links: string[] = [];
	const reportDirs: { dir: string; suffix: string }[] = [
		{ dir: path.join(ROOT, "docs", "reports", "tests"), suffix: "test-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "coverage"), suffix: "coverage-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "codebase"), suffix: "codebase-report.md" },
		{ dir: path.join(ROOT, "docs", "reports", "builds"), suffix: "build-report" },
	];
	for (const { dir, suffix } of reportDirs) {
		if (!disk.existsSync(dir)) continue;
		const files = disk.readdirSync(dir).filter((f) => f.endsWith(".md") && f.includes(suffix));
		if (files.length > 0) {
			files.sort();
			links.push(files[files.length - 1].replace(/\.md$/, ""));
		}
	}
	return links;
}

function main(): void {
	const latest = findLatestDoneCycle();
	if (!latest) {
		log("[report] No completed cycle document found — skipping cycle report.");
		return;
	}

	const fm = latest.frontmatter;
	const now = new Date();
	const report = buildCycleReportData(fm, now.toISOString());
	const pbis = (fm.pbis as string[]) ?? [];
	const techDebt = (fm.tech_debt as string[]) ?? [];
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

	if (pbis.length > 0) { doc.heading(2, "PBIs Delivered").addBlank(); doc.list(pbis); doc.addBlank(); }
	if (techDebt.length > 0) { doc.heading(2, "Tech Debt Resolved").addBlank(); doc.list(techDebt); doc.addBlank(); }

	const reportLinks = collectReportLinks();
	if (reportLinks.length > 0) {
		doc.heading(2, "Related Reports").addBlank();
		doc.list(reportLinks.map((link) => Document.wikilink(link)));
		doc.addBlank();
	}

	const safeTimestamp = now.toISOString().replace(/:/g, "-");
	const outputPath = path.join(OUTPUT_DIR, `${safeTimestamp}-cycle-${report.cycle}-report.md`);
	doc.save(outputPath);

	log(`[report] CycleReport written: ${outputPath}`);
}

main();
