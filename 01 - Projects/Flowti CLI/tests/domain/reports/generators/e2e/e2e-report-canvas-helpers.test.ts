import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../src/domain/reports/generators/e2e/e2e-report-utils.js", () => ({
	resolveVars: vi.fn((s: string) => s),
	formatDuration: vi.fn((ms: number) => `${ms}ms`),
}));

import {
	actionColor,
	formatActionText,
	appendConfigDescriptionLines,
	appendConfigUiContextLines,
	appendConfigMetadataLines,
	appendManualResultLines,
	appendCanvasManualLines,
	appendCanvasVisualLines,
	buildCanvasConfigLines,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-canvas-helpers.js";

describe("e2e-report-canvas-helpers", () => {
	describe("actionColor", () => {
		it("returns '6' for screenshot", () => {
			expect(actionColor("screenshot")).toBe("6");
		});

		it("returns '4' for assert", () => {
			expect(actionColor("assert")).toBe("4");
		});

		it("returns undefined for unknown tool", () => {
			expect(actionColor("unknown-tool")).toBeUndefined();
		});
	});

	describe("formatActionText", () => {
		it("formats command action", () => {
			const result = formatActionText({ tool: "command", id: "flowti:test" } as any);
			expect(result).toContain("command");
			expect(result).toContain("flowti:test");
		});

		it("formats click action", () => {
			const result = formatActionText({ tool: "click", selector: ".btn" } as any);
			expect(result).toContain("click");
			expect(result).toContain(".btn");
		});

		it("formats screenshot action", () => {
			const result = formatActionText({ tool: "screenshot", label: "Home" } as any);
			expect(result).toContain("screenshot");
			expect(result).toContain("Home");
		});

		it("formats assert visible action", () => {
			const result = formatActionText({ tool: "assert", type: "visible", selector: ".el" } as any);
			expect(result).toContain("assert visible");
		});

		it("formats assert event action", () => {
			const result = formatActionText({ tool: "assert", type: "event", event: "app.loaded" } as any);
			expect(result).toContain("assert event");
		});

		it("formats wait action", () => {
			const result = formatActionText({ tool: "wait", ms: 500 } as any);
			expect(result).toContain("wait");
			expect(result).toContain("500");
		});

		it("formats unknown tool as bold tool name", () => {
			const result = formatActionText({ tool: "custom-tool" } as any);
			expect(result).toBe("**custom-tool**");
		});

		it("appends description when present", () => {
			const result = formatActionText({ tool: "command", id: "flowti:test", description: "runs tests" } as any);
			expect(result).toContain("runs tests");
		});
	});

	describe("appendConfigDescriptionLines", () => {
		it("adds description and expected input/output lines", () => {
			const lines: string[] = [];
			appendConfigDescriptionLines(lines, {
				id: "s1",
				guideSection: "sec",
				title: "title",
				description: "A step description",
				expectedInput: "some input",
				expectedOutput: "some output",
			} as any);
			expect(lines).toContain("A step description");
			expect(lines.some((l) => l.includes("Input") && l.includes("some input"))).toBe(true);
			expect(lines.some((l) => l.includes("Expected") && l.includes("some output"))).toBe(true);
		});

		it("does nothing for empty step definition", () => {
			const lines: string[] = [];
			appendConfigDescriptionLines(lines, { id: "s1", guideSection: "sec", title: "title" } as any);
			expect(lines).toHaveLength(0);
		});
	});

	describe("appendConfigUiContextLines", () => {
		it("adds view and tab info", () => {
			const lines: string[] = [];
			appendConfigUiContextLines(lines, {
				id: "s1",
				guideSection: "sec",
				title: "title",
				uiContext: { view: "hub", viewName: "Hub View", tab: "events", tabName: "Events Tab" },
			} as any);
			expect(lines.some((l) => l.includes("View") && l.includes("Hub View"))).toBe(true);
			expect(lines.some((l) => l.includes("Tab") && l.includes("Events Tab"))).toBe(true);
		});

		it("adds component list", () => {
			const lines: string[] = [];
			appendConfigUiContextLines(lines, {
				id: "s1",
				guideSection: "sec",
				title: "title",
				uiContext: { components: ["button", "modal"] },
			} as any);
			expect(lines.some((l) => l.includes("Components") && l.includes("button") && l.includes("modal"))).toBe(true);
		});
	});

	describe("appendConfigMetadataLines", () => {
		it("adds events, commands, queries, interactions", () => {
			const lines: string[] = [];
			appendConfigMetadataLines(lines, {
				id: "s1",
				guideSection: "sec",
				title: "title",
				events: ["app.loaded", "hub.opened"],
				commands: ["flowti:open"],
				queries: ["getItems"],
				interactions: ["click the button"],
			} as any);
			expect(lines.some((l) => l.includes("Events") && l.includes("app.loaded"))).toBe(true);
			expect(lines.some((l) => l.includes("Commands") && l.includes("flowti:open"))).toBe(true);
			expect(lines.some((l) => l.includes("Queries") && l.includes("getItems"))).toBe(true);
			expect(lines.some((l) => l.includes("Interactions") && l.includes("click the button"))).toBe(true);
		});
	});

	describe("appendManualResultLines", () => {
		it("shows PASSED when all manual verifications pass", () => {
			const lines: string[] = [];
			appendManualResultLines(lines, [
				{ status: "pass", instruction: "Check header is visible" },
				{ status: "pass", instruction: "Check footer is visible" },
			]);
			expect(lines.some((l) => l.includes("PASSED"))).toBe(true);
			expect(lines.some((l) => l.includes("Check header is visible"))).toBe(true);
		});

		it("shows FAILED when any manual verification fails", () => {
			const lines: string[] = [];
			appendManualResultLines(lines, [
				{ status: "pass", instruction: "Check header" },
				{ status: "fail", instruction: "Check footer", notes: "Footer missing" },
			]);
			expect(lines.some((l) => l.includes("FAILED"))).toBe(true);
			expect(lines.some((l) => l.includes("Footer missing"))).toBe(true);
		});
	});

	describe("appendCanvasManualLines", () => {
		it("shows manual results when verifications are present", () => {
			const lines: string[] = [];
			const stepResult = {
				step: { actions: [{ tool: "manual", instruction: "Verify header" }] },
				manualVerifications: [{ status: "pass", instruction: "Verify header" }],
				status: "pass",
				durationMs: 100,
			} as any;
			appendCanvasManualLines(lines, stepResult, {});
			expect(lines.some((l) => l.includes("Manual QA"))).toBe(true);
		});

		it("shows checkboxes when only actions are present (no results)", () => {
			const lines: string[] = [];
			const stepResult = {
				step: { actions: [{ tool: "manual", instruction: "Verify footer" }] },
				manualVerifications: [],
				status: "pass",
				durationMs: 100,
			} as any;
			appendCanvasManualLines(lines, stepResult, {});
			expect(lines.some((l) => l.includes("[ ]") && l.includes("Verify footer"))).toBe(true);
		});
	});

	describe("appendCanvasVisualLines", () => {
		it("shows visual inspection lines when visual-inspection actions are present", () => {
			const lines: string[] = [];
			const stepResult = {
				step: { actions: [{ tool: "visual-inspection", prompt: "Does the layout look correct?" }] },
				warnings: [],
				status: "pass",
				durationMs: 100,
			} as any;
			appendCanvasVisualLines(lines, stepResult, {});
			expect(lines.some((l) => l.includes("Visual Inspection"))).toBe(true);
			expect(lines.some((l) => l.includes("Does the layout look correct?"))).toBe(true);
		});

		it("does nothing when no visual-inspection actions are present", () => {
			const lines: string[] = [];
			const stepResult = {
				step: { actions: [{ tool: "click", selector: ".btn" }] },
				status: "pass",
				durationMs: 100,
			} as any;
			appendCanvasVisualLines(lines, stepResult, {});
			expect(lines).toHaveLength(0);
		});
	});

	describe("buildCanvasConfigLines", () => {
		it("builds complete config card lines", () => {
			const stepResult = {
				step: {
					id: "step-1",
					guideSection: "Setup",
					title: "Open the hub",
					describeBlock: "Getting Started",
					itBlock: "opens the hub",
					description: "Navigate to the main hub",
					events: ["hub.opened"],
					actions: [],
				},
				status: "pass",
				durationMs: 1200,
			} as any;
			const canvasCheckbox = (_status: string, _hasWarnings: boolean) => "x";
			const lines = buildCanvasConfigLines(stepResult, "getting-started", {}, canvasCheckbox);
			expect(lines.some((l) => l.includes("Getting Started"))).toBe(true);
			expect(lines.some((l) => l.includes("opens the hub"))).toBe(true);
			expect(lines.some((l) => l.includes("Navigate to the main hub"))).toBe(true);
			expect(lines.some((l) => l.includes("hub.opened"))).toBe(true);
		});
	});
});
