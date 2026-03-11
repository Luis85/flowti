/**
 * generate-performance-report.ts — CLI project performance report generator.
 *
 * Reads persisted performance state (data.json perfAggregator key) and
 * generates a PerformanceReport vault note with queryable YAML frontmatter.
 */

import { disk } from "../../../infrastructure/filesystem.js";
import { paths } from "../../../infrastructure/paths.js";
import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "./report-service.js";
import { clock } from "../../../infrastructure/clock.js";
import { PLUGIN_ROOT } from "../../../infrastructure/config.js";
import { percentile, round, formatBytes } from "../generators/performance-report.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";
import type { PipelineContext } from "../../../infrastructure/pipeline/pipeline-types.js";

// ── Data loading ─────────────────────────────────────────────────────

function findDataJson(): string | null {
	const candidates: string[] = [
		paths.resolve(PLUGIN_ROOT, "..", "..", ".obsidian", "plugins", "flowti-ibde", "data.json"),
		paths.join(PLUGIN_ROOT, "data.json"),
	];
	for (const candidate of candidates) {
		if (disk.existsSync(candidate)) return candidate;
	}
	return null;
}

// ── Generator ────────────────────────────────────────────────────────

export function generatePerformanceReport(projectPath: string, ctx?: PipelineContext): GeneratorOutput {
	const log = (msg: string) => ctx?.log(msg);
	const svc = new ReportService(projectPath);

	const dataJsonPath = findDataJson();
	let data: Record<string, unknown> | null = null;

	if (dataJsonPath) {
		try {
			data = JSON.parse(disk.readFileSync(dataJsonPath, "utf-8")) as Record<string, unknown>;
			log(`[cli-report] Read data.json from: ${dataJsonPath}`);
		} catch {
			log("[cli-report] Failed to parse data.json.");
		}
	}

	// Extract perf state (may not exist yet)
	const perfState = (data as Record<string, unknown>)?.perfAggregator as Record<string, unknown> ?? {};
	const startupHistory: number[] = (perfState.startupHistory as number[]) ?? [];
	const sorted = [...startupHistory].sort((a, b) => a - b);

	const fm: Record<string, string | number> = {
		type: "PerformanceReport",
		project: "flowti-cli",
		date: clock.iso(),
		startup_total_ms: round(startupHistory[startupHistory.length - 1] ?? 0),
		startup_measurements: startupHistory.length,
		startup_p50: round(percentile(sorted, 0.5)),
		startup_p95: round(percentile(sorted, 0.95)),
		startup_max: round(sorted[sorted.length - 1] ?? 0),
		data_json_size_bytes: data ? JSON.stringify(data).length : 0,
	};

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

	const warnings: string[] = [];
	if (startupHistory.length === 0) warnings.push("No startup measurements found in data.json");
	if ((fm.startup_p95 as number) > 5000) warnings.push(`Startup p95 (${fm.startup_p95}ms) exceeds 5000ms threshold`);

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
