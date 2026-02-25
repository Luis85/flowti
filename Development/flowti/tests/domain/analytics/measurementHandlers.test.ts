import { describe, expect, it, vi, beforeEach } from "vitest";
import { AnalyticsService } from "../../../src/domain/analytics/AnalyticsService";
import type { AnalyticsState, Measurement } from "../../../src/domain/analytics/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// ── Helpers ────────────────────────────────────────────────

function createMockStorage(): ITypedStorage<AnalyticsState> {
	let data: AnalyticsState = { savedAnalyticsQueries: [], dashboards: [] };
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
		emit: vi.fn(async (type: string, payload: unknown) => { emitted.push({ type, payload }); }),
		on: vi.fn(() => () => {}),
		_emitted: emitted,
	} as unknown as IEventBus & { _emitted: typeof emitted };
}

// ── Tests ──────────────────────────────────────────────────

describe("Measurement CRUD", () => {
	let service: AnalyticsService;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(async () => {
		const storage = createMockStorage();
		eventBus = createMockEventBus();
		service = new AnalyticsService({ storage, eventBus });
		await service.load();
	});

	it("creates a measurement with correct fields", async () => {
		const m = await service.createMeasurement("Revenue", "q1", "single", "total", undefined, "Total revenue");
		expect(m.id).toMatch(/^am_/);
		expect(m.name).toBe("Revenue");
		expect(m.queryId).toBe("q1");
		expect(m.type).toBe("single");
		expect(m.measureColumn).toBe("total");
		expect(m.description).toBe("Total revenue");
		expect(m.createdAt).toBeGreaterThan(0);
		expect(m.updatedAt).toBe(m.createdAt);
	});

	it("emits measurement.created event", async () => {
		await service.createMeasurement("Rev", "q1", "single");
		const evt = eventBus._emitted.find((e) => e.type === "analytics.measurement.created");
		expect(evt).toBeDefined();
		expect((evt!.payload as { measurement: Measurement }).measurement.name).toBe("Rev");
	});

	it("lists measurements", async () => {
		await service.createMeasurement("A", "q1", "single");
		await service.createMeasurement("B", "q2", "series");
		expect(service.listMeasurements()).toHaveLength(2);
	});

	it("gets measurement by ID", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		expect(service.getMeasurement(m.id)).toBeDefined();
		expect(service.getMeasurement("nonexistent")).toBeUndefined();
	});

	it("updates measurement fields", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		const updated = await service.updateMeasurement(m.id, { name: "Total Revenue", description: "Updated" });
		expect(updated?.name).toBe("Total Revenue");
		expect(updated?.description).toBe("Updated");
		expect(updated!.updatedAt).toBeGreaterThanOrEqual(m.updatedAt);
	});

	it("emits measurement.updated event", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		await service.updateMeasurement(m.id, { name: "New" });
		expect(eventBus._emitted.some((e) => e.type === "analytics.measurement.updated")).toBe(true);
	});

	it("deletes a measurement", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		expect(await service.deleteMeasurement(m.id)).toBe(true);
		expect(service.listMeasurements()).toHaveLength(0);
	});

	it("emits measurement.deleted event", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		await service.deleteMeasurement(m.id);
		const evt = eventBus._emitted.find((e) => e.type === "analytics.measurement.deleted");
		expect(evt).toBeDefined();
	});

	it("returns false when deleting nonexistent measurement", async () => {
		expect(await service.deleteMeasurement("nope")).toBe(false);
	});

	it("toggles favorite", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		expect(m.isFavorite).toBeUndefined();

		const toggled = await service.toggleMeasurementFavorite(m.id);
		expect(toggled?.isFavorite).toBe(true);

		const unToggled = await service.toggleMeasurementFavorite(m.id);
		expect(unToggled?.isFavorite).toBe(false);
	});

	it("emits measurement.favorited event", async () => {
		const m = await service.createMeasurement("Rev", "q1", "single");
		await service.toggleMeasurementFavorite(m.id);
		const evt = eventBus._emitted.find((e) => e.type === "analytics.measurement.favorited");
		expect(evt).toBeDefined();
		expect((evt!.payload as { isFavorite: boolean }).isFavorite).toBe(true);
	});

	it("analytics.loaded includes measurementCount", async () => {
		const evt = eventBus._emitted.find((e) => e.type === "analytics.loaded");
		expect((evt!.payload as { measurementCount: number }).measurementCount).toBe(0);
	});

	// ── Cascade / Orphan Protection ──────────────────────

	it("deleting measurement clears measurementId from tiles", async () => {
		const dashboard = await service.createDashboard("Dash");
		const tile = await service.addTile(dashboard.id, "q1", "stat-card");
		const m = await service.createMeasurement("Rev", "q1", "single", "total");
		await service.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

		await service.deleteMeasurement(m.id);

		const updated = service.getDashboard(dashboard.id)!;
		expect(updated.tiles[0].measurementId).toBeUndefined();
	});

	it("tiles retain queryId after measurement cascade delete", async () => {
		const dashboard = await service.createDashboard("Dash");
		const tile = await service.addTile(dashboard.id, "q1", "stat-card");
		const m = await service.createMeasurement("Rev", "q1", "single", "total");
		await service.updateTile(dashboard.id, tile!.id, { measurementId: m.id });

		await service.deleteMeasurement(m.id);

		const updated = service.getDashboard(dashboard.id)!;
		expect(updated.tiles[0].queryId).toBe("q1");
	});

	it("no-op when no tiles reference deleted measurement", async () => {
		const dashboard = await service.createDashboard("Dash");
		await service.addTile(dashboard.id, "q1", "stat-card");
		const m = await service.createMeasurement("Rev", "q1", "single", "total");

		// Delete measurement that is NOT referenced by any tile
		await service.deleteMeasurement(m.id);

		const updated = service.getDashboard(dashboard.id)!;
		expect(updated.tiles[0].measurementId).toBeUndefined();
		expect(updated.tiles[0].queryId).toBe("q1");
	});
});
