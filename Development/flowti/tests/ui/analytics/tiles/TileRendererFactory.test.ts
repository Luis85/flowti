import { describe, it, expect, beforeEach } from "vitest";
import "../../../mocks/obsidian-stub";
import { createTileRenderer } from "../../../../src/ui/analytics/tiles/TileRendererFactory";
import { TableTileRenderer } from "../../../../src/ui/analytics/tiles/TableTileRenderer";
import { StatCardTileRenderer } from "../../../../src/ui/analytics/tiles/StatCardTileRenderer";
import { ChartTileRenderer, PieChartTileRenderer } from "../../../../src/ui/analytics/tiles/ChartTileRenderer";
import type { TileDisplayMode } from "../../../../src/domain/analytics/types";

describe("TileRendererFactory", () => {
	it("returns TableTileRenderer for table mode", () => {
		const renderer = createTileRenderer("table");
		expect(renderer).toBeInstanceOf(TableTileRenderer);
	});

	it("returns StatCardTileRenderer for stat-card mode", () => {
		const renderer = createTileRenderer("stat-card");
		expect(renderer).toBeInstanceOf(StatCardTileRenderer);
	});

	it("returns ChartTileRenderer for line-chart mode", () => {
		const renderer = createTileRenderer("line-chart");
		expect(renderer).toBeInstanceOf(ChartTileRenderer);
	});

	it("returns ChartTileRenderer for bar-chart mode", () => {
		const renderer = createTileRenderer("bar-chart");
		expect(renderer).toBeInstanceOf(ChartTileRenderer);
	});

	it("returns ChartTileRenderer for area-chart mode", () => {
		const renderer = createTileRenderer("area-chart");
		expect(renderer).toBeInstanceOf(ChartTileRenderer);
	});

	it("returns PieChartTileRenderer for pie-chart mode", () => {
		const renderer = createTileRenderer("pie-chart");
		expect(renderer).toBeInstanceOf(PieChartTileRenderer);
	});

	it("returns null for unknown display mode", () => {
		const renderer = createTileRenderer("unknown-mode" as TileDisplayMode);
		expect(renderer).toBeNull();
	});

	it("creates fresh instances each time", () => {
		const a = createTileRenderer("table");
		const b = createTileRenderer("table");
		expect(a).not.toBe(b);
	});
});
