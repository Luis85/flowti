import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "",
}));

import { log } from "../../../src/infrastructure/logger.js";
import { renderResourceList, renderFinancialSummary, renderResourceAdded } from "../../../src/ui/displays/resources-display.js";
import type { ResourceSummary, FinancialSummary } from "../../../src/domain/resources/resource-types.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => { mockLog.mockClear(); });

// ── renderResourceList ──────────────────────────────────────────────

describe("renderResourceList", () => {
	it("renders empty message when no resources", () => {
		renderResourceList([]);
		expect(output()).toContain("No resources defined yet");
	});

	it("renders budget resource with percentage", () => {
		const resources: ResourceSummary[] = [
			{ name: "Dev Budget", resourceType: "budget", amount: 10000, consumed: 7500, price: 0 },
		];
		renderResourceList(resources);
		const out = output();
		expect(out).toContain("Resources (1)");
		expect(out).toContain("Dev Budget");
		expect(out).toContain("[budget]");
		expect(out).toContain("7500/10000");
		expect(out).toContain("75%");
	});

	it("renders non-budget resource with price", () => {
		const resources: ResourceSummary[] = [
			{ name: "Cloud Servers", resourceType: "compute", amount: 20, consumed: 5, price: 100 },
		];
		renderResourceList(resources);
		const out = output();
		expect(out).toContain("Cloud Servers");
		expect(out).toContain("[compute]");
		expect(out).toContain("5/20");
		expect(out).toContain("@ 100/u");
	});

	it("renders multiple resources", () => {
		const resources: ResourceSummary[] = [
			{ name: "Budget A", resourceType: "budget", amount: 5000, consumed: 4500, price: 0 },
			{ name: "Licenses", resourceType: "license", amount: 10, consumed: 3, price: 50 },
		];
		renderResourceList(resources);
		const out = output();
		expect(out).toContain("Resources (2)");
		expect(out).toContain("Budget A");
		expect(out).toContain("Licenses");
	});

	it("handles zero-amount budget without division error", () => {
		const resources: ResourceSummary[] = [
			{ name: "Empty Budget", resourceType: "budget", amount: 0, consumed: 0, price: 0 },
		];
		renderResourceList(resources);
		const out = output();
		expect(out).toContain("0%");
	});
});

// ── renderFinancialSummary ──────────────────────────────────────────

describe("renderFinancialSummary", () => {
	it("renders financial summary fields", () => {
		const summary: FinancialSummary = {
			totalBudget: 50000,
			totalConsumed: 30000,
			totalRemaining: 20000,
			burnRate: 0.6,
			byType: {
				development: { budget: 30000, consumed: 20000 },
				infrastructure: { budget: 20000, consumed: 10000 },
			},
		};
		renderFinancialSummary(summary);
		const out = output();
		expect(out).toContain("Financial Summary");
		expect(out).toContain("50000.00");
		expect(out).toContain("30000.00");
		expect(out).toContain("20000.00");
		expect(out).toContain("60.0%");
		expect(out).toContain("development:");
		expect(out).toContain("infrastructure:");
	});

	it("skips zero-value type breakdowns", () => {
		const summary: FinancialSummary = {
			totalBudget: 1000,
			totalConsumed: 500,
			totalRemaining: 500,
			burnRate: 0.5,
			byType: {
				active: { budget: 1000, consumed: 500 },
				empty: { budget: 0, consumed: 0 },
			},
		};
		renderFinancialSummary(summary);
		const out = output();
		expect(out).toContain("active:");
		expect(out).not.toContain("empty:");
	});
});

// ── renderResourceAdded ─────────────────────────────────────────────

describe("renderResourceAdded", () => {
	it("renders created message with path", () => {
		renderResourceAdded(".flowti/resources/budget.md");
		expect(output()).toContain("Created: .flowti/resources/budget.md");
	});
});
