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
	renderAgentAttached, renderResourceAdded, renderCapacityAdded,
} from "../../../src/ui/displays/iterations-display.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { IterationSummary } from "../../../src/domain/iterations/iteration-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

function makeSummary(overrides: Partial<IterationSummary> = {}): IterationSummary {
	return {
		name: "Sprint 1", number: 1, startDate: "2026-03-01", endDate: "2026-03-14",
		goal: "Build MVP", capacity: "40", status: "planned", file: "iteration-001-plan.md",
		agents: [], resources: [], capacities: [], ...overrides,
	};
}

describe("renderIterationList", () => {
	it("shows empty message when no iterations", () => {
		renderIterationList([]);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("No iterations defined");
	});

	it("renders iteration items", () => {
		renderIterationList([makeSummary(), makeSummary({ name: "Sprint 2", number: 2 })]);
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
		}));
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Sprint 1");
		expect(output).toContain("Build MVP");
		expect(output).toContain("Luis");
		expect(output).toContain("Story Points");
		expect(output).toContain("CodeReview");
	});
});

describe("feedback renderers", () => {
	it("renderIterationCreated shows path", () => {
		renderIterationCreated("docs/iterations/iteration-001-plan.md");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Created");
	});

	it("renderIterationStarted shows name", () => {
		renderIterationStarted("Sprint 1");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Started");
	});

	it("renderIterationClosed shows name", () => {
		renderIterationClosed("Sprint 1");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Closed");
	});

	it("renderAgentAttached shows agent and iteration names", () => {
		renderAgentAttached("CodeReview", "Sprint 1");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("CodeReview");
	});

	it("renderResourceAdded shows resource name", () => {
		renderResourceAdded("Luis", "Sprint 1");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Luis");
	});

	it("renderCapacityAdded shows capacity label", () => {
		renderCapacityAdded("Story Points", "Sprint 1");
		expect(mockLog.mock.calls.flat().join(" ")).toContain("Story Points");
	});
});
