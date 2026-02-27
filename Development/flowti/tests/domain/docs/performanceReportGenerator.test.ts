import { describe, it, expect } from "vitest";
import {
	generatePerformanceReport,
	type PerformanceReportInput,
} from "../../../src/domain/docs/performanceReportGenerator";

function createInput(overrides?: Partial<PerformanceReportInput>): PerformanceReportInput {
	return {
		date: "2026-02-27T12:00:00.000Z",
		startupTotalMs: 1200,
		startupServiceCount: 15,
		startupP50: 900,
		startupP95: 1500,
		startupMax: 2000,
		perService: [
			{ service: "settingsService", durationMs: 50 },
			{ service: "analyticsService", durationMs: 200 },
		],
		storageKeys: [
			{ key: "settings", loadCount: 3, saveCount: 1, avgLoadMs: 2, avgSaveMs: 5, lastSizeBytes: 4096 },
		],
		queryExecutions: 10,
		queryP50: 15,
		queryP95: 45,
		queryMax: 80,
		queryAvgSourceRows: 500,
		queryAvgResultRows: 25,
		alertThresholdMs: 5000,
		alertTriggered: false,
		eventDispatches: 250,
		eventDispatchP50: 0.5,
		eventDispatchP95: 3.2,
		eventDispatchMax: 15,
		slowestEvents: [
			{ eventType: "analytics.query.completed", maxMs: 15, count: 10 },
			{ eventType: "session.completed", maxMs: 8, count: 3 },
		],
		...overrides,
	};
}

describe("performanceReportGenerator", () => {
	it("should produce valid YAML frontmatter", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toMatch(/^---\n/);
		expect(markdown).toContain("type: \"PerformanceReport\"");
		expect(markdown).toContain("startup_total_ms: 1200");
		expect(markdown).toContain("startup_service_count: 15");
		expect(markdown).toContain("query_executions: 10");
		expect(markdown).toContain("alert_triggered: false");
	});

	it("should include startup section with metrics", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toContain("## Startup");
		expect(markdown).toContain("| Total | 1200ms |");
		expect(markdown).toContain("| p50 | 900ms |");
		expect(markdown).toContain("| p95 | 1500ms |");
	});

	it("should include per-service breakdown", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toContain("### Per-Service Breakdown");
		expect(markdown).toContain("| settingsService | 50ms |");
		expect(markdown).toContain("| analyticsService | 200ms |");
	});

	it("should include storage section", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toContain("## Storage");
		expect(markdown).toContain("| settings |");
		expect(markdown).toContain("4.0KB");
	});

	it("should include query section", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toContain("## Query Execution");
		expect(markdown).toContain("| Executions | 10 |");
		expect(markdown).toContain("| p50 | 15ms |");
		expect(markdown).toContain("| Max | 80ms |");
	});

	it("should return structured frontmatter object", () => {
		const { frontmatter } = generatePerformanceReport(createInput());

		expect(frontmatter.type).toBe("PerformanceReport");
		expect(frontmatter.startup_total_ms).toBe(1200);
		expect(frontmatter.query_p95).toBe(45);
		expect(frontmatter.alert_triggered).toBe(false);
	});

	it("should include event dispatch section", () => {
		const { markdown } = generatePerformanceReport(createInput());

		expect(markdown).toContain("## Event Dispatch");
		expect(markdown).toContain("| Total dispatches | 250 |");
		expect(markdown).toContain("| p95 | 3.2ms |");
		expect(markdown).toContain("| Max | 15ms |");
		expect(markdown).toContain("### Slowest Event Types");
		expect(markdown).toContain("| analytics.query.completed | 15ms | 10 |");
	});

	it("should show alert triggered when true", () => {
		const { markdown } = generatePerformanceReport(createInput({ alertTriggered: true }));

		expect(markdown).toContain("| Alert triggered | Yes |");
		expect(markdown).toContain("alert_triggered: true");
	});
});
