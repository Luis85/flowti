import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../src/infrastructure/logger.js";
import { renderDeliverableList, renderDeliverableAdded, renderDeliverableUpdated } from "../../src/ui/deliverables-display.js";
import type { DeliverableSummary } from "../../src/domain/deliverables/deliverable-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderDeliverableList ───────────────────────────────────────────

describe("renderDeliverableList", () => {
	it("renders empty message when no deliverables", () => {
		renderDeliverableList([]);
		expect(output()).toContain("No deliverables defined yet");
	});

	it("renders deliverable count in header", () => {
		const items: DeliverableSummary[] = [
			{ name: "API Spec", status: "done", completionPct: 100, dueDate: "2026-03-01", assignee: "Bob" },
			{ name: "UI Mockup", status: "in-progress", completionPct: 40, dueDate: "", assignee: "" },
		];
		renderDeliverableList(items);
		expect(output()).toContain("Deliverables (2)");
	});

	it("renders deliverable details", () => {
		const items: DeliverableSummary[] = [
			{ name: "API Spec", status: "done", completionPct: 100, dueDate: "2026-03-01", assignee: "Bob" },
		];
		renderDeliverableList(items);
		const out = output();
		expect(out).toContain("API Spec");
		expect(out).toContain("[done]");
		expect(out).toContain("100%");
		expect(out).toContain("due 2026-03-01");
		expect(out).toContain("Bob");
	});

	it("omits due and assignee tags when absent", () => {
		const items: DeliverableSummary[] = [
			{ name: "Draft", status: "planned", completionPct: 0, dueDate: "", assignee: "" },
		];
		renderDeliverableList(items);
		const out = output();
		expect(out).not.toContain("due ");
		expect(out).not.toContain("→");
	});
});

// ── renderDeliverableAdded ──────────────────────────────────────────

describe("renderDeliverableAdded", () => {
	it("renders created message with path", () => {
		renderDeliverableAdded(".flowti/deliverables/api-spec.md");
		expect(output()).toContain("Created: .flowti/deliverables/api-spec.md");
	});
});

// ── renderDeliverableUpdated ────────────────────────────────────────

describe("renderDeliverableUpdated", () => {
	it("renders updated message with name and status", () => {
		renderDeliverableUpdated("API Spec", "done");
		const out = output();
		expect(out).toContain("Updated API Spec");
		expect(out).toContain("done");
	});
});
