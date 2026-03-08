/**
 * e2e-build.ts — Build, deploy, test stats, frontmatter reading,
 * console summary printers, and execution.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { TestStats, BuildStats, ReportSource } from "./e2e-types.js";
import { performTeardown } from "./e2e-teardown.js";
import { generateIncrementStateReport, generatePublishStateReport } from "./e2e-state-reports.js";

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
