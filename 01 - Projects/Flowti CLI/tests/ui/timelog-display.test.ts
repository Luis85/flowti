import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../src/infrastructure/logger.js";
import { renderTimeLogList, renderTimeLogSummary, renderTimeLogAdded } from "../../src/ui/timelog-display.js";
import type { TimeLogEntry, TimeLogSummary } from "../../src/domain/timelog/timelog-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderTimeLogList ───────────────────────────────────────────────

describe("renderTimeLogList", () => {
	it("renders empty message when no entries", () => {
		renderTimeLogList([]);
		expect(output()).toContain("No time-log entries yet");
	});

	it("renders entry count and details", () => {
		const entries: TimeLogEntry[] = [
			{ date: "2026-03-10", person: "Alice", hours: 4, task: "API development", category: "dev" },
			{ date: "2026-03-11", person: "Bob", hours: 2.5, task: "Code review", category: "review" },
		];
		renderTimeLogList(entries);
		const out = output();
		expect(out).toContain("Time Log (2 entries)");
		expect(out).toContain("2026-03-10");
		expect(out).toContain("Alice");
		expect(out).toContain("4h");
		expect(out).toContain("[dev]");
		expect(out).toContain("API development");
		expect(out).toContain("Bob");
		expect(out).toContain("2.5h");
		expect(out).toContain("[review]");
	});

	it("omits category tag when absent", () => {
		const entries: TimeLogEntry[] = [
			{ date: "2026-03-10", person: "Alice", hours: 1, task: "Misc", category: "" },
		];
		renderTimeLogList(entries);
		const out = output();
		expect(out).toContain("Alice");
		expect(out).not.toContain("[]");
	});
});

// ── renderTimeLogSummary ────────────────────────────────────────────

describe("renderTimeLogSummary", () => {
	it("renders total hours and breakdowns", () => {
		const summary: TimeLogSummary = {
			totalHours: 42,
			byPerson: { Alice: 24, Bob: 18 },
			byCategory: { dev: 30, review: 12 },
		};
		renderTimeLogSummary(summary);
		const out = output();
		expect(out).toContain("Time Log Summary");
		expect(out).toContain("42");
		expect(out).toContain("By Person");
		expect(out).toContain("Alice: 24h");
		expect(out).toContain("Bob: 18h");
		expect(out).toContain("By Category");
		expect(out).toContain("dev: 30h");
		expect(out).toContain("review: 12h");
	});

	it("skips person section when empty", () => {
		const summary: TimeLogSummary = {
			totalHours: 0,
			byPerson: {},
			byCategory: {},
		};
		renderTimeLogSummary(summary);
		const out = output();
		expect(out).toContain("Time Log Summary");
		expect(out).not.toContain("By Person");
		expect(out).not.toContain("By Category");
	});
});

// ── renderTimeLogAdded ──────────────────────────────────────────────

describe("renderTimeLogAdded", () => {
	it("renders logged message with path", () => {
		renderTimeLogAdded(".flowti/timelog/2026-03-10.md");
		expect(output()).toContain("Logged: .flowti/timelog/2026-03-10.md");
	});
});
