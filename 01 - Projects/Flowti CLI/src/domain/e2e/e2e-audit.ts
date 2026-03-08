/**
 * e2e-audit.ts — Audit generation and consolidated metrics reporting.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { shell } from "../../infrastructure/shell.js";
import { log } from "../../infrastructure/logger.js";
import { input } from "../../infrastructure/input.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { ReportSource, AuditFrontmatters } from "./e2e-types.js";
import { yamlStr } from "./e2e-helpers.js";
import { collectReportSources } from "./e2e-build.js";

// ── Audit frontmatter builders ──────────────────────────────────────

function buildAuditBuildFrontmatter(buildFm: Record<string, unknown>): string[] {
	return [
		"# Build",
		`build_size_kb: ${buildFm.total_bytes ? Math.round(buildFm.total_bytes as number / 1024) : 0}`,
		`build_duration_ms: ${buildFm.duration_ms ?? 0}`,
		`build_warnings: ${buildFm.warnings_count ?? 0}`,
		`build_errors: ${buildFm.errors_count ?? 0}`,
	];
}

function buildAuditUnitFrontmatter(testFm: Record<string, unknown>): string[] {
	return [
		"# Unit Tests",
		`unit_tests_total: ${testFm.total ?? 0}`,
		`unit_tests_passed: ${testFm.passed ?? 0}`,
		`unit_tests_failed: ${testFm.failed ?? 0}`,
		`unit_tests_skipped: ${testFm.skipped ?? 0}`,
		`unit_tests_suites: ${testFm.suites ?? 0}`,
	];
}

function buildAuditE2eFrontmatter(e2eFm: Record<string, unknown>): string[] {
	return [
		"# E2E",
		`e2e_tests_total: ${e2eFm.total_tests ?? 0}`,
		`e2e_passed: ${e2eFm.passed ?? 0}`,
		`e2e_failed: ${e2eFm.failed ?? 0}`,
		`e2e_journeys: ${e2eFm.journeys ?? 0}`,
		`e2e_actions: ${e2eFm.total_actions ?? 0}`,
	];
}

function buildAuditFrontmatter(auditName: string, overallStatus: string, currentCycle: string | number, now: Date, buildFm: Record<string, unknown>, testFm: Record<string, unknown>, e2eFm: Record<string, unknown>, perfFm: Record<string, unknown>): string[] {
	return [
		"---",
		"type: E2EAudit",
		`name: ${yamlStr(auditName)}`,
		`date: "${now.toISOString()}"`,
		`overall_status: ${overallStatus}`,
		...(currentCycle ? [`cycle: ${currentCycle}`] : []),
		...buildAuditBuildFrontmatter(buildFm),
		...buildAuditUnitFrontmatter(testFm),
		...buildAuditE2eFrontmatter(e2eFm),
		"# Performance",
		`startup_p50_ms: ${perfFm.startup_p50 ?? testFm.startup_p50 ?? 0}`,
		"tags:",
		"  - audit",
		"  - review",
		"---",
	];
}

// ── Audit section builders ──────────────────────────────────────────

function buildAuditBuildSection(buildFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["## Build", ""];
	if (hasSource) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Bundle Size | ${buildFm.total_bytes ? Math.round(buildFm.total_bytes as number / 1024) + " KB" : "N/A"} |`);
		lines.push(`| Build Duration | ${buildFm.duration_ms ?? "N/A"} ms |`);
		lines.push(`| Warnings | ${buildFm.warnings_count ?? 0} |`, `| Errors | ${buildFm.errors_count ?? 0} |`, `| Plugin Version | ${buildFm.plugin_version ?? "N/A"} |`);
	} else {
		lines.push("> No build report available.");
	}
	lines.push("");
	return lines;
}

function buildAuditTestSection(testFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## Unit Tests", ""];
	if (hasSource) {
		const icon = ((testFm.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${testFm.passed}/${testFm.total} passed | ${testFm.suites ?? "?"} suites`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total | ${testFm.total} |`, `| Passed | ${testFm.passed} |`, `| Failed | ${testFm.failed} |`, `| Skipped | ${testFm.skipped} |`, `| Suites | ${testFm.suites} |`);
		lines.push(`| Duration | ${testFm.duration_ms ? Math.round(testFm.duration_ms as number / 1000) + "s" : "N/A"} |`);
	} else {
		lines.push("> No test report available.");
	}
	lines.push("");
	return lines;
}

function buildAuditE2eSection(e2eFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## E2E Tests", ""];
	if (hasSource) {
		const icon = ((e2eFm.failed as number) ?? 0) === 0 ? "success" : "danger";
		lines.push(`> [!${icon}] ${e2eFm.passed}/${e2eFm.total_tests} passed | ${e2eFm.journeys ?? "?"} journeys`);
		lines.push("", "| Metric | Value |", "|---|---|");
		lines.push(`| Total Tests | ${e2eFm.total_tests} |`, `| Passed | ${e2eFm.passed} |`, `| Failed | ${e2eFm.failed} |`);
		lines.push(`| Journeys | ${e2eFm.journeys} |`, `| Actions | ${e2eFm.total_actions} |`, `| Screenshots | ${e2eFm.total_screenshots} |`);
		lines.push(`| Duration | ${e2eFm.duration ?? "N/A"} |`);
	} else {
		lines.push("> No E2E report available.");
	}
	lines.push("");
	return lines;
}

function buildAuditPerfSection(perfFm: Record<string, unknown>, testFm: Record<string, unknown>, hasSource: boolean): string[] {
	const lines = ["---", "", "## Performance", ""];
	if (hasSource || testFm.startup_p50) {
		lines.push("| Metric | Value |", "|---|---|");
		lines.push(`| Startup p50 | ${perfFm.startup_p50 ?? testFm.startup_p50 ?? "N/A"} ms |`);
		lines.push(`| Startup p95 | ${perfFm.startup_p95 ?? testFm.startup_p95 ?? "N/A"} ms |`);
		lines.push(`| Startup Max | ${perfFm.startup_max ?? testFm.startup_max ?? "N/A"} ms |`);
	} else {
		lines.push("> No performance data available.");
	}
	lines.push("");
	return lines;
}

function buildAuditSourcesSection(sources: Record<string, ReportSource>): string[] {
	const lines = ["---", "", "## Report Sources", ""];
	const sourceMap: Array<[string, string]> = [
		["build", "Build"], ["test", "Tests"], ["coverage", "Coverage"],
		["performance", "Performance"], ["cycle", "Cycle"],
	];
	const reportLinks: string[] = [];
	for (const [key, label] of sourceMap) {
		if (sources[key]) reportLinks.push(`- ${label}: \`${paths.basename(sources[key].file)}\``);
	}
	if (sources.e2e) reportLinks.push("- E2E: [[E2E Report]]");
	if (sources.traceability) reportLinks.push("- Traceability: [[Trace Conformance Report]]");
	lines.push(...(reportLinks.length > 0 ? reportLinks : ["> No reports found."]));
	lines.push("");
	return lines;
}

// ── Write & open ────────────────────────────────────────────────────

function writeAndOpenAudit(auditName: string, content: string, e2e: E2EPaths): void {
	const testAuditDir = paths.join(e2e.testVault, "03 - Resources", "Reviews", "Audits", auditName);
	const testAuditPath = paths.join(testAuditDir, `${auditName}.md`);
	disk.mkdirSync(testAuditDir, { recursive: true });
	disk.writeFileSync(testAuditPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Audit written: ${testAuditPath}`);

	const devAuditDir = paths.join(e2e.projectRoot, "docs", "reports", "e2e", "audits", auditName);
	const devAuditPath = paths.join(devAuditDir, `${auditName}.md`);
	disk.mkdirSync(devAuditDir, { recursive: true });
	disk.writeFileSync(devAuditPath, content, "utf-8");
	log(`  \x1b[32m✓\x1b[0m Audit mirrored: ${devAuditPath}`);

	const openResult = shell.runSilent(
		`obsidian vault=${e2e.vaultName} open "03 - Resources/Reviews/Audits/${auditName}/${auditName}.md"`,
	);
	if (openResult !== null) {
		log("  \x1b[32m✓\x1b[0m Audit opened in Obsidian\n");
	} else {
		log("  \x1b[33m○\x1b[0m Could not open audit in Obsidian\n");
	}
}

// ── Extract & determine ─────────────────────────────────────────────

function extractSourceFm(sources: Record<string, ReportSource>, key: string): Record<string, unknown> {
	return sources[key]?.fm ?? {};
}

function extractAuditFrontmatters(sources: Record<string, ReportSource>): AuditFrontmatters {
	return {
		buildFm: extractSourceFm(sources, "build"),
		testFm: extractSourceFm(sources, "test"),
		e2eFm: extractSourceFm(sources, "e2e"),
		perfFm: extractSourceFm(sources, "performance"),
		cycleFm: extractSourceFm(sources, "cycle"),
	};
}

function determineAuditStatus(fm: AuditFrontmatters): { overallStatus: string; currentCycle: string | number } {
	const hasFailures = ((fm.testFm.failed as number) ?? 0) > 0 || ((fm.e2eFm.failed as number) ?? 0) > 0 || ((fm.buildFm.errors_count as number) ?? 0) > 0;
	return {
		overallStatus: hasFailures ? "fail" : "pass",
		currentCycle: (fm.cycleFm.cycle ?? fm.cycleFm.number ?? "") as string | number,
	};
}

// ── Public: generate audit ──────────────────────────────────────────

export async function generateAudit(e2e: E2EPaths): Promise<void> {
	const defaultName = new Date().toISOString().slice(0, 10) + "-audit";
	const auditName = await input.ask("Audit name", defaultName);

	log(`\n  Generating audit: ${auditName}...\n`);

	const sources = collectReportSources(e2e);
	const fm = extractAuditFrontmatters(sources);
	const { overallStatus, currentCycle } = determineAuditStatus(fm);
	const now = new Date();

	const lines: string[] = [
		...buildAuditFrontmatter(auditName, overallStatus, currentCycle, now, fm.buildFm, fm.testFm, fm.e2eFm, fm.perfFm),
		"",
		`# Audit: ${auditName}`,
		"",
		`> [!${overallStatus === "pass" ? "success" : "danger"}] Overall: **${overallStatus.toUpperCase()}**`,
		`> Date: ${now.toISOString().slice(0, 16).replace("T", " ")}`,
		"",
		...buildAuditBuildSection(fm.buildFm, !!sources.build),
		...buildAuditTestSection(fm.testFm, !!sources.test),
		...buildAuditE2eSection(fm.e2eFm, !!sources.e2e),
		...buildAuditPerfSection(fm.perfFm, fm.testFm, !!sources.performance),
		...buildAuditSourcesSection(sources),
	];

	writeAndOpenAudit(auditName, lines.join("\n"), e2e);
}
