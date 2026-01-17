import { describe, it, expect, beforeEach, vi } from "vitest";
import { StatsService, createStatsService } from "../../src/services/StatsService";
import { createMockStatsService } from "../mocks/factories";
import type { IStatusBar } from "../../src/interfaces/IPluginContext";

describe("StatsService", () => {
	let service: StatsService;
	let mockStatusBar: IStatusBar;

	beforeEach(() => {
		mockStatusBar = {
			onStatsChanged: vi.fn(),
		};
		service = new StatsService({ statusbar: mockStatusBar });
	});

	describe("initialization", () => {
		it("should start with zero stats", () => {
			const stats = service.stats;

			expect(stats.filesProcessed).toBe(0);
			expect(stats.filesSkipped).toBe(0);
			expect(stats.errors).toBe(0);
			expect(stats.lastProcessed).toBeNull();
			expect(stats.perMappingStats).toEqual({});
		});

		it("should initialize mapping stats", () => {
			service.initializeMappingStats(["mapping-1", "mapping-2"]);

			expect(service.stats.perMappingStats["mapping-1"]).toEqual({
				processed: 0,
				skipped: 0,
				errors: 0,
			});
			expect(service.stats.perMappingStats["mapping-2"]).toEqual({
				processed: 0,
				skipped: 0,
				errors: 0,
			});
		});

		it("should not overwrite existing mapping stats", () => {
			service.bumpProcessed("mapping-1");
			service.initializeMappingStats(["mapping-1", "mapping-2"]);

			expect(service.stats.perMappingStats["mapping-1"].processed).toBe(1);
			expect(service.stats.perMappingStats["mapping-2"].processed).toBe(0);
		});
	});

	describe("bumpProcessed", () => {
		it("should increment processed count", () => {
			service.bumpProcessed("mapping-1");

			expect(service.stats.filesProcessed).toBe(1);
			expect(service.stats.perMappingStats["mapping-1"].processed).toBe(1);
		});

		it("should update lastProcessed with file path", () => {
			service.bumpProcessed("mapping-1", "/path/to/file.md");

			expect(service.stats.lastProcessed).toContain("file.md");
		});

		it("should update lastProcessed with timestamp when no path provided", () => {
			service.bumpProcessed("mapping-1");

			expect(service.stats.lastProcessed).toBeTruthy();
		});

		it("should notify statusbar", () => {
			service.bumpProcessed("mapping-1");

			expect(mockStatusBar.onStatsChanged).toHaveBeenCalledTimes(1);
		});

		it("should auto-create mapping stats if not exists", () => {
			service.bumpProcessed("new-mapping");

			expect(service.stats.perMappingStats["new-mapping"]).toBeDefined();
			expect(service.stats.perMappingStats["new-mapping"].processed).toBe(1);
		});
	});

	describe("bumpSkipped", () => {
		it("should increment skipped count", () => {
			service.bumpSkipped("mapping-1");

			expect(service.stats.filesSkipped).toBe(1);
			expect(service.stats.perMappingStats["mapping-1"].skipped).toBe(1);
		});

		it("should notify statusbar", () => {
			service.bumpSkipped("mapping-1");

			expect(mockStatusBar.onStatsChanged).toHaveBeenCalledTimes(1);
		});
	});

	describe("bumpError", () => {
		it("should increment error count", () => {
			service.bumpError("mapping-1");

			expect(service.stats.errors).toBe(1);
			expect(service.stats.perMappingStats["mapping-1"].errors).toBe(1);
		});

		it("should notify statusbar", () => {
			service.bumpError("mapping-1");

			expect(mockStatusBar.onStatsChanged).toHaveBeenCalledTimes(1);
		});
	});

	describe("applyReconcileStats", () => {
		it("should apply bulk stats", () => {
			service.applyReconcileStats("mapping-1", {
				processed: 10,
				skipped: 5,
				errors: 2,
			});

			expect(service.stats.filesProcessed).toBe(10);
			expect(service.stats.filesSkipped).toBe(5);
			expect(service.stats.errors).toBe(2);
			expect(service.stats.perMappingStats["mapping-1"]).toEqual({
				processed: 10,
				skipped: 5,
				errors: 2,
			});
		});

		it("should accumulate stats from multiple reconciles", () => {
			service.applyReconcileStats("mapping-1", {
				processed: 10,
				skipped: 5,
				errors: 2,
			});
			service.applyReconcileStats("mapping-1", {
				processed: 5,
				skipped: 3,
				errors: 1,
			});

			expect(service.stats.filesProcessed).toBe(15);
			expect(service.stats.filesSkipped).toBe(8);
			expect(service.stats.errors).toBe(3);
		});

		it("should notify statusbar", () => {
			service.applyReconcileStats("mapping-1", {
				processed: 10,
				skipped: 5,
				errors: 2,
			});

			expect(mockStatusBar.onStatsChanged).toHaveBeenCalledTimes(1);
		});
	});

	describe("reset", () => {
		it("should reset all stats to zero", () => {
			service.bumpProcessed("mapping-1");
			service.bumpSkipped("mapping-1");
			service.bumpError("mapping-1");

			service.reset();

			expect(service.stats.filesProcessed).toBe(0);
			expect(service.stats.filesSkipped).toBe(0);
			expect(service.stats.errors).toBe(0);
			expect(service.stats.lastProcessed).toBeNull();
			expect(service.stats.perMappingStats).toEqual({});
		});

		it("should notify statusbar", () => {
			service.reset();

			expect(mockStatusBar.onStatsChanged).toHaveBeenCalled();
		});
	});

	describe("resetMapping", () => {
		it("should reset stats for a specific mapping", () => {
			service.bumpProcessed("mapping-1");
			service.bumpProcessed("mapping-2");

			service.resetMapping("mapping-1");

			expect(service.stats.perMappingStats["mapping-1"]).toEqual({
				processed: 0,
				skipped: 0,
				errors: 0,
			});
			expect(service.stats.perMappingStats["mapping-2"].processed).toBe(1);
		});

		it("should adjust global stats when resetting mapping", () => {
			service.bumpProcessed("mapping-1");
			service.bumpSkipped("mapping-1");
			service.bumpError("mapping-1");

			service.resetMapping("mapping-1");

			expect(service.stats.filesProcessed).toBe(0);
			expect(service.stats.filesSkipped).toBe(0);
			expect(service.stats.errors).toBe(0);
		});

		it("should do nothing for non-existent mapping", () => {
			service.bumpProcessed("mapping-1");

			service.resetMapping("non-existent");

			expect(service.stats.filesProcessed).toBe(1);
		});
	});

	describe("removeMapping", () => {
		it("should remove mapping stats entirely", () => {
			service.bumpProcessed("mapping-1");
			service.bumpProcessed("mapping-2");

			service.removeMapping("mapping-1");

			expect(service.stats.perMappingStats["mapping-1"]).toBeUndefined();
			expect(service.stats.perMappingStats["mapping-2"]).toBeDefined();
		});

		it("should adjust global stats when removing mapping", () => {
			service.bumpProcessed("mapping-1");
			service.bumpProcessed("mapping-1");

			service.removeMapping("mapping-1");

			expect(service.stats.filesProcessed).toBe(0);
		});

		it("should do nothing for non-existent mapping", () => {
			const initialStats = { ...service.stats };

			service.removeMapping("non-existent");

			expect(service.stats.filesProcessed).toBe(initialStats.filesProcessed);
		});
	});

	describe("setStatusBar", () => {
		it("should allow late binding of statusbar", () => {
			const service = new StatsService(); // No statusbar
			const newStatusBar: IStatusBar = {
				onStatsChanged: vi.fn(),
			};

			service.setStatusBar(newStatusBar);
			service.bumpProcessed("mapping-1");

			expect(newStatusBar.onStatsChanged).toHaveBeenCalled();
		});
	});
});

