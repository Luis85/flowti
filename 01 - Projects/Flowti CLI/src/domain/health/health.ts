/**
 * health.ts — Project health dashboard.
 *
 * Aggregates project metrics from existing data sources (reports, git, source)
 * into a consolidated health view. All data is read from stable report files
 * and filesystem — no commands are executed except git status.
 */

import { countFiles } from "../../infrastructure/fs.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { ProjectContext } from "../../infrastructure/types.js";
import type { CliDeps } from "../../infrastructure/deps.js";

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

function collectSourceMetrics(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string): HealthSnapshot["source"] {
	const srcDir = deps.paths.join(projectPath, "src");
	const testsDir = deps.paths.join(projectPath, "tests");
	if (!deps.disk.existsSync(srcDir)) return null;
	const tsCount = countFiles(srcDir, ".ts", deps.disk);
	const jsCount = countFiles(srcDir, ".js", deps.disk);
	const testTs = deps.disk.existsSync(testsDir) ? countFiles(testsDir, ".ts", deps.disk) : 0;
	const testJs = deps.disk.existsSync(testsDir) ? countFiles(testsDir, ".js", deps.disk) : 0;
	return { files: tsCount || jsCount, testFiles: testTs || testJs };
}

function readReportFrontmatter(deps: Pick<CliDeps, "disk">, reportPath: string): Record<string, unknown> | null {
	if (!deps.disk.existsSync(reportPath)) return null;
	try {
		const content = deps.disk.readFileSync(reportPath, "utf-8");
		return parseFrontmatterContent(content);
	} catch { return null; }
}

function collectTestMetrics(deps: Pick<CliDeps, "disk" | "paths">, reportsDir: string): HealthSnapshot["tests"] {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Test Report.md"));
	if (!fm) return null;
	return {
		total: Number(fm.total ?? fm.total_tests ?? 0),
		passed: Number(fm.passed ?? 0),
		failed: Number(fm.failed ?? 0),
		suites: Number(fm.suites ?? fm.total_suites ?? 0),
	};
}

function collectCoverageMetrics(deps: Pick<CliDeps, "disk" | "paths">, reportsDir: string): HealthSnapshot["coverage"] {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Coverage Report.md"));
	if (!fm) return null;
	return {
		lines: Number(fm.lines_pct ?? fm.statements_pct ?? 0),
		branches: Number(fm.branches_pct ?? 0),
		functions: Number(fm.functions_pct ?? 0),
	};
}

function collectBuildMetrics(deps: Pick<CliDeps, "disk" | "paths">, reportsDir: string): HealthSnapshot["build"] {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Build Report.md"));
	if (!fm) return null;
	return {
		success: fm.success === true || fm.success === "true",
		durationMs: Number(fm.duration_ms ?? 0),
	};
}

function collectLintMetrics(deps: Pick<CliDeps, "disk" | "paths">, reportsDir: string): HealthSnapshot["lint"] {
	const fm = readReportFrontmatter(deps, deps.paths.join(reportsDir, "Project Summary.md"));
	if (!fm) return null;
	const hasLint = fm.eslint_errors !== undefined || fm.eslint_warnings !== undefined
		|| fm.lint_errors !== undefined || fm.lint_warnings !== undefined;
	if (!hasLint) return null;
	return {
		errors: Number(fm.eslint_errors ?? fm.lint_errors ?? 0),
		warnings: Number(fm.eslint_warnings ?? fm.lint_warnings ?? 0),
	};
}

function collectGitMetrics(deps: Pick<CliDeps, "shell">, projectPath: string): HealthSnapshot["git"] {
	const branch = deps.shell.runSilent(`git -C "${projectPath}" rev-parse --abbrev-ref HEAD`);
	if (!branch) return null;
	const dirty = deps.shell.runSilent(`git -C "${projectPath}" status --porcelain`);
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

function collectSecurityMetrics(deps: Pick<CliDeps, "disk" | "paths" | "shell">, projectPath: string): SecurityMetrics | null {
	const packageJson = deps.paths.join(projectPath, "package.json");
	if (!deps.disk.existsSync(packageJson)) return null;
	const { output } = deps.shell.runCaptureStatus("npm audit --json", { cwd: projectPath });
	if (!output) return null;
	return parseAuditJson(output);
}

function countComponents(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string): number {
	const dir = deps.paths.join(projectPath, "docs", "components");
	if (!deps.disk.existsSync(dir)) return 0;
	return deps.disk.readdirSync(dir).filter((f) => f.endsWith(".md")).length;
}

export function collectHealth(deps: Pick<CliDeps, "disk" | "paths" | "shell">, ctx: ProjectContext): HealthSnapshot {
	const reportsDir = deps.paths.join(ctx.path, ctx.config.reports?.dir ?? "reports");
	return {
		name: ctx.config.name,
		source: collectSourceMetrics(deps, ctx.path),
		tests: collectTestMetrics(deps, reportsDir),
		coverage: collectCoverageMetrics(deps, reportsDir),
		build: collectBuildMetrics(deps, reportsDir),
		lint: collectLintMetrics(deps, reportsDir),
		git: collectGitMetrics(deps, ctx.path),
		security: collectSecurityMetrics(deps, ctx.path),
		components: countComponents(deps, ctx.path),
	};
}
