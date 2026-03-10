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
import { countFiles } from "../../infrastructure/fs.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { ProjectContext } from "../../infrastructure/types.js";

// ── Data types ───────────────────────────────────────────────────────

export interface SecurityMetrics {
	critical: number;
	high: number;
	moderate: number;
	low: number;
	info: number;
	total: number;
}

export interface HealthSnapshot {
	name: string;
	source: { files: number; testFiles: number } | null;
	tests: { total: number; passed: number; failed: number; suites: number } | null;
	coverage: { lines: number; branches: number; functions: number } | null;
	build: { success: boolean; durationMs: number } | null;
	lint: { errors: number; warnings: number } | null;
	git: { branch: string; status: string } | null;
	security: SecurityMetrics | null;
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
		total: Number(fm.total ?? fm.total_tests ?? 0),
		passed: Number(fm.passed ?? 0),
		failed: Number(fm.failed ?? 0),
		suites: Number(fm.suites ?? fm.total_suites ?? 0),
	};
}

function collectCoverageMetrics(reportsDir: string): HealthSnapshot["coverage"] {
	const fm = readReportFrontmatter(paths.join(reportsDir, "Coverage Report.md"));
	if (!fm) return null;
	return {
		lines: Number(fm.lines_pct ?? fm.statements_pct ?? 0),
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
	const hasLint = fm.eslint_errors !== undefined || fm.eslint_warnings !== undefined
		|| fm.lint_errors !== undefined || fm.lint_warnings !== undefined;
	if (!hasLint) return null;
	return {
		errors: Number(fm.eslint_errors ?? fm.lint_errors ?? 0),
		warnings: Number(fm.eslint_warnings ?? fm.lint_warnings ?? 0),
	};
}

function collectGitMetrics(projectPath: string): HealthSnapshot["git"] {
	const branch = shell.runSilent(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`);
	if (!branch) return null;
	const dirty = shell.runSilent(`git -C "${projectPath}" status --porcelain`);
	return { branch, status: dirty ? "dirty" : "clean" };
}

function extractVulnCounts(data: Record<string, unknown>): Record<string, number> | null {
	const vuln = data.metadata
		? (data.metadata as Record<string, unknown>).vulnerabilities as Record<string, number> | undefined
		: data.vulnerabilities as Record<string, number> | undefined;
	return vuln ?? null;
}

function vulnCountsToMetrics(vuln: Record<string, number>): SecurityMetrics {
	return {
		critical: vuln.critical ?? 0,
		high: vuln.high ?? 0,
		moderate: vuln.moderate ?? 0,
		low: vuln.low ?? 0,
		info: vuln.info ?? 0,
		total: vuln.total ?? (vuln.critical + vuln.high + vuln.moderate + vuln.low + (vuln.info ?? 0)),
	};
}

export function parseAuditJson(json: string): SecurityMetrics | null {
	try {
		const data = JSON.parse(json) as Record<string, unknown>;
		const vuln = extractVulnCounts(data);
		if (!vuln) return null;
		return vulnCountsToMetrics(vuln);
	} catch { return null; }
}

function collectSecurityMetrics(projectPath: string): SecurityMetrics | null {
	const packageJson = paths.join(projectPath, "package.json");
	if (!disk.existsSync(packageJson)) return null;
	const { output } = shell.runCaptureStatus("npm audit --json", { cwd: projectPath });
	if (!output) return null;
	return parseAuditJson(output);
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
		security: collectSecurityMetrics(ctx.path),
		components: countComponents(ctx.path),
	};
}

