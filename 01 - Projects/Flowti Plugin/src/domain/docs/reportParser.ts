/**
 * reportParser.ts
 *
 * Pure functions to parse Vitest JSON and V8 coverage JSON
 * into structured frontmatter objects for vault notes.
 */

// ── Test Report ──────────────────────────────────────

export interface TestReportFrontmatter {
	type: "TestReport";
	date: string;
	passed: number;
	failed: number;
	skipped: number;
	total: number;
	suites: number;
	duration_ms: number;
	success: boolean;
}

export interface VitestJsonReport {
	numPassedTests?: number;
	numFailedTests?: number;
	numPendingTests?: number;
	numTotalTests?: number;
	numPassedTestSuites?: number;
	numTotalTestSuites?: number;
	startTime?: number;
	success?: boolean;
	testResults?: unknown[];
}

export function parseTestReport(json: VitestJsonReport, date: string): TestReportFrontmatter {
	const passed = json.numPassedTests ?? 0;
	const failed = json.numFailedTests ?? 0;
	const skipped = json.numPendingTests ?? 0;
	const total = json.numTotalTests ?? passed + failed + skipped;
	const suites = json.testResults?.length ?? json.numTotalTestSuites ?? 0;
	const startTime = json.startTime ?? 0;
	const elapsed = startTime > 0 ? Date.now() - startTime : 0;

	return {
		type: "TestReport",
		date,
		passed,
		failed,
		skipped,
		total,
		suites,
		duration_ms: elapsed > 0 ? elapsed : 0,
		success: json.success ?? failed === 0,
	};
}

// ── Coverage Report ──────────────────────────────────

export interface CoverageReportFrontmatter {
	type: "CoverageReport";
	date: string;
	lines_pct: number;
	branches_pct: number;
	functions_pct: number;
	statements_pct: number;
	files_covered: number;
}

export interface CoverageFileEntry {
	s?: Record<string, number>;
	b?: Record<string, number[]>;
	f?: Record<string, number>;
	statementMap?: Record<string, unknown>;
	branchMap?: Record<string, unknown>;
	fnMap?: Record<string, unknown>;
}

export type CoverageFinalJson = Record<string, CoverageFileEntry>;

function computeCoverage(
	entries: CoverageFileEntry[],
	kind: "statements" | "branches" | "functions",
): number {
	let covered = 0;
	let total = 0;

	for (const entry of entries) {
		if (kind === "statements") {
			const counts = entry.s ?? {};
			for (const v of Object.values(counts)) {
				total++;
				if (v > 0) covered++;
			}
		} else if (kind === "branches") {
			const counts = entry.b ?? {};
			for (const branches of Object.values(counts)) {
				for (const v of branches) {
					total++;
					if (v > 0) covered++;
				}
			}
		} else {
			const counts = entry.f ?? {};
			for (const v of Object.values(counts)) {
				total++;
				if (v > 0) covered++;
			}
		}
	}

	if (total === 0) return 0;
	return Math.round((covered / total) * 10000) / 100;
}

export function parseCoverageReport(
	json: CoverageFinalJson,
	date: string,
): CoverageReportFrontmatter {
	const entries = Object.values(json);

	return {
		type: "CoverageReport",
		date,
		lines_pct: computeCoverage(entries, "statements"),
		branches_pct: computeCoverage(entries, "branches"),
		functions_pct: computeCoverage(entries, "functions"),
		statements_pct: computeCoverage(entries, "statements"),
		files_covered: entries.length,
	};
}

// ── Markdown Generation ──────────────────────────────

function yamlEscape(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "boolean" || typeof value === "number") return String(value);
	const str = String(value);
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(str)) return JSON.stringify(str);
	return str;
}

export function toFrontmatter(obj: Record<string, unknown>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(obj)) {
		lines.push(`${key}: ${yamlEscape(value)}`);
	}
	lines.push("---");
	return lines.join("\n");
}

