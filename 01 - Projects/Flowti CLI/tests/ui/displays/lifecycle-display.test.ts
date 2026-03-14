import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	renderLifecycleStatus,
	renderTransitionHistory,
	renderTransitionResult,
	renderLifecycleList,
	renderLifecycleCreated,
} from "../../../src/ui/displays/lifecycle-display.js";
import type { LifecycleRecord, LifecycleSummary, TransitionResult } from "../../../src/domain/lifecycle/lifecycle-types.js";
import type { LifecycleTransitionRecord } from "../../../src/infrastructure/types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderLifecycleStatus ───────────────────────────────────────────

describe("renderLifecycleStatus", () => {
	it("renders record details", () => {
		const record: LifecycleRecord = {
			name: "Alpha Release",
			entityType: "release",
			currentState: "execution",
			history: [{ from: "planning", to: "execution", date: "2026-02-01", reason: "Kicked off" }],
			lastTransitionDate: "2026-02-01",
			description: "First public release",
		};
		renderLifecycleStatus(record, log);
		const out = output();
		expect(out).toContain("Alpha Release");
		expect(out).toContain("release");
		expect(out).toContain("execution");
		expect(out).toContain("Transitions: 1");
		expect(out).toContain("2026-02-01");
		expect(out).toContain("First public release");
	});

	it("omits optional fields when absent", () => {
		const record: LifecycleRecord = {
			name: "Minimal",
			entityType: "project",
			currentState: "inception",
			history: [],
			lastTransitionDate: "",
			description: "",
		};
		renderLifecycleStatus(record, log);
		const out = output();
		expect(out).toContain("Minimal");
		expect(out).toContain("Transitions: 0");
	});
});

// ── renderTransitionHistory ─────────────────────────────────────────

describe("renderTransitionHistory", () => {
	it("renders empty message when no transitions", () => {
		renderTransitionHistory([], log);
		expect(output()).toContain("No transitions recorded yet");
	});

	it("renders transition details", () => {
		const history: LifecycleTransitionRecord[] = [
			{ from: "planning", to: "execution", date: "2026-02-01", reason: "Sprint start" },
			{ from: "execution", to: "release", date: "2026-03-01", reason: "Feature complete" },
		];
		renderTransitionHistory(history, log);
		const out = output();
		expect(out).toContain("Transition History (2)");
		expect(out).toContain("planning");
		expect(out).toContain("execution");
		expect(out).toContain("Sprint start");
		expect(out).toContain("release");
		expect(out).toContain("Feature complete");
	});
});

// ── renderTransitionResult ──────────────────────────────────────────

describe("renderTransitionResult", () => {
	it("renders success", () => {
		const result: TransitionResult = { success: true, from: "planning", to: "execution" };
		renderTransitionResult(result, log);
		const out = output();
		expect(out).toContain("Transitioned");
		expect(out).toContain("planning");
		expect(out).toContain("execution");
	});

	it("renders failure", () => {
		const result: TransitionResult = { success: false, error: "Invalid transition from archived" };
		renderTransitionResult(result, log);
		expect(output()).toContain("Invalid transition from archived");
	});
});

// ── renderLifecycleList ─────────────────────────────────────────────

describe("renderLifecycleList", () => {
	it("renders empty message when no items", () => {
		renderLifecycleList([], log);
		expect(output()).toContain("No lifecycle items found");
	});

	it("renders item list", () => {
		const items: LifecycleSummary[] = [
			{ name: "Alpha", entityType: "release", currentState: "execution", transitionCount: 3 },
			{ name: "Beta", entityType: "feature", currentState: "planning", transitionCount: 1 },
		];
		renderLifecycleList(items, log);
		const out = output();
		expect(out).toContain("Lifecycle Items (2)");
		expect(out).toContain("Alpha");
		expect(out).toContain("[release]");
		expect(out).toContain("[execution]");
		expect(out).toContain("3 transitions");
		expect(out).toContain("Beta");
	});
});

// ── renderLifecycleCreated ──────────────────────────────────────────

describe("renderLifecycleCreated", () => {
	it("renders created message with path", () => {
		renderLifecycleCreated(".flowti/lifecycle/alpha.md", log);
		expect(output()).toContain("Created: .flowti/lifecycle/alpha.md");
	});
});
