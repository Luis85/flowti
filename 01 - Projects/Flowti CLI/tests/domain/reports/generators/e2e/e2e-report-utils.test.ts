import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../../src/infrastructure/proc.js", () => {
	const env: Record<string, string | undefined> = {};
	return { proc: { env: () => env } };
});

import { proc } from "../../../../../src/infrastructure/proc.js";
import {
	resolveMode, resolveVars, formatDuration, statusCallout,
	resolveStatus, statusLabel, computeActionStats, round,
	percentile, formatBytes, buildStepsSummary, TOOL_COUNTER_MAP,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-utils.js";

describe("resolveMode", () => {
	beforeEach(() => {
		const env = proc.env();
		delete env.E2E_JOURNEY;
	});

	it("returns 'full' when E2E_JOURNEY is not set", () => {
		expect(resolveMode()).toBe("full");
	});

	it("returns journey name when set", () => {
		proc.env().E2E_JOURNEY = "getting-started";
		expect(resolveMode()).toBe("getting-started");
	});

	it("returns comma-separated journeys", () => {
		proc.env().E2E_JOURNEY = "installer,getting-started";
		expect(resolveMode()).toBe("installer,getting-started");
	});
});

describe("resolveVars", () => {
	it("replaces known variables", () => {
		expect(resolveVars("Hello {{name}}", { name: "World" })).toBe("Hello World");
	});

	it("replaces unknown variables with em dash", () => {
		expect(resolveVars("Hello {{unknown}}", {})).toBe("Hello \u2014");
	});

	it("returns empty string for empty template", () => {
		expect(resolveVars("")).toBe("");
	});

	it("works without variables map", () => {
		expect(resolveVars("Hello {{name}}")).toBe("Hello \u2014");
	});

	it("handles multiple variables", () => {
		expect(resolveVars("{{a}} and {{b}}", { a: "X", b: "Y" })).toBe("X and Y");
	});
});

describe("formatDuration", () => {
	it("formats milliseconds", () => {
		expect(formatDuration(500)).toBe("500ms");
	});

	it("formats seconds", () => {
		expect(formatDuration(5000)).toBe("5.0s");
	});

	it("formats minutes and seconds", () => {
		expect(formatDuration(125000)).toBe("2m 5s");
	});

	it("formats exact minutes", () => {
		expect(formatDuration(120000)).toBe("2m");
	});

	it("rounds sub-millisecond to 0ms", () => {
		expect(formatDuration(0.4)).toBe("0ms");
	});
});

describe("statusCallout", () => {
	it("returns success for pass", () => {
		expect(statusCallout("pass")).toBe("success");
	});

	it("returns danger for fail", () => {
		expect(statusCallout("fail")).toBe("danger");
	});

	it("returns warning for partial-pass", () => {
		expect(statusCallout("partial-pass")).toBe("warning");
	});

	it("returns warning for skipped", () => {
		expect(statusCallout("skipped")).toBe("warning");
	});

	it("returns info for dev", () => {
		expect(statusCallout("dev")).toBe("info");
	});

	it("returns info for dev-stopped", () => {
		expect(statusCallout("dev-stopped")).toBe("info");
	});
});

describe("resolveStatus", () => {
	it("returns pass when all passed", () => {
		expect(resolveStatus(5, 0, 5)).toBe("pass");
	});

	it("returns fail when any failed", () => {
		expect(resolveStatus(3, 2, 5)).toBe("fail");
	});

	it("returns partial-pass when some skipped", () => {
		expect(resolveStatus(3, 0, 5, 2)).toBe("partial-pass");
	});

	it("returns partial-pass when has warnings", () => {
		expect(resolveStatus(5, 0, 5, 0, true)).toBe("partial-pass");
	});

	it("returns dev-stopped when devStopped", () => {
		expect(resolveStatus(3, 0, 5, 0, false, true)).toBe("dev-stopped");
	});

	it("returns skipped when none passed", () => {
		expect(resolveStatus(0, 0, 5)).toBe("skipped");
	});
});

describe("statusLabel", () => {
	it("maps all status values", () => {
		expect(statusLabel("pass")).toBe("PASS");
		expect(statusLabel("fail")).toBe("FAIL");
		expect(statusLabel("partial-pass")).toBe("PARTIAL PASS");
		expect(statusLabel("skipped")).toBe("SKIPPED");
		expect(statusLabel("dev")).toBe("DEV");
		expect(statusLabel("dev-stopped")).toBe("DEV");
	});
});

describe("round", () => {
	it("rounds to 2 decimal places", () => {
		expect(round(3.14159)).toBe(3.14);
		expect(round(2.345)).toBe(2.35);
	});
});

describe("percentile", () => {
	it("returns 0 for empty array", () => {
		expect(percentile([], 0.5)).toBe(0);
	});

	it("returns p50 of sorted array", () => {
		expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
	});

	it("returns p95 of sorted array", () => {
		expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95)).toBe(10);
	});
});

describe("formatBytes", () => {
	it("formats bytes", () => {
		expect(formatBytes(512)).toBe("512B");
	});

	it("formats kilobytes", () => {
		expect(formatBytes(2048)).toBe("2.0KB");
	});

	it("formats megabytes", () => {
		expect(formatBytes(1048576 * 2)).toBe("2.0MB");
	});
});

describe("buildStepsSummary", () => {
	it("returns basic summary", () => {
		expect(buildStepsSummary(5, 5, 0, 0, false)).toBe("5/5 steps");
	});

	it("includes skipped count", () => {
		expect(buildStepsSummary(3, 5, 2, 0, false)).toBe("3/5 steps (2 skipped)");
	});

	it("includes dev and skipped for dev-stopped", () => {
		expect(buildStepsSummary(3, 5, 1, 1, true)).toBe("3/5 steps (1 dev, 1 skipped)");
	});
});

describe("TOOL_COUNTER_MAP", () => {
	it("maps all expected tools", () => {
		expect(TOOL_COUNTER_MAP["screenshot"]).toBe("screenshots");
		expect(TOOL_COUNTER_MAP["assert"]).toBe("assertions");
		expect(TOOL_COUNTER_MAP["manual"]).toBe("manual_checks");
	});
});

describe("computeActionStats", () => {
	it("returns empty stats for no steps", () => {
		const stats = computeActionStats({});
		expect(stats.total).toBe(0);
		expect(stats.tools).toEqual([]);
	});

	it("counts actions by tool type", () => {
		const data = {
			steps: [
				{
					step: { actions: [{ tool: "screenshot" }, { tool: "assert" }, { tool: "screenshot" }] },
					status: "pass",
					durationMs: 100,
				},
			],
		};
		const stats = computeActionStats(data);
		expect(stats.total).toBe(3);
		expect(stats.screenshots).toBe(2);
		expect(stats.assertions).toBe(1);
		expect(stats.tools).toEqual(["assert", "screenshot"]);
	});

	it("counts manual verification results", () => {
		const data = {
			steps: [
				{
					step: { actions: [] },
					status: "pass",
					durationMs: 100,
					manualVerifications: [
						{ status: "pass", instruction: "Check A" },
						{ status: "fail", instruction: "Check B" },
					],
				},
			],
		};
		const stats = computeActionStats(data);
		expect(stats.manual_passed).toBe(1);
		expect(stats.manual_failed).toBe(1);
	});
});
