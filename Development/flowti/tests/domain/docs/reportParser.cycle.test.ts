import { describe, it, expect } from "vitest";
import {
	parseCycleReport,
	generateCycleReportMarkdown,
} from "../../../src/domain/docs/reportParser";
import type { CycleFrontmatter, CycleReportContext } from "../../../src/domain/docs/reportParser";

const DATE = "2026-02-27T12:00:00.000Z";

describe("parseCycleReport", () => {
	it("extracts all fields from a complete cycle frontmatter", () => {
		const fm: CycleFrontmatter = {
			cycle: 50,
			stage: "done",
			date_planned: "2026-02-27",
			date_completed: "2026-02-27",
			pbis: ["PBI-ONB-016: Command Catalog", "PBI-ONB-014: Configurable Startpage", "TD-87: Knowledge base"],
			tech_debt: ["TD-87"],
			estimated_increments: 7,
			actual_increments: 8,
			pre_cycle_tests: 5452,
			pre_cycle_suites: 232,
			total_tests_after: 5549,
			total_test_files_after: 237,
		};

		const result = parseCycleReport(fm, DATE);

		expect(result.type).toBe("CycleReport");
		expect(result.date).toBe(DATE);
		expect(result.cycle).toBe(50);
		expect(result.stage).toBe("done");
		expect(result.date_planned).toBe("2026-02-27");
		expect(result.date_completed).toBe("2026-02-27");
		expect(result.increments).toBe(8);
		expect(result.estimated_increments).toBe(7);
		expect(result.tests_added).toBe(97);
		expect(result.total_tests).toBe(5549);
		expect(result.suites_added).toBe(5);
		expect(result.total_suites).toBe(237);
		expect(result.pbis_delivered).toBe(3);
		expect(result.debt_resolved).toBe(1);
	});

	it("defaults missing fields to zero/empty", () => {
		const result = parseCycleReport({}, DATE);

		expect(result.cycle).toBe(0);
		expect(result.stage).toBe("unknown");
		expect(result.date_planned).toBe("");
		expect(result.date_completed).toBe("");
		expect(result.increments).toBe(0);
		expect(result.estimated_increments).toBe(0);
		expect(result.tests_added).toBe(0);
		expect(result.total_tests).toBe(0);
		expect(result.suites_added).toBe(0);
		expect(result.total_suites).toBe(0);
		expect(result.pbis_delivered).toBe(0);
		expect(result.debt_resolved).toBe(0);
	});

	it("falls back to estimated_increments when actual_increments is missing", () => {
		const fm: CycleFrontmatter = {
			estimated_increments: 5,
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.increments).toBe(5);
		expect(result.estimated_increments).toBe(5);
	});

	it("prefers actual_increments over estimated_increments", () => {
		const fm: CycleFrontmatter = {
			estimated_increments: 5,
			actual_increments: 7,
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.increments).toBe(7);
	});

	it("calculates zero tests_added when totals equal pre-cycle", () => {
		const fm: CycleFrontmatter = {
			pre_cycle_tests: 5000,
			total_tests_after: 5000,
			pre_cycle_suites: 200,
			total_test_files_after: 200,
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.tests_added).toBe(0);
		expect(result.suites_added).toBe(0);
	});

	it("defaults total_tests to pre_cycle_tests when total_tests_after is missing", () => {
		const fm: CycleFrontmatter = {
			pre_cycle_tests: 5000,
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.tests_added).toBe(0);
		expect(result.total_tests).toBe(5000);
	});

	it("counts PBIs correctly from pbis array", () => {
		const fm: CycleFrontmatter = {
			pbis: ["PBI-A", "PBI-B"],
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.pbis_delivered).toBe(2);
	});

	it("counts tech_debt items correctly", () => {
		const fm: CycleFrontmatter = {
			tech_debt: ["TD-87", "TD-90"],
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.debt_resolved).toBe(2);
	});

	it("handles numeric tech_debt items", () => {
		const fm: CycleFrontmatter = {
			tech_debt: [87, 90],
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.debt_resolved).toBe(2);
	});

	it("handles planning stage (partial data)", () => {
		const fm: CycleFrontmatter = {
			cycle: 51,
			stage: "planning",
			estimated_increments: 5,
			pre_cycle_tests: 5549,
			pre_cycle_suites: 237,
			pbis: ["PBI-DOG-001", "PBI-DOG-002", "PBI-DOG-003", "TD-90"],
			tech_debt: ["TD-90"],
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.cycle).toBe(51);
		expect(result.stage).toBe("planning");
		expect(result.increments).toBe(5);
		expect(result.tests_added).toBe(0);
		expect(result.total_tests).toBe(5549);
		expect(result.pbis_delivered).toBe(4);
	});

	it("handles empty pbis and tech_debt arrays", () => {
		const fm: CycleFrontmatter = {
			pbis: [],
			tech_debt: [],
		};

		const result = parseCycleReport(fm, DATE);
		expect(result.pbis_delivered).toBe(0);
		expect(result.debt_resolved).toBe(0);
	});
});

