import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderRAIDList, renderRAIDAdded, renderRAIDUpdated } from "../../../src/ui/displays/raid-display.js";
import type { RAIDSummary } from "../../../src/domain/raid/raid-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderRAIDList ──────────────────────────────────────────────────

describe("renderRAIDList", () => {
	it("renders empty message when no items", () => {
		renderRAIDList([], log);
		expect(output()).toContain("No RAID items defined yet");
	});

	it("renders item count in header", () => {
		const items: RAIDSummary[] = [
			{ name: "Server outage", itemType: "risk", severity: "critical", status: "open", owner: "Alice", dueDate: "2026-04-01" },
			{ name: "Vendor delay", itemType: "issue", severity: "high", status: "resolved", owner: "Bob", dueDate: "" },
		];
		renderRAIDList(items, log);
		expect(output()).toContain("RAID Log (2)");
	});

	it("renders item details", () => {
		const items: RAIDSummary[] = [
			{ name: "Server outage", itemType: "risk", severity: "critical", status: "open", owner: "Alice", dueDate: "2026-04-01" },
		];
		renderRAIDList(items, log);
		const out = output();
		expect(out).toContain("Server outage");
		expect(out).toContain("[risk]");
		expect(out).toContain("[open]");
		expect(out).toContain("Alice");
		expect(out).toContain("due 2026-04-01");
	});

	it("marks closed/resolved statuses with green tag", () => {
		const items: RAIDSummary[] = [
			{ name: "Fixed bug", itemType: "issue", severity: "low", status: "closed", owner: "", dueDate: "" },
		];
		renderRAIDList(items, log);
		expect(output()).toContain("[closed]");
	});

	it("omits owner and due tags when absent", () => {
		const items: RAIDSummary[] = [
			{ name: "Minor risk", itemType: "risk", severity: "low", status: "open", owner: "", dueDate: "" },
		];
		renderRAIDList(items, log);
		const out = output();
		expect(out).not.toContain("→");
		expect(out).not.toContain("due ");
	});
});

// ── renderRAIDAdded ─────────────────────────────────────────────────

describe("renderRAIDAdded", () => {
	it("renders created message with path", () => {
		renderRAIDAdded(".flowti/raid/risk-001.md", log);
		expect(output()).toContain("Created: .flowti/raid/risk-001.md");
	});
});

// ── renderRAIDUpdated ───────────────────────────────────────────────

describe("renderRAIDUpdated", () => {
	it("renders updated message with name and status", () => {
		renderRAIDUpdated("Server outage", "resolved", log);
		const out = output();
		expect(out).toContain("Updated Server outage");
		expect(out).toContain("resolved");
	});
});
