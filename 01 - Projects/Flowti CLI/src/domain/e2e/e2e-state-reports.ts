/**
 * e2e-state-reports.ts — Markdown section builders, metrics extraction,
 * state report frontmatter, and generation for increment/publish builds.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import type { E2EPaths } from "./e2e-paths.js";
import type { TestStats, BuildStats, ExtractedMetrics } from "./e2e-types.js";

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

export function buildE2eFrontmatterLines(e: Record<string, unknown>): string[] {
	return [
		"# E2E",
		`e2e_total: ${e.total_tests ?? 0}`,
		`e2e_passed: ${e.passed ?? 0}`,
		`e2e_failed: ${e.failed ?? 0}`,
		`e2e_journeys: ${e.journeys ?? 0}`,
		`e2e_actions: ${e.total_actions ?? 0}`,
	];
}

export function buildPerfFrontmatterLines(p: Record<string, unknown>, t: Record<string, unknown>): string[] {
	return [
		"# Performance",
		`startup_p50_ms: ${p.startup_p50 ?? t.startup_p50 ?? 0}`,
		`startup_p95_ms: ${p.startup_p95 ?? t.startup_p95 ?? 0}`,
	];
}

export function buildTraceFrontmatterLines(tr: Record<string, unknown>): string[] {
	return [
		"# Traceability",
		`trace_total: ${tr.total_events ?? 0}`,
		`trace_linked: ${tr.linked ?? 0}`,
		`trace_unlinked: ${tr.unlinked ?? 0}`,
	];
}

// ── Increment state report ──────────────────────────────────────────

export function generateIncrementStateReport(exitCode: number, duration: string, stats: BuildStats, e2e: E2EPaths, log: (msg: string) => void = () => {}): { testPath: string; devPath: string } {
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
	log(`  ✓ Increment State Report: ${testPath}`);

	const devPath = paths.join(DEV_VAULT_ROOT, filename);
	disk.writeFileSync(devPath, content, "utf-8");
	log(`  ✓ Increment State Report: ${devPath}`);

	return { testPath, devPath };
}

// ── Publish state report ────────────────────────────────────────────

export function generatePublishStateReport(exitCode: number, duration: string, stats: BuildStats, e2e: E2EPaths, log: (msg: string) => void = () => {}): { devPath: string } {
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
	log(`  ✓ Publish State Report: ${devPath}`);

	return { devPath };
}