describe("generateCycleReportMarkdown", () => {
	it("includes frontmatter and summary callout", () => {
		const fm: CycleFrontmatter = {
			cycle: 50,
			stage: "done",
			date_planned: "2026-02-27",
			date_completed: "2026-02-27",
			pbis: ["PBI-A", "PBI-B", "PBI-C"],
			tech_debt: ["TD-87"],
			estimated_increments: 7,
			actual_increments: 8,
			pre_cycle_tests: 5452,
			pre_cycle_suites: 232,
			total_tests_after: 5549,
			total_test_files_after: 237,
		};

		const report = parseCycleReport(fm, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).toContain("---");
		expect(md).toContain("type: CycleReport");
		expect(md).toContain("cycle: 50");
		expect(md).toContain("# Cycle 50 Report");
		expect(md).toContain("Increments: 8 (est. 7)");
		expect(md).toContain("Tests added: 97");
		expect(md).toContain("Total: 5549");
		expect(md).toContain("PBIs delivered: 3");
		expect(md).toContain("Debt resolved: 1");
	});

	it("shows N/A for missing dates", () => {
		const report = parseCycleReport({ cycle: 51, stage: "planning" }, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).toContain("Planned: N/A");
		expect(md).toContain("Completed: N/A");
	});

	it("includes suite delta in summary", () => {
		const fm: CycleFrontmatter = {
			cycle: 49,
			stage: "done",
			pre_cycle_suites: 222,
			total_test_files_after: 232,
		};

		const report = parseCycleReport(fm, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).toContain("Suites added: 10");
		expect(md).toContain("Total: 232");
	});

	it("includes all frontmatter keys", () => {
		const report = parseCycleReport({ cycle: 1 }, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).toContain("type: CycleReport");
		expect(md).toContain("cycle: 1");
		expect(md).toContain("increments:");
		expect(md).toContain("tests_added:");
		expect(md).toContain("total_tests:");
		expect(md).toContain("pbis_delivered:");
		expect(md).toContain("debt_resolved:");
	});

	it("includes wikilink to source cycle document when context provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done" }, DATE);
		const ctx: CycleReportContext = {
			cycleDocTitle: "Cycle 50 - User Activation",
		};
		const md = generateCycleReportMarkdown(report, ctx);

		expect(md).toContain("## Source");
		expect(md).toContain("[[Cycle 50 - User Activation]]");
	});

	it("includes PBI wikilinks when context provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done", pbis: ["a", "b"] }, DATE);
		const ctx: CycleReportContext = {
			pbiNames: ["PBI-ONB-016: Command Catalog", "PBI-ONB-014: Configurable Startpage"],
		};
		const md = generateCycleReportMarkdown(report, ctx);

		expect(md).toContain("## PBIs Delivered");
		expect(md).toContain("PBI-ONB-016: Command Catalog");
		expect(md).toContain("PBI-ONB-014: Configurable Startpage");
	});

	it("includes tech debt wikilinks when context provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done", tech_debt: ["TD-87"] }, DATE);
		const ctx: CycleReportContext = {
			debtNames: ["TD-87"],
		};
		const md = generateCycleReportMarkdown(report, ctx);

		expect(md).toContain("## Tech Debt Resolved");
		expect(md).toContain("TD-87");
	});

	it("omits sections when context is not provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done" }, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).not.toContain("## Source");
		expect(md).not.toContain("## PBIs Delivered");
		expect(md).not.toContain("## Tech Debt Resolved");
	});

	it("omits PBI section when pbiNames is empty", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done" }, DATE);
		const ctx: CycleReportContext = {
			cycleDocTitle: "Cycle 50 - User Activation",
			pbiNames: [],
			debtNames: [],
		};
		const md = generateCycleReportMarkdown(report, ctx);

		expect(md).toContain("## Source");
		expect(md).not.toContain("## PBIs Delivered");
		expect(md).not.toContain("## Tech Debt Resolved");
	});

	it("includes related report wikilinks when context provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done" }, DATE);
		const ctx: CycleReportContext = {
			reportLinks: [
				"2026-02-27T20-51-01.438Z-test-report",
				"2026-02-27T19-00-30.583Z-coverage-report",
				"2026-02-27T20-39-09.728Z-codebase-report",
			],
		};
		const md = generateCycleReportMarkdown(report, ctx);

		expect(md).toContain("## Related Reports");
		expect(md).toContain("[[2026-02-27T20-51-01.438Z-test-report]]");
		expect(md).toContain("[[2026-02-27T19-00-30.583Z-coverage-report]]");
		expect(md).toContain("[[2026-02-27T20-39-09.728Z-codebase-report]]");
	});

	it("omits related reports section when no report links provided", () => {
		const report = parseCycleReport({ cycle: 50, stage: "done" }, DATE);
		const md = generateCycleReportMarkdown(report);

		expect(md).not.toContain("## Related Reports");
	});
});
