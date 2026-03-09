/**
 * health.ts — Project health dashboard.
 *
 * Aggregates project metrics from existing data sources (reports, git, source)
 * into a consolidated health view. All data is read from stable report files
 * and filesystem — no commands are executed except git status.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { RESET, BOLD, DIM, GREEN, RED, YELLOW } from "../../infrastructure/ui.js";
import { countFiles } from "../../infrastructure/fs.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import { log } from "../../infrastructure/logger.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Data types ───────────────────────────────────────────────────────

export interface HealthSnapshot {
	name: string;
	source: { files: number; testFiles: number } | null;
	tests: { total: number; passed: number; failed: number; suites: number } | null;
	coverage: { lines: number; branches: number; functions: number } | null;
	build: { success: boolean; durationMs: number } | null;
	lint: { errors: number; warnings: number } | null;
	git: { branch: string; status: string } | null;
	components: number;
}

// ── Data collection ──────────────────────────────────────────────────

function collectSourceMetrics(projectPath: string): HealthSnapshot["source"] {
	const srcDir = paths.join(projectPath, "src");
	const testsDir = paths.join(projectPath, "tests");
	if (!disk.existsSync(srcDir)) return null;
	const tsCount = countFiles(srcDir, ".ts");
	const jsCount = countFiles(srcDir, ".js");
	const testTs = disk.existsSync(testsDir) ? countFiles(testsDir, ".ts") : 0;
	const testJs = disk.existsSync(testsDir) ? countFiles(testsDir, ".js") : 0;
	return { files: tsCount || jsCount, testFiles: testTs || testJs };
}

function readReportFrontmatter(reportPath: string): Record<string, unknown> | null {
	if (!disk.existsSync(reportPath)) return null;
	try {
		const content = disk.readFileSync(reportPath, "utf-8");
		return parseFrontmatterContent(content);
	} catch { return null; }
}

function collectTestMetrics(reportsDir: string): HealthSnapshot["tests"] {
	const fm = readReportFrontmatter(paths.join(reportsDir, "Test Report.md"));
	if (!fm) return null;
	return {
		total: Number(fm.total_tests ?? 0),
		passed: Number(fm.passed ?? 0),
		failed: Number(fm.failed ?? 0),
		suites: Number(fm.total_suites ?? 0),
	};
}

function collectCoverageMetrics(reportsDir: string): HealthSnapshot["coverage"] {
	const fm = readReportFrontmatter(paths.join(reportsDir, "Coverage Report.md"));
	if (!fm) return null;
	return {
		lines: Number(fm.lines_pct ?? 0),
		branches: Number(fm.branches_pct ?? 0),
		functions: Number(fm.functions_pct ?? 0),
	};
}

function collectBuildMetrics(reportsDir: string): HealthSnapshot["build"] {
	const fm = readReportFrontmatter(paths.join(reportsDir, "Build Report.md"));
	if (!fm) return null;
	return {
		success: fm.success === true || fm.success === "true",
		durationMs: Number(fm.duration_ms ?? 0),
	};
}

function collectLintMetrics(reportsDir: string): HealthSnapshot["lint"] {
	const fm = readReportFrontmatter(paths.join(reportsDir, "Project Summary.md"));
	if (!fm) return null;
	if (fm.lint_errors === undefined && fm.lint_warnings === undefined) return null;
	return {
		errors: Number(fm.lint_errors ?? 0),
		warnings: Number(fm.lint_warnings ?? 0),
	};
}

function collectGitMetrics(projectPath: string): HealthSnapshot["git"] {
	const branch = shell.runSilent(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`);
	if (!branch) return null;
	const dirty = shell.runSilent(`git -C "${projectPath}" status --porcelain`);
	return { branch, status: dirty ? "dirty" : "clean" };
}

function countComponents(projectPath: string): number {
	const dir = paths.join(projectPath, "docs", "components");
	if (!disk.existsSync(dir)) return 0;
	return disk.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
}

export function collectHealth(ctx: ProjectContext): HealthSnapshot {
	const reportsDir = paths.join(ctx.path, ctx.config.reports?.dir ?? "reports");
	return {
		name: ctx.config.name,
		source: collectSourceMetrics(ctx.path),
		tests: collectTestMetrics(reportsDir),
		coverage: collectCoverageMetrics(reportsDir),
		build: collectBuildMetrics(reportsDir),
		lint: collectLintMetrics(reportsDir),
		git: collectGitMetrics(ctx.path),
		components: countComponents(ctx.path),
	};
}

// ── Display ──────────────────────────────────────────────────────────

function statusIcon(ok: boolean): string {
	return ok ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
}

function pctColor(pct: number, threshold = 80): string {
	if (pct >= threshold) return `${GREEN}${pct.toFixed(1)}%${RESET}`;
	if (pct >= threshold * 0.75) return `${YELLOW}${pct.toFixed(1)}%${RESET}`;
	return `${RED}${pct.toFixed(1)}%${RESET}`;
}

function displaySource(h: HealthSnapshot): void {
	if (!h.source) return;
	log(`  ${BOLD}Source${RESET}`);
	log(`    Files:          ${h.source.files} source, ${h.source.testFiles} test`);
	log(`    Components:     ${h.components}`);
	log();
}

function displayTests(tests: HealthSnapshot["tests"]): void {
	if (!tests) return;
	log(`  ${BOLD}Tests${RESET}  ${statusIcon(tests.failed === 0)}`);
	log(`    Total:          ${tests.total} (${tests.suites} suites)`);
	log(`    Passed:         ${GREEN}${tests.passed}${RESET}`);
	if (tests.failed > 0) log(`    Failed:         ${RED}${tests.failed}${RESET}`);
	log();
}

function displayCoverage(cov: HealthSnapshot["coverage"]): void {
	if (!cov) return;
	log(`  ${BOLD}Coverage${RESET}`);
	log(`    Lines:          ${pctColor(cov.lines)}`);
	log(`    Branches:       ${pctColor(cov.branches, 70)}`);
	log(`    Functions:      ${pctColor(cov.functions)}`);
	log();
}

function displayBuild(build: HealthSnapshot["build"]): void {
	if (!build) return;
	log(`  ${BOLD}Build${RESET}  ${statusIcon(build.success)}`);
	log(`    Duration:       ${(build.durationMs / 1000).toFixed(1)}s`);
	log();
}

function displayLint(lint: HealthSnapshot["lint"]): void {
	if (!lint) return;
	log(`  ${BOLD}Lint${RESET}  ${statusIcon(lint.errors === 0 && lint.warnings === 0)}`);
	log(`    Errors:         ${lint.errors === 0 ? `${GREEN}0${RESET}` : `${RED}${lint.errors}${RESET}`}`);
	log(`    Warnings:       ${lint.warnings === 0 ? `${GREEN}0${RESET}` : `${YELLOW}${lint.warnings}${RESET}`}`);
	log();
}

function displayGit(git: HealthSnapshot["git"]): void {
	if (!git) return;
	log(`  ${BOLD}Git${RESET}`);
	log(`    Branch:         ${git.branch}`);
	log(`    Status:         ${git.status === "clean" ? `${GREEN}clean${RESET}` : `${YELLOW}dirty${RESET}`}`);
	log();
}

function goodBadIndicator(ok: boolean, label: string): string {
	return ok ? `${GREEN}${label} ✓${RESET}` : `${RED}${label} ✗${RESET}`;
}

function goodWarnIndicator(ok: boolean, label: string): string {
	return ok ? `${GREEN}${label} ✓${RESET}` : `${YELLOW}${label} ~${RESET}`;
}

function buildSummaryIndicators(h: HealthSnapshot): string[] {
	const out: string[] = [];
	if (h.tests) out.push(goodBadIndicator(h.tests.failed === 0, "Tests"));
	if (h.coverage) out.push(goodWarnIndicator(h.coverage.lines >= 80, "Coverage"));
	if (h.build) out.push(goodBadIndicator(h.build.success, "Build"));
	if (h.lint) out.push(goodWarnIndicator(h.lint.errors === 0 && h.lint.warnings === 0, "Lint"));
	if (h.git) out.push(goodWarnIndicator(h.git.status === "clean", "Git"));
	return out;
}

export function displayHealth(h: HealthSnapshot): void {
	log(`\n  ${BOLD}Project Health: ${h.name}${RESET}\n`);

	displaySource(h);
	displayTests(h.tests);
	displayCoverage(h.coverage);
	displayBuild(h.build);
	displayLint(h.lint);
	displayGit(h.git);

	const indicators = buildSummaryIndicators(h);
	if (indicators.length > 0) {
		log(`  ${DIM}Summary:${RESET} ${indicators.join("  ")}`);
		log();
	}

	if (!h.tests && !h.coverage && !h.build && !h.lint) {
		log(`  ${DIM}No report data found. Run reports first to populate the dashboard.${RESET}\n`);
	}
}
