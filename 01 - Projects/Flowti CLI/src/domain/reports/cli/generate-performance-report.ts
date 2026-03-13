/**
 * generate-performance-report.ts — CLI project performance report generator.
 *
 * Reads persisted performance state (data.json perfAggregator key) and
 * generates a PerformanceReport vault note with queryable YAML frontmatter.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import { percentile, round, formatBytes } from "../generators/performance-report.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Data loading ─────────────────────────────────────────────────────

function findDataJson(pluginRoot: string, deps: ReportDeps): string | null {
	const candidates: string[] = [
		deps.paths.resolve(pluginRoot, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
		deps.paths.join(pluginRoot, "data.json"),
	];
	for (const candidate of candidates) {
		if (deps.disk.existsSync(candidate)) return candidate;
	}
	return null;
}

// ── Data extraction ───────────────────────────────────────────────────

function loadDataJson(pluginRoot: string, deps: ReportDeps, log: (msg: string) => void): Record<string, unknown> | null {
	const dataJsonPath = findDataJson(pluginRoot, deps);
	if (!dataJsonPath) return null;
	try {
		const data = JSON.parse(deps.disk.readFileSync(dataJsonPath, "utf-8")) as Record<string, unknown>;
		log(`[cli-report] Read data.json from: ${dataJsonPath}`);
		return data;
	} catch {
		log("[cli-report] Failed to parse data.json.");
		return null;
	}
}

function extractStartupHistory(data: Record<string, unknown> | null): number[] {
	const perfState = data?.perfAggregator as Record<string, unknown> ?? {};
	return (perfState.startupHistory as number[]) ?? [];
}

function buildPerfFrontmatter(startupHistory: number[], data: Record<string, unknown> | null, iso: string): Record<string, string | number> {
	const sorted = [...startupHistory].sort((a, b) => a - b);
	return {
		type: "PerformanceReport",
		project: "flowti-cli",
		date: iso,
		startup_total_ms: round(startupHistory[startupHistory.length - 1] ?? 0),
		startup_measurements: startupHistory.length,
		startup_p50: round(percentile(sorted, 0.5)),
		startup_p95: round(percentile(sorted, 0.95)),
		startup_max: round(sorted[sorted.length - 1] ?? 0),
		data_json_size_bytes: data ? JSON.stringify(data).length : 0,
	};
}

function collectPerfWarnings(fm: Record<string, string | number>, startupHistory: number[]): string[] {
	const warnings: string[] = [];
	if (startupHistory.length === 0) warnings.push("No startup measurements found in data.json");
	if ((fm.startup_p95 as number) > 5000) warnings.push(`Startup p95 (${fm.startup_p95}ms) exceeds 5000ms threshold`);
	return warnings;
}

// ── Generator ────────────────────────────────────────────────────────

export function generatePerformanceReport(projectPath: string, deps: ReportDeps, ctx?: PipelineContext, options?: { pluginRoot?: string }): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath, deps);
	const pluginRoot = options?.pluginRoot ?? projectPath;

	const data = loadDataJson(pluginRoot, deps, log);
	const startupHistory = extractStartupHistory(data);
	const fm = buildPerfFrontmatter(startupHistory, data, deps.clock.iso());

	const doc = Document.create("Performance Report")
		.mergeFrontmatter(fm)
		.addBlank()
		.heading(1, "Performance Report")
		.addBlank()
		.callout("info", "Summary", [
			`Last startup: ${fm.startup_total_ms}ms | p50: ${fm.startup_p50}ms | p95: ${fm.startup_p95}ms | Max: ${fm.startup_max}ms`,
			`Measurements: ${fm.startup_measurements} | data.json: ${formatBytes(fm.data_json_size_bytes as number)}`,
		])
		.addBlank()
		.heading(2, "Startup History")
		.addBlank()
		.table(
			["#", "Duration"],
			startupHistory.map((ms, i) => [String(i + 1), `${round(ms)}ms`]),
		)
		.addBlank();

	const outputPath = svc.save(doc, {
		subdir: "performance",
		slug: "performance-report",
		stableFilename: "Performance Report.md",
	});

	log(`[cli-report] Performance Report`);
	log(`  Startup: ${fm.startup_total_ms}ms | p50: ${fm.startup_p50}ms | p95: ${fm.startup_p95}ms`);
	log(`  Measurements: ${fm.startup_measurements} | data.json: ${formatBytes(fm.data_json_size_bytes as number)}`);
	log(`  Written: ${outputPath}`);

	const warnings = collectPerfWarnings(fm, startupHistory);

	return {
		success: true,
		outputPath,
		metrics: {
			startup_total_ms: fm.startup_total_ms,
			startup_p50: fm.startup_p50,
			startup_p95: fm.startup_p95,
			measurements: fm.startup_measurements,
		},
		warnings: warnings.length > 0 ? warnings : undefined,
	};
}