export function generateTestReportMarkdown(fm: TestReportFrontmatter): string {
	return [
		toFrontmatter(fm as unknown as Record<string, unknown>),
		"",
		"# Test Report",
		"",
		`> [!info] Summary`,
		`> Total: ${fm.total} | Passed: ${fm.passed} | Failed: ${fm.failed} | Skipped: ${fm.skipped}`,
		`> Suites: ${fm.suites} | Duration: ${fm.duration_ms}ms`,
		`> Result: ${fm.success ? "PASS" : "FAIL"}`,
		"",
	].join("\n");
}

export function generateCoverageReportMarkdown(fm: CoverageReportFrontmatter): string {
	return [
		toFrontmatter(fm as unknown as Record<string, unknown>),
		"",
		"# Coverage Report",
		"",
		`> [!info] Summary`,
		`> Statements: ${fm.statements_pct}% | Branches: ${fm.branches_pct}%`,
		`> Functions: ${fm.functions_pct}% | Lines: ${fm.lines_pct}%`,
		`> Files: ${fm.files_covered}`,
		"",
	].join("\n");
}

// ── Cycle Report ────────────────────────────────────

export interface CycleFrontmatter {
	type?: string;
	cycle?: number;
	stage?: string;
	date_planned?: string;
	date_completed?: string;
	pbis?: string[];
	bugs?: string[];
	tech_debt?: (string | number)[];
	estimated_increments?: number;
	actual_increments?: number;
	estimated_tests?: number;
	actual_tests?: number;
	pre_cycle_tests?: number;
	pre_cycle_suites?: number;
	total_tests_after?: number;
	total_test_files_after?: number;
}

export interface CycleReportFrontmatter {
	type: "CycleReport";
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

export function parseCycleReport(fm: CycleFrontmatter, date: string): CycleReportFrontmatter {
	const cycle = fm.cycle ?? 0;
	const stage = fm.stage ?? "unknown";
	const preCycleTests = fm.pre_cycle_tests ?? 0;
	const totalTests = fm.total_tests_after ?? preCycleTests;
	const preCycleSuites = fm.pre_cycle_suites ?? 0;
	const totalSuites = fm.total_test_files_after ?? preCycleSuites;
	const pbis = fm.pbis ?? [];
	const techDebt = fm.tech_debt ?? [];

	return {
		type: "CycleReport",
		date,
		cycle,
		stage,
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
}

export interface CycleReportContext {
	cycleDocTitle?: string;
	pbiNames?: string[];
	debtNames?: string[];
	reportLinks?: string[];
}

/** Append a bulleted list section if items are non-empty. */
function appendBulletSection(lines: string[], heading: string, items: string[], prefix = "- "): void {
	if (items.length === 0) return;
	lines.push(`## ${heading}`, "");
	for (const item of items) lines.push(`${prefix}${item}`);
	lines.push("");
}

export function generateCycleReportMarkdown(
	fm: CycleReportFrontmatter,
	ctx?: CycleReportContext,
): string {
	const lines = [
		toFrontmatter(fm as unknown as Record<string, unknown>),
		"",
		`# Cycle ${fm.cycle} Report`,
		"",
		`> [!info] Summary`,
		`> Stage: ${fm.stage} | Increments: ${fm.increments} (est. ${fm.estimated_increments})`,
		`> Tests added: ${fm.tests_added} | Total: ${fm.total_tests}`,
		`> Suites added: ${fm.suites_added} | Total: ${fm.total_suites}`,
		`> PBIs delivered: ${fm.pbis_delivered} | Debt resolved: ${fm.debt_resolved}`,
		`> Planned: ${fm.date_planned || "N/A"} | Completed: ${fm.date_completed || "N/A"}`,
		"",
	];

	if (ctx?.cycleDocTitle) {
		lines.push(`## Source`, "", `- [[${ctx.cycleDocTitle}]]`, "");
	}

	appendBulletSection(lines, "PBIs Delivered", ctx?.pbiNames ?? []);
	appendBulletSection(lines, "Tech Debt Resolved", ctx?.debtNames ?? []);
	appendBulletSection(lines, "Related Reports", (ctx?.reportLinks ?? []).map((l) => `[[${l}]]`));

	return lines.join("\n");
}
