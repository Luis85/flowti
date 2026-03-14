import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	renderIterationList, renderIterationDetail, renderIterationCreated,
	renderIterationStarted, renderIterationClosed,
	renderAgentAdded, renderResourceAdded, renderEstimationAdded,
	renderPlanningHeader, renderScopeItems, renderGateStatus,
} from "../../../src/ui/displays/iterations-display.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

function makeSummary(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14",
		goal: "Build MVP", capacity: "40", description: "", status: "planned", file: "iteration-001-plan.md",
		agents: [], resources: [], capacities: [], scopeItems: [], ...overrides,
	};
}

describe("renderIterationList", () => {
	it("shows empty message when no iterations", () => {
		renderIterationList([], log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No iterations defined");
	});

	it("renders iteration items", () => {
		renderIterationList([makeSummary(), makeSummary({ name: "Sprint 2", number: 2 })], log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Sprint 1");
		expect(output).toContain("Sprint 2");
		expect(output).toContain("#1");
	});
});

describe("renderIterationDetail", () => {
	it("renders detail with all fields", () => {
		renderIterationDetail(makeSummary({
			resources: [{ name: "Luis", role: "Dev Lead", allocation: "80%" }],
			capacities: [{ label: "Story Points", value: "40", unit: "pts" }],
			agents: [{ name: "CodeReview", file: "code-review.md" }],
			scopeItems: [{ text: "Implement auth", done: false }, { text: "Add tests", done: true }],
		}), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Sprint 1");
		expect(output).toContain("Build MVP");
		expect(output).toContain("Luis");
		expect(output).toContain("Story Points");
		expect(output).toContain("CodeReview");
		expect(output).toContain("Scope");
		expect(output).toContain("Implement auth");
		expect(output).toContain("Add tests");
		expect(output).toContain("[x]");
		expect(output).toContain("[ ]");
	});
});

describe("feedback renderers", () => {
	it("renderIterationCreated shows path", () => {
		renderIterationCreated("docs/iterations/iteration-001-plan.md", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Created");
	});

	it("renderIterationStarted shows name", () => {
		renderIterationStarted("Sprint 1", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Started");
	});

	it("renderIterationClosed shows name", () => {
		renderIterationClosed("Sprint 1", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Closed");
	});

	it("renderAgentAdded shows agent and iteration names", () => {
		renderAgentAdded("CodeReview", "Sprint 1", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("CodeReview");
	});

	it("renderResourceAdded shows resource name", () => {
		renderResourceAdded("Luis", "Sprint 1", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Luis");
	});

	it("renderEstimationAdded shows estimation label", () => {
		renderEstimationAdded("Story Points", "Sprint 1", log);
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Story Points");
	});
});

describe("renderPlanningHeader", () => {
	it("renders header with description", () => {
		renderPlanningHeader(makeSummary({ description: "Sprint planning notes" }), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Edit");
		expect(output).toContain("Sprint 1");
		expect(output).toContain("Sprint planning notes");
		expect(output).toContain("Build MVP");
	});

	it("shows (none) when description is empty", () => {
		renderPlanningHeader(makeSummary({ description: "" }), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("(none)");
	});

	it("shows status and dates", () => {
		renderPlanningHeader(makeSummary({ status: "in-progress" }), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("in-progress");
		expect(output).toContain("2026-03-01");
		expect(output).toContain("2026-03-14");
	});

	it("does not show scope items", () => {
		renderPlanningHeader(makeSummary({
			scopeItems: [{ text: "Auth module", done: false }],
		}), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).not.toContain("Auth module");
		expect(output).not.toContain("Scope");
	});

	it("shows (not set) for empty dates", () => {
		renderPlanningHeader(makeSummary({ startDate: "", endDate: "" }), log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("(not set)");
	});
});

describe("renderScopeItems", () => {
	it("renders nothing when empty", () => {
		renderScopeItems([], log);
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("renders checklist with done count", () => {
		renderScopeItems([
			{ text: "Task A", done: false },
			{ text: "Task B", done: true },
			{ text: "Task C", done: true },
		], log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Scope");
		expect(output).toContain("(2/3)");
		expect(output).toContain("[ ]");
		expect(output).toContain("[x]");
		expect(output).toContain("Task A");
		expect(output).toContain("Task B");
	});
});

describe("renderGateStatus", () => {
	it("renders nothing when empty", () => {
		renderGateStatus([], log);
		expect(mockLog).not.toHaveBeenCalled();
	});

	it("renders gate checklist with pass/fail indicators", () => {
		renderGateStatus([
			{ label: "Goal defined", passed: true },
			{ label: "Scope items exist", passed: false },
		], log);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Quality Gates");
		expect(output).toContain("Goal defined");
		expect(output).toContain("Scope items exist");
	});
});
