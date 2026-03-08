import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../../src/infrastructure/proc.js", () => ({
	proc: { env: () => ({}) },
}));

import {
	formatActionText, generateJourneyCanvas,
} from "../../../../../src/domain/reports/generators/e2e/e2e-report-canvas.js";
import type { CanvasResult } from "../../../../../src/domain/reports/generators/e2e/e2e-report-types.js";

describe("formatActionText", () => {
	it("formats command action", () => {
		expect(formatActionText({ tool: "command", id: "flowti:open" })).toBe("**command** `flowti:open`");
	});

	it("formats click action", () => {
		expect(formatActionText({ tool: "click", selector: ".btn" })).toBe("**click** `.btn`");
	});

	it("formats screenshot action", () => {
		expect(formatActionText({ tool: "screenshot", label: "main-view" })).toBe("**screenshot** main-view");
	});

	it("formats screenshot without label", () => {
		expect(formatActionText({ tool: "screenshot" })).toBe("**screenshot** (auto)");
	});

	it("formats wait action", () => {
		expect(formatActionText({ tool: "wait", ms: 500 })).toBe("**wait** 500ms");
	});

	it("formats emit action", () => {
		expect(formatActionText({ tool: "emit", event: "hub.opened" })).toBe("**emit** `hub.opened`");
	});

	it("formats navigate action", () => {
		expect(formatActionText({ tool: "navigate", hub: "User", tab: "Settings" })).toBe("**navigate** User → Settings");
	});

	it("formats theme action", () => {
		expect(formatActionText({ tool: "theme", theme: "dark" })).toBe("**theme** → `dark`");
	});

	it("formats assert visible action", () => {
		expect(formatActionText({ tool: "assert", type: "visible", selector: ".modal" })).toBe("**assert visible** `.modal`");
	});

	it("formats assert event action", () => {
		expect(formatActionText({ tool: "assert", type: "event", event: "hub.opened" })).toBe("**assert event** `hub.opened`");
	});

	it("formats unknown tool", () => {
		expect(formatActionText({ tool: "custom" })).toBe("**custom**");
	});

	it("appends description when present", () => {
		expect(formatActionText({ tool: "command", id: "cmd", description: "Run the command" }))
			.toBe("**command** `cmd`\nRun the command");
	});

	it("resolves variables in action text", () => {
		expect(formatActionText({ tool: "emit", event: "{{eventName}}" }, { eventName: "hub.opened" }))
			.toBe("**emit** `hub.opened`");
	});
});

describe("generateJourneyCanvas", () => {
	it("generates a canvas with start and end nodes", () => {
		const data = {
			journey: "getting-started",
			date: "2026-03-08T12:00:00Z",
			steps: [],
			passed: 0,
			failed: 0,
			skipped: 0,
			totalSteps: 0,
			durationMs: 1000,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", null, null);

		expect(canvas.metadata.version).toBe("1.0-1.0");
		expect(canvas.metadata.startNode).toBe("e2e-n-start");
		expect(canvas.nodes.length).toBeGreaterThanOrEqual(3); // start, events, end
		expect(canvas.edges.length).toBeGreaterThanOrEqual(2);
	});

	it("includes config file node when provided", () => {
		const data = {
			journey: "test",
			date: "2026-03-08T12:00:00Z",
			steps: [],
			passed: 0, failed: 0, skipped: 0, totalSteps: 0, durationMs: 0,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", null, "config.json");
		const configNode = canvas.nodes.find((n) => n.id === "e2e-n-config");
		expect(configNode).toBeDefined();
		expect(configNode!.file).toBe("config.json");
	});

	it("creates step groups for each step", () => {
		const data = {
			journey: "test",
			date: "2026-03-08T12:00:00Z",
			steps: [
				{ step: { id: "step-1", guideSection: "1", title: "First Step", actions: [] }, status: "pass", durationMs: 100 },
				{ step: { id: "step-2", guideSection: "2", title: "Second Step", actions: [] }, status: "pass", durationMs: 200 },
			],
			passed: 2, failed: 0, skipped: 0, totalSteps: 2, durationMs: 300,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", null, null);
		const groupNodes = canvas.nodes.filter((n) => n.id.startsWith("e2e-g-step-"));
		expect(groupNodes).toHaveLength(2);
	});

	it("sets pass color on passing step groups", () => {
		const data = {
			journey: "test",
			date: "2026-03-08T12:00:00Z",
			steps: [
				{ step: { id: "s1", guideSection: "1", title: "Pass", actions: [] }, status: "pass", durationMs: 100 },
			],
			passed: 1, failed: 0, skipped: 0, totalSteps: 1, durationMs: 100,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", null, null);
		const group = canvas.nodes.find((n) => n.id === "e2e-g-s1");
		expect(group?.color).toBe("4"); // green
	});

	it("sets fail color on failing step groups", () => {
		const data = {
			journey: "test",
			date: "2026-03-08T12:00:00Z",
			steps: [
				{ step: { id: "s1", guideSection: "1", title: "Fail", actions: [] }, status: "fail", durationMs: 100 },
			],
			passed: 0, failed: 1, skipped: 0, totalSteps: 1, durationMs: 100,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", null, null);
		const group = canvas.nodes.find((n) => n.id === "e2e-g-s1");
		expect(group?.color).toBe("1"); // red
	});

	it("includes event frequency in events node when trace provided", () => {
		const data = {
			journey: "test",
			date: "2026-03-08T12:00:00Z",
			steps: [],
			passed: 0, failed: 0, skipped: 0, totalSteps: 0, durationMs: 0,
		};
		const trace = {
			summary: { eventFrequency: { "hub.opened": 5, "settings.changed": 3 } },
			durationMs: 1000,
		};

		const canvas = generateJourneyCanvas(data, "screenshots", trace, null);
		const eventsNode = canvas.nodes.find((n) => n.id === "e2e-n-events");
		expect(eventsNode?.text).toContain("hub.opened");
	});
});
