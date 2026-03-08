/**
 * e2e-build.ts — Build, deploy, increment, publish, and state report generation.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { TestStats, BuildStats, ExtractedMetrics, ReportSource } from "./e2e-types.js";
import { performTeardown } from "./e2e-teardown.js";

// ── Test stats ──────────────────────────────────────────────────────

function extractStatsFromTestResults(testResults: Array<Record<string, unknown>>): TestStats {
	let totalTests = 0, passed = 0, failed = 0, skipped = 0;
	const statusCounters: Record<string, () => void> = {
		passed: () => passed++,
		failed: () => failed++,
	};
	for (const suite of testResults) {
		if (!Array.isArray(suite.assertionResults)) continue;
		for (const test of suite.assertionResults as Array<Record<string, unknown>>) {
			totalTests++;
			const counter = statusCounters[test.status as string];
			if (counter) counter(); else skipped++;
		}
	}
	return { totalTests, passed, failed, skipped };
}

export function readTestStats(e2e: E2EPaths): TestStats {
	const reportPath = paths.join(e2e.projectRoot, "docs", "reports", "tests", "testreport.json");
	if (!disk.existsSync(reportPath)) return { totalTests: 0, passed: 0, failed: 0, skipped: 0 };

	try {
		const report = JSON.parse(disk.readFileSync(reportPath, "utf-8")) as Record<string, unknown>;
		if (report.numTotalTests != null) {
			return {
				totalTests: report.numTotalTests as number,
				passed: (report.numPassedTests as number) ?? 0,
				failed: (report.numFailedTests as number) ?? 0,
				skipped: (report.numPendingTests as number) ?? 0,
			};
		}
		if (Array.isArray(report.testResults)) {
			return extractStatsFromTestResults(report.testResults as Array<Record<string, unknown>>);
		}
	} catch {
		// Report parsing failed
	}
	return { totalTests: 0, passed: 0, failed: 0, skipped: 0 };
}

// ── Frontmatter / report reading ────────────────────────────────────

function parseFrontmatter(filePath: string): Record<string, unknown> | null {
	try {
		return parseFrontmatterContent(disk.readFileSync(filePath, "utf-8"));
	} catch {
		return null;
	}
}

function findLatestReport(dir: string): string | null {
	try {
		const files = disk.readdirSync(dir)
			.filter((f) => f.endsWith(".md"))
			.sort()
			.reverse();
		return files.length > 0 ? paths.join(dir, files[0]) : null;
	} catch {
		return null;
	}
}

export function readBuildStats(e2e: E2EPaths): BuildStats {
	const reportsDir = e2e.reportsDir;
	const buildFile = findLatestReport(paths.join(reportsDir, "builds"));
	const testFile = findLatestReport(paths.join(reportsDir, "tests"));
	const coverageDir = paths.join(reportsDir, "coverage");
	const coverageFile = findLatestReport(coverageDir);
	const perfFile = findLatestReport(paths.join(reportsDir, "performance"));
	const cycleFile = findLatestReport(paths.join(reportsDir, "cycles"));
	const e2eFile = paths.join(reportsDir, "e2e", "E2E Report.md");
	const traceFile = paths.join(reportsDir, "traceability", "Trace Conformance Report.md");

	return {
		build: buildFile ? parseFrontmatter(buildFile) : null,
		test: testFile ? parseFrontmatter(testFile) : null,
		coverage: coverageFile ? parseFrontmatter(coverageFile) : null,
		performance: perfFile ? parseFrontmatter(perfFile) : null,
		cycle: cycleFile ? parseFrontmatter(cycleFile) : null,
		e2e: disk.existsSync(e2eFile) ? parseFrontmatter(e2eFile) : null,
		traceability: disk.existsSync(traceFile) ? parseFrontmatter(traceFile) : null,
		unitTests: readTestStats(e2e),
	};
}

export function collectReportSources(e2e: E2EPaths): Record<string, ReportSource> {
	const sources: Record<string, ReportSource> = {};
	const reportsDir = e2e.reportsDir;

	const timestampedDirs: Array<[string, string]> = [
		["build", "builds"], ["test", "tests"], ["coverage", "coverage"],
		["performance", "performance"], ["cycle", "cycles"],
	];
	for (const [key, dir] of timestampedDirs) {
		const file = findLatestReport(paths.join(reportsDir, dir));
		if (file) sources[key] = { file, fm: parseFrontmatter(file) };
	}

	const stableFiles: Array<[string, string]> = [
		["e2e", paths.join(reportsDir, "e2e", "E2E Report.md")],
		["traceability", paths.join(reportsDir, "traceability", "Trace Conformance Report.md")],
	];
	for (const [key, filePath] of stableFiles) {
		if (disk.existsSync(filePath)) sources[key] = { file: filePath, fm: parseFrontmatter(filePath) };
	}

	return sources;
}

// ── Metrics extraction ──────────────────────────────────────────────

function extractReportMaps(stats: BuildStats): { b: Record<string, unknown>; t: Record<string, unknown>; c: Record<string, unknown>; e: Record<string, unknown>; p: Record<string, unknown>; cy: Record<string, unknown> } {
	return {
		b: stats.build ?? {},
		t: stats.test ?? {},
		c: stats.coverage ?? {},
		e: stats.e2e ?? {},
		p: stats.performance ?? {},
		cy: stats.cycle ?? {},
	};
}

function extractCoverageMetrics(c: Record<string, unknown>): { linesPct: number; branchesPct: number; functionsPct: number } {
	return {
		linesPct: (c.lines_pct ?? c.line_pct ?? c.line_percent ?? 0) as number,
		branchesPct: (c.branches_pct ?? 0) as number,
		functionsPct: (c.functions_pct ?? 0) as number,
	};
}

export function extractMetrics(stats: BuildStats): ExtractedMetrics {
	const maps = extractReportMaps(stats);
	const cov = extractCoverageMetrics(maps.c);
	return {
		...maps,
		sizeKb: maps.b.total_bytes ? Math.round(maps.b.total_bytes as number / 1024) : 0,
		...cov,
		cycle: (maps.cy.cycle ?? maps.cy.number ?? "") as string | number,
	};
}

// ── Markdown section builders ───────────────────────────────────────

export function buildUnitTestsSection(ut: TestStats, t: Record<string, unknown>): string[] {
	const lines = ["## Unit Tests", ""];
	if (ut.totalTests > 0) {
		const icon = ut.failed === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${ut.passed}/${ut.totalTests} passed | ${t.suites ?? "?"} suites`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${ut.totalTests} |`, `| Passed | ${ut.passed} |`, `| Failed | ${ut.failed} |`, `| Skipped | ${ut.skipped} |`, `| Suites | ${t.suites ?? "?"} |`);
		if (t.duration_ms) lines.push(`| Duration | ${Math.round(t.duration_ms as number / 1000)}s |`);
	} else {
		lines.push("> No unit test data available.");
	}
	lines.push("");
	return lines;
}

export function buildCoverageSection(linesPct: number, branchesPct: number, functionsPct: number, c: Record<string, unknown>): string[] {
	const lines = ["## Coverage", ""];
	if (linesPct > 0) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Lines | ${linesPct}% |`, `| Branches | ${branchesPct}% |`, `| Functions | ${functionsPct}% |`);
		if (c.files_covered) lines.push(`| Files | ${c.files_covered} |`);
	} else {
		lines.push("> No coverage data available.");
	}
	lines.push("");
	return lines;
}

export function buildE2eSection(e: Record<string, unknown>): string[] {
	const lines = ["## E2E Tests", ""];
	if (((e.total_tests as number) ?? 0) > 0) {
		const icon = ((e.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e.passed}/${e.total_tests} passed | ${e.journeys ?? "?"} journeys`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${e.total_tests} |`, `| Passed | ${e.passed} |`, `| Failed | ${e.failed} |`, `| Journeys | ${e.journeys} |`, `| Actions | ${e.total_actions} |`, `| Screenshots | ${e.total_screenshots ?? "?"} |`);
		if (e.duration) lines.push(`| Duration | ${e.duration} |`);
	} else {
		lines.push("> No E2E data available.");
	}
	lines.push("");
	return lines;
}

export function buildPerformanceSection(p: Record<string, unknown>, t: Record<string, unknown>): string[] {
	const lines = ["## Performance", ""];
	const p50 = p.startup_p50 ?? t.startup_p50;
	if (p50) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Startup p50 | ${p50} ms |`, `| Startup p95 | ${p.startup_p95 ?? t.startup_p95 ?? "?"} ms |`, `| Startup Max | ${p.startup_max ?? t.startup_max ?? "?"} ms |`);
		if (p.data_json_size_bytes || t.data_json_size_bytes) {
			const djSize = (p.data_json_size_bytes ?? t.data_json_size_bytes) as number;
			lines.push(`| data.json | ${(djSize / (1024 * 1024)).toFixed(1)} MB |`);
		}
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");
	return lines;
}

export function buildBuildTable(sizeKb: number, b: Record<string, unknown>): string[] {
	return [
		"## Build", "",
		"| Metric | Value |", "|---|---|",
		`| Bundle Size | ${sizeKb} KB |`,
		`| Build Duration | ${b.duration_ms ?? "?"} ms |`,
		`| Plugin Version | ${b.plugin_version ?? "?"} |`,
		`| Warnings | ${b.warnings_count ?? 0} |`,
		`| Errors | ${b.errors_count ?? 0} |`,
		"",
	];
}

export function buildTraceabilitySection(tr: Record<string, unknown>): string[] {
	const lines = ["## Traceability", ""];
	if (((tr.total_events as number) ?? 0) > 0) {
		const pct = tr.linked && tr.total_events ? Math.round((tr.linked as number / (tr.total_events as number)) * 100) : 0;
		const icon = ((tr.unlinked as number) ?? 0) === 0 ? "success" : "warning";
		lines.push(`> [!${icon}] ${tr.linked}/${tr.total_events} linked (${pct}%)`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total Events | ${tr.total_events} |`, `| Linked | ${tr.linked} |`, `| Unlinked | ${tr.unlinked} |`);
	} else {
		lines.push("> No traceability data available.");
	}
	lines.push("");
	return lines;
}

// ── State report frontmatter builders ───────────────────────────────

export function buildStateReportFrontmatter(type: string, status: string, duration: string, now: Date, m: ExtractedMetrics, ut: TestStats): string[] {
	return [
		"---",
		`type: ${type}`,
		`date: "${now.toISOString()}"`,
		`status: ${status}`,
		`duration_s: ${duration}`,
		...(m.cycle ? [`cycle: ${m.cycle}`] : []),
		`plugin_version: ${m.b.plugin_version ?? "?"}`,
		"# Build",
		`bundle_size_kb: ${m.sizeKb}`,
		`build_duration_ms: ${m.b.duration_ms ?? 0}`,
		`build_warnings: ${m.b.warnings_count ?? 0}`,
		`build_errors: ${m.b.errors_count ?? 0}`,
		"# Unit Tests",
		`unit_total: ${ut.totalTests}`,
		`unit_passed: ${ut.passed}`,
		`unit_failed: ${ut.failed}`,
		`unit_skipped: ${ut.skipped}`,
		`unit_suites: ${m.t.suites ?? 0}`,
		"# Coverage",
		`lines_pct: ${m.linesPct}`,
		`branches_pct: ${m.branchesPct}`,
		`functions_pct: ${m.functionsPct}`,
	];
}

export function buildStateReportHeader(title: string, status: string, duration: string, now: Date, m: ExtractedMetrics): string[] {
	return [
		"",
		`# ${title}`,
		"",
		`> [!${status === "pass" ? "success" : "danger"}] **${status.toUpperCase()}** — ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		...(m.cycle ? [`> Cycle ${m.cycle} | v${m.b.plugin_version ?? "?"} | ${duration}s`] : [`> v${m.b.plugin_version ?? "?"} | ${duration}s`]),
		"",
	];
}

function buildE2eFrontmatterLines(e: Record<string, unknown>): string[] {
	return [
		"# E2E",
		`e2e_total: ${e.total_tests ?? 0}`,
		`e2e_passed: ${e.passed ?? 0}`,
		`e2e_failed: ${e.failed ?? 0}`,
		`e2e_journeys: ${e.journeys ?? 0}`,
		`e2e_actions: ${e.total_actions ?? 0}`,
	];
}

function buildPerfFrontmatterLines(p: Record<string, unknown>, t: Record<string, unknown>): string[] {
	return [
		"# Performance",
		`startup_p50_ms: ${p.startup_p50 ?? t.startup_p50 ?? 0}`,
		`startup_p95_ms: ${p.startup_p95 ?? t.startup_p95 ?? 0}`,
	];
}

function buildTraceFrontmatterLines(tr: Record<string, unknown>): string[] {
	return [
		"# Traceability",
		`trace_total: ${tr.total_events ?? 0}`,
		`trace_linked: ${tr.linked ?? 0}`,
		`trace_unlinked: ${tr.unlinked ?? 0}`,
	];
}

// ── Quick build + deploy ────────────────────────────────────────────

export function quickBuildAndDeploy(e2e: E2EPaths): number {
	log("\n  Quick build (esbuild → deploy → reload)...\n");

	const buildExitCode = shell.run("node esbuild.config.mjs --production", { cwd: e2e.projectRoot });
	if (buildExitCode === 0) {
		log("\n  \x1b[32m✓\x1b[0m Build completed");
	} else {
		log("\n  \x1b[31m✗\x1b[0m Build failed");
		return buildExitCode;
	}

	const mainPluginDir = paths.resolve(e2e.projectRoot, "..", "..", ".obsidian", "plugins", e2e.pluginId);
	let copied = 0;
	for (const artifact of e2e.pluginArtifacts) {
		const src = paths.join(mainPluginDir, artifact);
		const dest = paths.join(e2e.pluginDir, artifact);
		if (disk.existsSync(src)) {
			disk.mkdirSync(paths.dirname(dest), { recursive: true });
			disk.copyFileSync(src, dest);
			copied++;
		} else {
			log(`  \x1b[33m○\x1b[0m Artifact not found: ${artifact}`);
		}
	}
	log(`  \x1b[32m✓\x1b[0m Deployed ${copied} artifacts to test vault`);

	const reloadResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(async () => { await app.plugins.disablePlugin('${e2e.pluginId}'); await app.plugins.enablePlugin('${e2e.pluginId}'); return 'reloaded'; })()"`,
	);
	if (reloadResult !== null) {
		log("  \x1b[32m✓\x1b[0m Plugin reloaded in Obsidian\n");
	} else {
		log("  \x1b[33m○\x1b[0m Plugin reload skipped (Obsidian may not be running)\n");
	}

	return 0;
}

// ── Console summary printers ────────────────────────────────────────

function printBuildInfo(build: Record<string, unknown>): void {
	const red = "\x1b[31m";
	const reset = "\x1b[0m";
	const sizeKb = build.total_bytes ? Math.round(build.total_bytes as number / 1024) : "?";
	log(`  Bundle:       ${sizeKb} KB`);
	log(`  Version:      ${build.plugin_version ?? "?"}`);
	if ((build.warnings_count as number) > 0) {
		log(`  Warnings:     ${red}${build.warnings_count}${reset}`);
	}
}

function printTestStatsLine(ut: TestStats): void {
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const dim = "\x1b[2m";
	const reset = "\x1b[0m";
	const failColor = ut.failed > 0 ? red : green;
	log(`  Tests:        ${green}${ut.passed}${reset} passed, ${failColor}${ut.failed}${reset} failed, ${dim}${ut.skipped} skipped${reset} ${dim}(${ut.totalTests} total)${reset}`);
}

function printCoverageLine(coverage: Record<string, unknown>): void {
	const pct = coverage.line_pct ?? coverage.lines_pct ?? coverage.line_percent;
	if (pct != null) {
		log(`  Coverage:     ${pct}%`);
	}
}

export function printIncrementSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	log(`\n  ${"═".repeat(50)}`);
	log(`  Increment Build Results`);
	log(`  ${"═".repeat(50)}\n`);
	log(`  Status:       ${statusIcon}`);
	log(`  Duration:     ${duration}s`);

	if (stats.build) printBuildInfo(stats.build);
	if (stats.unitTests.totalTests > 0) printTestStatsLine(stats.unitTests);
	if (stats.coverage) printCoverageLine(stats.coverage);

	log();
}

export function printPublishSummary(exitCode: number, duration: string, stats: BuildStats): void {
	const reset = "\x1b[0m";
	const green = "\x1b[32m";
	const red = "\x1b[31m";
	const statusIcon = exitCode === 0 ? `${green}✓ PASS${reset}` : `${red}✗ FAIL${reset}`;

	log(`\n  ${"═".repeat(50)}`);
	log(`  Publish Results`);
	log(`  ${"═".repeat(50)}\n`);
	log(`  Status:       ${statusIcon}`);
	log(`  Duration:     ${duration}s`);

	if (stats.build) printBuildInfo(stats.build);
	if (stats.unitTests.totalTests > 0) printTestStatsLine(stats.unitTests);
	if (stats.coverage) printCoverageLine(stats.coverage);

	log();
}

// ── Increment state report ──────────────────────────────────────────

export function generateIncrementStateReport(exitCode: number, duration: string, stats: BuildStats, e2e: E2EPaths): { testPath: string; devPath: string } {
	const DEV_VAULT_ROOT = paths.resolve(e2e.projectRoot, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";
	const m = extractMetrics(stats);
	const ut = stats.unitTests;

	const lines: string[] = [
		...buildStateReportFrontmatter("IncrementStateReport", status, duration, now, m, ut),
		...buildE2eFrontmatterLines(m.e),
		...buildPerfFrontmatterLines(m.p, m.t),
		"tags:",
		"  - increment",
		"  - state-report",
		"---",
		...buildStateReportHeader("Increment State Report", status, duration, now, m),
		...buildBuildTable(m.sizeKb, m.b),
		...buildUnitTestsSection(ut, m.t),
		...buildCoverageSection(m.linesPct, m.branchesPct, m.functionsPct, m.c),
		...buildE2eSection(m.e),
		...buildPerformanceSection(m.p, m.t),
	];

	const content = lines.join("\n");
	const filename = "Increment State Report.md";

	const testPath = paths.join(e2e.testVault, filename);
	disk.writeFileSync(testPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Increment State Report: ${testPath}`);

	const devPath = paths.join(DEV_VAULT_ROOT, filename);
	disk.writeFileSync(devPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Increment State Report: ${devPath}`);

	return { testPath, devPath };
}

// ── Publish state report ────────────────────────────────────────────

export function generatePublishStateReport(exitCode: number, duration: string, stats: BuildStats, e2e: E2EPaths): { devPath: string } {
	const DEV_VAULT_ROOT = paths.resolve(e2e.projectRoot, "..", "..");
	const now = new Date();
	const status = exitCode === 0 ? "pass" : "fail";
	const m = extractMetrics(stats);
	const ut = stats.unitTests;
	const tr: Record<string, unknown> = stats.traceability ?? {};

	const lines: string[] = [
		...buildStateReportFrontmatter("PublishStateReport", status, duration, now, m, ut),
		...buildTraceFrontmatterLines(tr),
		...buildPerfFrontmatterLines(m.p, m.t),
		"tags:",
		"  - publish",
		"  - state-report",
		"---",
		...buildStateReportHeader("Publish State Report", status, duration, now, m),
		...buildBuildTable(m.sizeKb, m.b),
		...buildUnitTestsSection(ut, m.t),
		...buildCoverageSection(m.linesPct, m.branchesPct, m.functionsPct, m.c),
		...buildTraceabilitySection(tr),
		...buildPerformanceSection(m.p, m.t),
	];

	const content = lines.join("\n");
	const filename = "Publish State Report.md";

	const devPath = paths.join(DEV_VAULT_ROOT, filename);
	disk.writeFileSync(devPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Publish State Report: ${devPath}`);

	return { devPath };
}

// ── Increment / Publish execution ───────────────────────────────────

export async function runIncrementBuild(e2e: E2EPaths): Promise<number> {
	log("\n  Preparing test vault for full journey...\n");
	await performTeardown(e2e);

	log("  Starting increment build (check → build → test → e2e → docs → distribute)...\n");
	const startTime = Date.now();
	const exitCode = shell.run("npm run build:increment", { cwd: e2e.projectRoot });
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats(e2e);
	printIncrementSummary(exitCode, duration, stats);
	generateIncrementStateReport(exitCode, duration, stats, e2e);
	return exitCode;
}

export function runPublish(e2e: E2EPaths): number {
	log("\n  Starting publish (check → build → test → docs → publish)...\n");
	const startTime = Date.now();
	const exitCode = shell.run("npm run build:release", { cwd: e2e.projectRoot });
	const duration = ((Date.now() - startTime) / 1000).toFixed(1);
	const stats = readBuildStats(e2e);
	printPublishSummary(exitCode, duration, stats);
	generatePublishStateReport(exitCode, duration, stats, e2e);
	return exitCode;
}
