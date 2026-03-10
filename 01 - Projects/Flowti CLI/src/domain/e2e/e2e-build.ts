/**
 * e2e-build.ts — Build, deploy, test stats, frontmatter reading,
 * console summary printers, and execution.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { TestStats, BuildStats, ReportSource } from "./e2e-types.js";

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

export function quickBuildAndDeploy(e2e: E2EPaths, log: (msg: string) => void = () => {}): number {
	log("Quick build (esbuild → deploy → reload)...");

	const buildExitCode = shell.run("node esbuild.config.mjs --production", { cwd: e2e.projectRoot });
	if (buildExitCode === 0) {
		log("  ✓ Build completed");
	} else {
		log("  ✗ Build failed");
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
			log(`  ○ Artifact not found: ${artifact}`);
		}
	}
	log(`  ✓ Deployed ${copied} artifacts to test vault`);

	const reloadResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} eval code="(async () => { await app.plugins.disablePlugin('${e2e.pluginId}'); await app.plugins.enablePlugin('${e2e.pluginId}'); return 'reloaded'; })()"`,
	);
	if (reloadResult !== null) {
		log("  ✓ Plugin reloaded in Obsidian");
	} else {
		log("  ○ Plugin reload skipped (Obsidian may not be running)");
	}

	return 0;
}

// ── Increment / Publish execution (pipeline-based) ──────────────────

import { runPipeline } from "../../infrastructure/pipeline/pipeline-runner.js";
import { buildIncrementPipeline } from "./pipelines/increment-pipeline.js";
import { buildPublishPipeline } from "./pipelines/publish-pipeline.js";

export async function runIncrementBuild(e2e: E2EPaths, log: (msg: string) => void = () => {}): Promise<number> {
	log("Preparing test vault for full journey...");
	const steps = buildIncrementPipeline(e2e);
	const result = await runPipeline(steps, e2e.projectRoot, { label: "Increment Build" });
	return result.failed > 0 ? 1 : 0;
}

export async function runPublish(e2e: E2EPaths): Promise<number> {
	const steps = buildPublishPipeline(e2e);
	const result = await runPipeline(steps, e2e.projectRoot, { label: "Publish" });
	return result.failed > 0 ? 1 : 0;
}
