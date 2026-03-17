import { describe, it, expect, vi } from "vitest";
import { TestManagementHubProvider } from "../../../src/domain/hub/TestManagementHubProvider";
import { VIEW_TYPE_TEST_MANAGEMENT_HUB } from "../../../src/domain/hub/types";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { JourneyRegistryEntry, JourneyRunSummary } from "../../../src/domain/testManagement/types";

function makeJourney(name: string, lastRun?: Partial<JourneyRunSummary>): JourneyRegistryEntry {
	return {
		name,
		type: "functional",
		actors: [],
		services: [],
		stepCount: 3,
		tools: [],
		jsonPath: `${name}.json`,
		complianceTags: [],
		runHistory: lastRun ? [{ date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, ...lastRun }] : [],
		lastRunResult: lastRun ? { date: "2026-03-05", totalSteps: 3, passed: 3, failed: 0, skipped: 0, durationMs: 1000, ...lastRun } : undefined,
	};
}

function createMockService(journeys: JourneyRegistryEntry[] = []): TestManagementService {
	return {
		getJourneys: vi.fn(() => journeys),
		getPyramid: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" }, flow: { count: 0, passRate: 0, trend: "stable" }, unit: { count: 0, passRate: 0, trend: "stable" } })),
		getCompliance: vi.fn(() => []),
	} as unknown as TestManagementService;
}

describe("TestManagementHubProvider", () => {
	describe("identity", () => {
		it("returns correct hub ID", () => {
			const provider = new TestManagementHubProvider(createMockService());
			expect(provider.getHubId()).toBe("test-management");
		});

		it("returns correct view type", () => {
			const provider = new TestManagementHubProvider(createMockService());
			expect(provider.getViewType()).toBe(VIEW_TYPE_TEST_MANAGEMENT_HUB);
		});

		it("returns correct display name", () => {
			const provider = new TestManagementHubProvider(createMockService());
			expect(provider.getDisplayName()).toBe("Test Management");
		});

		it("returns correct icon", () => {
			const provider = new TestManagementHubProvider(createMockService());
			expect(provider.getIcon()).toBe("shield-check");
		});
	});

	describe("getSummary", () => {
		it("returns journey count in stats", () => {
			const journeys = [makeJourney("A"), makeJourney("B")];
			const provider = new TestManagementHubProvider(createMockService(journeys));
			const summary = provider.getSummary();

			expect(summary.stats[0].value).toBe("2");
			expect(summary.stats[0].label).toBe("Journeys");
		});

		it("returns passing count in stats", () => {
			const journeys = [
				makeJourney("A", { passed: 3, failed: 0 }),
				makeJourney("B", { passed: 2, failed: 1 }),
			];
			const provider = new TestManagementHubProvider(createMockService(journeys));
			const summary = provider.getSummary();

			expect(summary.stats[1].value).toBe("1");
			expect(summary.stats[1].label).toBe("Passing");
		});

		it("returns healthy when no failing journeys", () => {
			const journeys = [makeJourney("A", { passed: 3, failed: 0 })];
			const provider = new TestManagementHubProvider(createMockService(journeys));
			expect(provider.getSummary().healthLevel).toBe("healthy");
		});

		it("returns warning when failing journeys exist", () => {
			const journeys = [makeJourney("A", { passed: 2, failed: 1 })];
			const provider = new TestManagementHubProvider(createMockService(journeys));
			expect(provider.getSummary().healthLevel).toBe("warning");
		});

		it("counts failing journeys as action items", () => {
			const journeys = [
				makeJourney("A", { passed: 2, failed: 1 }),
				makeJourney("B", { passed: 3, failed: 0 }),
			];
			const provider = new TestManagementHubProvider(createMockService(journeys));
			expect(provider.getSummary().actionItemCount).toBe(1);
		});

		it("handles empty journey list", () => {
			const provider = new TestManagementHubProvider(createMockService([]));
			const summary = provider.getSummary();
			expect(summary.stats[0].value).toBe("0");
			expect(summary.healthLevel).toBe("healthy");
			expect(summary.actionItemCount).toBe(0);
		});
	});
});
