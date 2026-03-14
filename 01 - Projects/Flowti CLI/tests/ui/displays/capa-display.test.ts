import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderCAPAList, renderCAPAAdded, renderCAPAUpdated } from "../../../src/ui/displays/capa-display.js";
import type { CAPASummary } from "../../../src/domain/capa/capa-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderCAPAList ──────────────────────────────────────────────────

describe("renderCAPAList", () => {
	it("renders empty message when no items", () => {
		renderCAPAList([], log);
		expect(output()).toContain("No CAPA items defined yet");
	});

	it("renders item count in header", () => {
		const items: CAPASummary[] = [
			{ id: "CAPA-001", name: "Fix valve leak", capaType: "corrective", severity: "high", status: "open", owner: "Alice", dueDate: "2026-04-01" },
			{ id: "CAPA-002", name: "Update SOP", capaType: "preventive", severity: "low", status: "closed", owner: "", dueDate: "" },
		];
		renderCAPAList(items, log);
		const out = output();
		expect(out).toContain("CAPA Log (2)");
	});

	it("renders item details", () => {
		const items: CAPASummary[] = [
			{ id: "CAPA-001", name: "Fix valve leak", capaType: "corrective", severity: "critical", status: "open", owner: "Alice", dueDate: "2026-04-01" },
		];
		renderCAPAList(items, log);
		const out = output();
		expect(out).toContain("CAPA-001");
		expect(out).toContain("Fix valve leak");
		expect(out).toContain("[corrective]");
		expect(out).toContain("[open]");
		expect(out).toContain("Alice");
		expect(out).toContain("due 2026-04-01");
	});

	it("marks closed/verified statuses with green tag", () => {
		const items: CAPASummary[] = [
			{ id: "CAPA-003", name: "Verified item", capaType: "corrective", severity: "medium", status: "verified", owner: "", dueDate: "" },
		];
		renderCAPAList(items, log);
		const out = output();
		expect(out).toContain("[verified]");
	});

	it("omits owner and due tags when absent", () => {
		const items: CAPASummary[] = [
			{ id: "CAPA-004", name: "No owner", capaType: "preventive", severity: "low", status: "open", owner: "", dueDate: "" },
		];
		renderCAPAList(items, log);
		const out = output();
		expect(out).not.toContain("→");
		expect(out).not.toContain("due ");
	});
});

// ── renderCAPAAdded ─────────────────────────────────────────────────

describe("renderCAPAAdded", () => {
	it("renders created message with path", () => {
		renderCAPAAdded(".flowti/capa/CAPA-001.md", log);
		expect(output()).toContain("Created: .flowti/capa/CAPA-001.md");
	});
});

// ── renderCAPAUpdated ───────────────────────────────────────────────

describe("renderCAPAUpdated", () => {
	it("renders updated message with name and status", () => {
		renderCAPAUpdated("Fix valve leak", "closed", log);
		const out = output();
		expect(out).toContain("Updated Fix valve leak");
		expect(out).toContain("closed");
	});
});
