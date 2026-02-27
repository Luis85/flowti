/**
 * performanceReportGenerator.ts
 *
 * Pure function that transforms performance metrics into a
 * vault note with queryable YAML frontmatter.
 *
 * @see TD-127 — Performance observability for growing state
 */

export interface PerformanceReportInput {
	date: string;
	startupTotalMs: number;
	startupServiceCount: number;
	startupP50: number;
	startupP95: number;
	startupMax: number;
	perService: Array<{ service: string; durationMs: number }>;
	storageKeys: Array<{
		key: string;
		loadCount: number;
		saveCount: number;
		avgLoadMs: number;
		avgSaveMs: number;
		lastSizeBytes: number;
	}>;
	queryExecutions: number;
	queryP50: number;
	queryP95: number;
	queryMax: number;
	queryAvgSourceRows: number;
	queryAvgResultRows: number;
	alertThresholdMs: number;
	alertTriggered: boolean;
	eventDispatches: number;
	eventDispatchP50: number;
	eventDispatchP95: number;
	eventDispatchMax: number;
	slowestEvents: Array<{ eventType: string; maxMs: number; count: number }>;
}

export interface PerformanceReportFrontmatter {
	type: "PerformanceReport";
	date: string;
	startup_total_ms: number;
	startup_service_count: number;
	startup_p50: number;
	startup_p95: number;
	startup_max: number;
	query_executions: number;
	query_p50: number;
	query_p95: number;
	query_max: number;
	alert_triggered: boolean;
	event_dispatches: number;
	event_dispatch_p95: number;
}

export function generatePerformanceReport(input: PerformanceReportInput): {
	frontmatter: PerformanceReportFrontmatter;
	markdown: string;
} {
	const fm: PerformanceReportFrontmatter = {
		type: "PerformanceReport",
		date: input.date,
		startup_total_ms: round(input.startupTotalMs),
		startup_service_count: input.startupServiceCount,
		startup_p50: round(input.startupP50),
		startup_p95: round(input.startupP95),
		startup_max: round(input.startupMax),
		query_executions: input.queryExecutions,
		query_p50: round(input.queryP50),
		query_p95: round(input.queryP95),
		query_max: round(input.queryMax),
		alert_triggered: input.alertTriggered,
		event_dispatches: input.eventDispatches,
		event_dispatch_p95: round(input.eventDispatchP95),
	};

	const yaml = [
		"---",
		...Object.entries(fm).map(([k, v]) => `${k}: ${yamlValue(v)}`),
		"---",
	].join("\n");

	const body = [
		"",
		"# Performance Report",
		"",
		"## Startup",
		"",
		`| Metric | Value |`,
		`| ------ | ----- |`,
		`| Total | ${round(input.startupTotalMs)}ms |`,
		`| Services | ${input.startupServiceCount} |`,
		`| p50 | ${round(input.startupP50)}ms |`,
		`| p95 | ${round(input.startupP95)}ms |`,
		`| Max | ${round(input.startupMax)}ms |`,
		`| Alert threshold | ${input.alertThresholdMs}ms |`,
		`| Alert triggered | ${input.alertTriggered ? "Yes" : "No"} |`,
		"",
		"### Per-Service Breakdown",
		"",
		`| Service | Duration |`,
		`| ------- | -------- |`,
		...input.perService.map((s) => `| ${s.service} | ${round(s.durationMs)}ms |`),
		"",
		"## Storage",
		"",
		`| Key | Loads | Saves | Avg Load | Avg Save | Size |`,
		`| --- | ----- | ----- | -------- | -------- | ---- |`,
		...input.storageKeys.map((k) =>
			`| ${k.key} | ${k.loadCount} | ${k.saveCount} | ${round(k.avgLoadMs)}ms | ${round(k.avgSaveMs)}ms | ${formatBytes(k.lastSizeBytes)} |`,
		),
		"",
		"## Query Execution",
		"",
		`| Metric | Value |`,
		`| ------ | ----- |`,
		`| Executions | ${input.queryExecutions} |`,
		`| p50 | ${round(input.queryP50)}ms |`,
		`| p95 | ${round(input.queryP95)}ms |`,
		`| Max | ${round(input.queryMax)}ms |`,
		`| Avg source rows | ${Math.round(input.queryAvgSourceRows)} |`,
		`| Avg result rows | ${Math.round(input.queryAvgResultRows)} |`,
		"",
		"## Event Dispatch",
		"",
		`| Metric | Value |`,
		`| ------ | ----- |`,
		`| Total dispatches | ${input.eventDispatches} |`,
		`| p50 | ${round(input.eventDispatchP50)}ms |`,
		`| p95 | ${round(input.eventDispatchP95)}ms |`,
		`| Max | ${round(input.eventDispatchMax)}ms |`,
		"",
		...(input.slowestEvents.length > 0 ? [
			"### Slowest Event Types",
			"",
			`| Event | Max | Count |`,
			`| ----- | --- | ----- |`,
			...input.slowestEvents.map((e) => `| ${e.eventType} | ${round(e.maxMs)}ms | ${e.count} |`),
			"",
		] : []),
	].join("\n");

	return { frontmatter: fm, markdown: yaml + body };
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}

function yamlValue(v: unknown): string {
	if (typeof v === "boolean" || typeof v === "number") return String(v);
	return JSON.stringify(String(v));
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