describe("createStatsService", () => {
	it("should create a new StatsService instance", () => {
		const service = createStatsService();

		expect(service).toBeInstanceOf(StatsService);
		expect(service.stats.filesProcessed).toBe(0);
	});

	it("should accept configuration", () => {
		const mockStatusBar: IStatusBar = {
			onStatsChanged: vi.fn(),
		};
		const service = createStatsService({ statusbar: mockStatusBar });

		service.bumpProcessed("mapping-1");

		expect(mockStatusBar.onStatsChanged).toHaveBeenCalled();
	});
});

describe("createMockStatsService", () => {
	it("should track method calls", () => {
		const mockService = createMockStatsService();

		mockService.bumpProcessed("mapping-1", "/path/file.md");
		mockService.bumpSkipped("mapping-2");
		mockService.bumpError("mapping-3");

		const history = mockService.getCallHistory();

		expect(history).toHaveLength(3);
		expect(history[0]).toEqual({
			method: "bumpProcessed",
			args: ["mapping-1", "/path/file.md"],
		});
		expect(history[1]).toEqual({
			method: "bumpSkipped",
			args: ["mapping-2"],
		});
		expect(history[2]).toEqual({
			method: "bumpError",
			args: ["mapping-3"],
		});
	});

	it("should still update stats", () => {
		const mockService = createMockStatsService();

		mockService.bumpProcessed("mapping-1");

		expect(mockService.stats.filesProcessed).toBe(1);
	});

	it("should allow clearing call history", () => {
		const mockService = createMockStatsService();

		mockService.bumpProcessed("mapping-1");
		mockService.clearCallHistory();

		expect(mockService.getCallHistory()).toHaveLength(0);
	});

	it("should track applyReconcileStats calls", () => {
		const mockService = createMockStatsService();
		const stats = { processed: 10, skipped: 5, errors: 2 };

		mockService.applyReconcileStats("mapping-1", stats);

		const history = mockService.getCallHistory();
		expect(history[0]).toEqual({
			method: "applyReconcileStats",
			args: ["mapping-1", stats],
		});
	});
});
