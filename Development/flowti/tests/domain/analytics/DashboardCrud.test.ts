/**
 * Dashboard CRUD tests for AnalyticsService.
 *
 * Covers:
 * - Dashboard create, list, get, update, delete
 * - Tile add, remove, update within a dashboard
 * - Event emission for all operations
 * - Persistence round-trip through TypedStorage
 * - Edge cases (missing IDs, duplicate names)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnalyticsService } from "../../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState } from "../../../src/domain/analytics/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Test helpers ──────────────────────────────────────────

function createMockStorage(): ITypedStorage<AnalyticsState> {
	let data: AnalyticsState = {
		savedAnalyticsQueries: [],
		dashboards: [],
	};
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: AnalyticsState) => { data = state; }),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: AnalyticsState) => { data = state; return true; }),
	} as unknown as ITypedStorage<AnalyticsState>;
}

function createMockEventBus(): IEventBus & { _emitted: Array<{ type: string; payload: unknown }> } {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		_emitted: emitted,
	} as unknown as IEventBus & { _emitted: typeof emitted };
}

// ── Tests ─────────────────────────────────────────────────

describe("AnalyticsService — Dashboard CRUD", () => {
	let service: AnalyticsService;
	let storage: ITypedStorage<AnalyticsState>;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(async () => {
		storage = createMockStorage();
		eventBus = createMockEventBus();
		service = new AnalyticsService({ storage, eventBus });
		await service.load();
		// Clear the analytics.loaded event from setup
		eventBus._emitted.length = 0;
	});

	// ── Dashboard lifecycle ──────────────────────────────

	describe("createDashboard", () => {
		it("creates a dashboard with name and description", async () => {
			const db = await service.createDashboard("Sales Overview", "Monthly sales data");
			expect(db.name).toBe("Sales Overview");
			expect(db.description).toBe("Monthly sales data");
			expect(db.id).toMatch(/^aq_/);
			expect(db.tiles).toEqual([]);
			expect(db.createdAt).toBeGreaterThan(0);
			expect(db.updatedAt).toBe(db.createdAt);
		});

		it("creates a dashboard without description", async () => {
			const db = await service.createDashboard("Quick View");
			expect(db.name).toBe("Quick View");
			expect(db.description).toBeUndefined();
		});

		it("adds dashboard to state", async () => {
			await service.createDashboard("D1");
			await service.createDashboard("D2");
			expect(service.listDashboards()).toHaveLength(2);
		});

		it("emits analytics.dashboard.created event", async () => {
			const db = await service.createDashboard("Test");
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.created");
			expect((eventBus._emitted[0].payload as { dashboard: typeof db }).dashboard.id).toBe(db.id);
		});

		it("persists to storage", async () => {
			await service.createDashboard("Persisted");
			expect(storage.save).toHaveBeenCalled();
		});
	});

	describe("listDashboards", () => {
		it("returns empty array when no dashboards", () => {
			expect(service.listDashboards()).toEqual([]);
		});

		it("returns all created dashboards", async () => {
			await service.createDashboard("A");
			await service.createDashboard("B");
			await service.createDashboard("C");
			expect(service.listDashboards()).toHaveLength(3);
			expect(service.listDashboards().map((d) => d.name)).toEqual(["A", "B", "C"]);
		});
	});

	describe("getDashboard", () => {
		it("returns dashboard by ID", async () => {
			const db = await service.createDashboard("Target");
			const found = service.getDashboard(db.id);
			expect(found).toBeDefined();
			expect(found!.name).toBe("Target");
		});

		it("returns undefined for non-existent ID", () => {
			expect(service.getDashboard("nonexistent")).toBeUndefined();
		});
	});

	describe("updateDashboard", () => {
		it("updates name", async () => {
			const db = await service.createDashboard("Old Name");
			const updated = await service.updateDashboard(db.id, { name: "New Name" });
			expect(updated!.name).toBe("New Name");
		});

		it("updates description", async () => {
			const db = await service.createDashboard("DB", "Old desc");
			const updated = await service.updateDashboard(db.id, { description: "New desc" });
			expect(updated!.description).toBe("New desc");
		});

		it("updates both name and description", async () => {
			const db = await service.createDashboard("DB", "Desc");
			const updated = await service.updateDashboard(db.id, { name: "X", description: "Y" });
			expect(updated!.name).toBe("X");
			expect(updated!.description).toBe("Y");
		});

		it("updates updatedAt timestamp", async () => {
			const db = await service.createDashboard("DB");
			const originalUpdatedAt = db.updatedAt;
			// Small delay to ensure different timestamp
			await new Promise((r) => setTimeout(r, 5));
			const updated = await service.updateDashboard(db.id, { name: "Modified" });
			expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
		});

		it("emits analytics.dashboard.updated event", async () => {
			const db = await service.createDashboard("DB");
			eventBus._emitted.length = 0;
			await service.updateDashboard(db.id, { name: "Updated" });
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.updated");
		});

		it("returns undefined for non-existent ID", async () => {
			const result = await service.updateDashboard("nonexistent", { name: "X" });
			expect(result).toBeUndefined();
		});

		it("persists to storage", async () => {
			const db = await service.createDashboard("DB");
			const saveCalls = (storage.save as ReturnType<typeof vi.fn>).mock.calls.length;
			await service.updateDashboard(db.id, { name: "Updated" });
			expect((storage.save as ReturnType<typeof vi.fn>).mock.calls.length).toBe(saveCalls + 1);
		});
	});

	describe("deleteDashboard", () => {
		it("deletes an existing dashboard", async () => {
			const db = await service.createDashboard("ToDelete");
			const result = await service.deleteDashboard(db.id);
			expect(result).toBe(true);
			expect(service.listDashboards()).toHaveLength(0);
		});

		it("returns false for non-existent ID", async () => {
			const result = await service.deleteDashboard("nonexistent");
			expect(result).toBe(false);
		});

		it("emits analytics.dashboard.deleted event", async () => {
			const db = await service.createDashboard("ToDelete");
			eventBus._emitted.length = 0;
			await service.deleteDashboard(db.id);
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.deleted");
			const payload = eventBus._emitted[0].payload as { dashboardId: string; dashboardName: string };
			expect(payload.dashboardId).toBe(db.id);
			expect(payload.dashboardName).toBe("ToDelete");
		});

		it("leaves other dashboards intact", async () => {
			const db1 = await service.createDashboard("Keep");
			const db2 = await service.createDashboard("Delete");
			await service.deleteDashboard(db2.id);
			expect(service.listDashboards()).toHaveLength(1);
			expect(service.listDashboards()[0].id).toBe(db1.id);
		});

		it("persists to storage", async () => {
			const db = await service.createDashboard("ToDelete");
			const saveCalls = (storage.save as ReturnType<typeof vi.fn>).mock.calls.length;
			await service.deleteDashboard(db.id);
			expect((storage.save as ReturnType<typeof vi.fn>).mock.calls.length).toBe(saveCalls + 1);
		});
	});

	// ── Tile CRUD ────────────────────────────────────────

	describe("addTile", () => {
		it("adds a tile to a dashboard", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "query-1", "table");
			expect(tile).toBeDefined();
			expect(tile!.queryId).toBe("query-1");
			expect(tile!.displayMode).toBe("table");
			expect(tile!.id).toMatch(/^aq_/);
			expect(tile!.width).toBe(2);
			expect(tile!.height).toBe(1);
		});

		it("adds tile with optional title", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "stat-card", "Revenue");
			expect(tile!.title).toBe("Revenue");
		});

		it("auto-positions tiles in rows", async () => {
			const db = await service.createDashboard("DB");
			const tile1 = await service.addTile(db.id, "q1", "table");
			const tile2 = await service.addTile(db.id, "q2", "table");
			expect(tile1!.row).toBe(0);
			expect(tile2!.row).toBe(1); // row 0 + height 1
		});

		it("emits analytics.dashboard.tile.added event", async () => {
			const db = await service.createDashboard("DB");
			eventBus._emitted.length = 0;
			const tile = await service.addTile(db.id, "q1", "table");
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.tile.added");
			const payload = eventBus._emitted[0].payload as { dashboardId: string; tile: typeof tile };
			expect(payload.dashboardId).toBe(db.id);
			expect(payload.tile!.id).toBe(tile!.id);
		});

		it("returns undefined for non-existent dashboard", async () => {
			const result = await service.addTile("nonexistent", "q1", "table");
			expect(result).toBeUndefined();
		});

		it("updates dashboard updatedAt", async () => {
			const db = await service.createDashboard("DB");
			const originalUpdatedAt = db.updatedAt;
			await new Promise((r) => setTimeout(r, 5));
			await service.addTile(db.id, "q1", "table");
			const updated = service.getDashboard(db.id);
			expect(updated!.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
		});
	});

	describe("removeTile", () => {
		it("removes a tile from a dashboard", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const result = await service.removeTile(db.id, tile!.id);
			expect(result).toBe(true);
			expect(service.getDashboard(db.id)!.tiles).toHaveLength(0);
		});

		it("returns false for non-existent tile", async () => {
			const db = await service.createDashboard("DB");
			const result = await service.removeTile(db.id, "nonexistent");
			expect(result).toBe(false);
		});

		it("returns false for non-existent dashboard", async () => {
			const result = await service.removeTile("nonexistent", "tile-1");
			expect(result).toBe(false);
		});

		it("emits analytics.dashboard.tile.removed event", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			eventBus._emitted.length = 0;
			await service.removeTile(db.id, tile!.id);
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.tile.removed");
			const payload = eventBus._emitted[0].payload as { dashboardId: string; tileId: string };
			expect(payload.dashboardId).toBe(db.id);
			expect(payload.tileId).toBe(tile!.id);
		});

		it("leaves other tiles intact", async () => {
			const db = await service.createDashboard("DB");
			const t1 = await service.addTile(db.id, "q1", "table");
			await service.addTile(db.id, "q2", "stat-card");
			await service.removeTile(db.id, t1!.id);
			const remaining = service.getDashboard(db.id)!.tiles;
			expect(remaining).toHaveLength(1);
			expect(remaining[0].queryId).toBe("q2");
		});
	});

	describe("updateTile", () => {
		it("updates tile displayMode", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const updated = await service.updateTile(db.id, tile!.id, { displayMode: "stat-card" });
			expect(updated!.displayMode).toBe("stat-card");
		});

		it("updates tile title", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const updated = await service.updateTile(db.id, tile!.id, { title: "Custom Title" });
			expect(updated!.title).toBe("Custom Title");
		});

		it("updates tile position", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const updated = await service.updateTile(db.id, tile!.id, { row: 3, col: 1, width: 4, height: 2 });
			expect(updated!.row).toBe(3);
			expect(updated!.col).toBe(1);
			expect(updated!.width).toBe(4);
			expect(updated!.height).toBe(2);
		});

		it("updates tile queryId", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const updated = await service.updateTile(db.id, tile!.id, { queryId: "q2" });
			expect(updated!.queryId).toBe("q2");
		});

		it("emits analytics.dashboard.tile.updated event", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			eventBus._emitted.length = 0;
			await service.updateTile(db.id, tile!.id, { displayMode: "stat-card" });
			expect(eventBus._emitted).toHaveLength(1);
			expect(eventBus._emitted[0].type).toBe("analytics.dashboard.tile.updated");
		});

		it("returns undefined for non-existent dashboard", async () => {
			const result = await service.updateTile("nonexistent", "tile-1", { title: "X" });
			expect(result).toBeUndefined();
		});

		it("returns undefined for non-existent tile", async () => {
			const db = await service.createDashboard("DB");
			const result = await service.updateTile(db.id, "nonexistent", { title: "X" });
			expect(result).toBeUndefined();
		});

		it("updates tile measurementId", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			const updated = await service.updateTile(db.id, tile!.id, { measurementId: "am_123" });
			expect(updated!.measurementId).toBe("am_123");
		});

		it("can change tile measurementId to another value", async () => {
			const db = await service.createDashboard("DB");
			const tile = await service.addTile(db.id, "q1", "table");
			await service.updateTile(db.id, tile!.id, { measurementId: "am_123" });
			const changed = await service.updateTile(db.id, tile!.id, { measurementId: "am_456" });
			expect(changed!.measurementId).toBe("am_456");
		});
	});

	// ── Persistence round-trip ───────────────────────────

	describe("persistence", () => {
		it("round-trips dashboards through storage", async () => {
			const mockStorage = createMockStorage();
			const svc1 = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc1.load();

			const db = await svc1.createDashboard("Persistent", "Survives reload");
			await svc1.addTile(db.id, "q1", "table", "Revenue");
			await svc1.addTile(db.id, "q2", "stat-card");

			// Create new instance with same storage
			const svc2 = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc2.load();

			const dashboards = svc2.listDashboards();
			expect(dashboards).toHaveLength(1);
			expect(dashboards[0].name).toBe("Persistent");
			expect(dashboards[0].description).toBe("Survives reload");
			expect(dashboards[0].tiles).toHaveLength(2);
			expect(dashboards[0].tiles[0].title).toBe("Revenue");
			expect(dashboards[0].tiles[1].displayMode).toBe("stat-card");
		});

		it("persists dashboard deletion across instances", async () => {
			const mockStorage = createMockStorage();
			const svc1 = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc1.load();

			const db = await svc1.createDashboard("ToDelete");
			await svc1.deleteDashboard(db.id);

			const svc2 = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc2.load();
			expect(svc2.listDashboards()).toHaveLength(0);
		});

		it("preserves queries alongside dashboards", async () => {
			const mockStorage = createMockStorage();
			const svc = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc.load();

			await svc.saveQuery("Test Query", [{ alias: "s", csvPath: "data.csv" }], {
				joins: [],
				columnTypeHints: [],
				dimensions: [{ column: "Cat" }],
				measures: [{ column: "Val", function: "SUM" }],
			});
			await svc.createDashboard("My Dashboard");

			const svc2 = new AnalyticsService({ storage: mockStorage, eventBus });
			await svc2.load();
			expect(svc2.listQueries()).toHaveLength(1);
			expect(svc2.listDashboards()).toHaveLength(1);
		});
	});

	// ── Edge cases ───────────────────────────────────────

	describe("edge cases", () => {
		it("allows dashboards with duplicate names", async () => {
			await service.createDashboard("Same Name");
			await service.createDashboard("Same Name");
			expect(service.listDashboards()).toHaveLength(2);
		});

		it("handles empty dashboard name", async () => {
			const db = await service.createDashboard("");
			expect(db.name).toBe("");
		});

		it("deleting dashboard with tiles removes all tiles", async () => {
			const db = await service.createDashboard("DB");
			await service.addTile(db.id, "q1", "table");
			await service.addTile(db.id, "q2", "stat-card");
			await service.deleteDashboard(db.id);
			expect(service.listDashboards()).toHaveLength(0);
		});

		it("addTile to dashboard with varying tile heights calculates correct row", async () => {
			const db = await service.createDashboard("DB");
			// First tile at row 0, height 1
			const t1 = await service.addTile(db.id, "q1", "table");
			// Update first tile to height 3
			await service.updateTile(db.id, t1!.id, { height: 3 });
			// Next tile should be at row 3 (0 + 3)
			const t2 = await service.addTile(db.id, "q2", "table");
			expect(t2!.row).toBe(3);
		});
	});

	// ── Filter presets ──────────────────────────────────────

	describe("filter presets", () => {
		it("saves a filter preset to a dashboard", async () => {
			const db = await service.createDashboard("DB");
			const result = await service.saveFilterPreset(db.id, "My Preset", [
				{ column: "country", values: ["NL", "DE"] },
			]);

			expect(result).toBeDefined();
			expect(result!.name).toBe("My Preset");

			const updated = service.getDashboard(db.id)!;
			expect(updated.savedFilterPresets).toHaveLength(1);
			expect(updated.savedFilterPresets![0].filters[0].column).toBe("country");
		});

		it("loads preset filters from dashboard", async () => {
			const db = await service.createDashboard("DB");
			await service.saveFilterPreset(db.id, "P1", [{ column: "a", values: ["x"] }]);
			await service.saveFilterPreset(db.id, "P2", [{ column: "b", values: ["y"] }]);

			const updated = service.getDashboard(db.id)!;
			expect(updated.savedFilterPresets).toHaveLength(2);
			expect(updated.savedFilterPresets![1].name).toBe("P2");
		});

		it("deletes a filter preset", async () => {
			const db = await service.createDashboard("DB");
			const result = await service.saveFilterPreset(db.id, "P1", [{ column: "a", values: ["x"] }]);

			expect(await service.deleteFilterPreset(db.id, result!.id)).toBe(true);

			const updated = service.getDashboard(db.id)!;
			expect(updated.savedFilterPresets).toHaveLength(0);
		});

		it("returns false when deleting preset from nonexistent dashboard", async () => {
			expect(await service.deleteFilterPreset("nope", "nope")).toBe(false);
		});
	});
});
