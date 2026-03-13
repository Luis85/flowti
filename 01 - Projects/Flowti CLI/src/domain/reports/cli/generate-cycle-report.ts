/**
 * generate-cycle-report.ts — CLI project cycle report generator.
 *
 * Reads the latest completed cycle document and generates a CycleReport
 * vault note with queryable YAML frontmatter.
 */

import { Document, type FrontmatterValue } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { parseFrontmatterContent } from "../../../infrastructure/frontmatter.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Types ────────────────────────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────────────

function fmNum(fm: Record<string, unknown>, key: string, fallback = 0): number {
	return (fm[key] as number) ?? fallback;
}

function fmStr(fm: Record<string, unknown>, key: string, fallback = ""): string {
	return (fm[key] as string) ?? fallback;
}

function fmArr(fm: Record<string, unknown>, key: string): string[] {
	return (fm[key] as string[]) ?? [];
}

function findLatestDoneCycle(cyclesDir: string, deps: ReportDeps): { file: string; frontmatter: Record<string, unknown> } | null {
	if (!deps.disk.existsSync(cyclesDir)) return null;

	const files: string[] = deps.disk.readdirSync(cyclesDir).filter((f: string) => f.startsWith("Cycle ") && f.endsWith(".md"));

	let best: { file: string; frontmatter: Record<string, unknown> } | null = null;
	let bestCycle = -1;

	for (const file of files) {
		const content: string = deps.disk.readFileSync(deps.paths.join(cyclesDir, file), "utf-8");
		const fm: Record<string, unknown> | null = parseFrontmatterContent(content);
		if (!fm || fm.stage !== "done") continue;
		const cycle: number = (fm.cycle as number) ?? 0;
		if (cycle > bestCycle) {
			bestCycle = cycle;
			best = { file, frontmatter: fm };
		}
	}

	return best;
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

function collectReportLinks(reportsDir: string, deps: ReportDeps): string[] {
	const links: string[] = [];
	const reportDirs: { dir: string; suffix: string }[] = [
		{ dir: deps.paths.join(reportsDir, "tests"), suffix: "test-report.md" },
		{ dir: deps.paths.join(reportsDir, "coverage"), suffix: "coverage-report.md" },
		{ dir: deps.paths.join(reportsDir, "codebase"), suffix: "codebase-report.md" },
		{ dir: deps.paths.join(reportsDir, "builds"), suffix: "build-report" },
	];
	for (const { dir, suffix } of reportDirs) {
		if (!deps.disk.existsSync(dir)) continue;
		const files = deps.disk.readdirSync(dir).filter((f) => f.endsWith(".md") && f.includes(suffix));
		if (files.length > 0) {
			files.sort();
			links.push(files[files.length - 1].replace(/\.md$/, ""));
		}
	}
	return links;
}

// ── Generator ────────────────────────────────────────────────────────

export function generateCycleReport(projectPath: string, deps: ReportDeps, ctx?: PipelineContext, options?: { pluginRoot?: string }): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const pluginRoot = options?.pluginRoot ?? projectPath;
	const cyclesDir = deps.paths.join(pluginRoot, "docs", "cycles");

	const latest = findLatestDoneCycle(cyclesDir, deps);
	if (!latest) {
		log("[cli-report] No completed cycle document found — skipping cycle report.");
		return { success: false, outputPath: "", metrics: {}, error: "No completed cycle document found" };
	}

	const fm = latest.frontmatter;
	const date = deps.clock.iso();
	const report = buildCycleReportData(fm, date);
	const pbis = fmArr(fm, "pbis");
	const techDebt = fmArr(fm, "tech_debt");
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

	const reportLinks = collectReportLinks(svc.reportsDir, deps);
	if (reportLinks.length > 0) {
		doc.heading(2, "Related Reports").addBlank();
		doc.list(reportLinks.map((link) => Document.wikilink(link)));
		doc.addBlank();
	}

	const outputPath = svc.save(doc, {
		subdir: "cycles",
		slug: `cycle-${report.cycle}-report`,
		stableFilename: `Cycle ${report.cycle} Report.md`,
	});

	log(`[cli-report] Cycle Report (Cycle ${report.cycle})`);
	log(`  Increments: ${report.increments} | Tests added: ${report.tests_added} | PBIs: ${report.pbis_delivered}`);
	log(`  Written: ${outputPath}`);

	return {
		success: true,
		outputPath,
		metrics: {
			cycle: report.cycle,
			increments: report.increments,
			tests_added: report.tests_added,
			total_tests: report.total_tests,
			pbis_delivered: report.pbis_delivered,
		},
	};
}
