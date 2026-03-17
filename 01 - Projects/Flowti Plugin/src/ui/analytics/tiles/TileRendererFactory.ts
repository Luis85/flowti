/**
 * TileRendererFactory — maps TileDisplayMode to the appropriate sub-renderer.
 *
 * Created as part of DashboardTileRenderer extraction (PBI-ANA-141, Cycle 44).
 */

import type { TileDisplayMode } from "../../../domain/analytics/types";
import { TableTileRenderer } from "./TableTileRenderer";
import { StatCardTileRenderer } from "./StatCardTileRenderer";
import { ChartTileRenderer, PieChartTileRenderer } from "./ChartTileRenderer";
import type { TileRenderer } from "./types";

const renderers: Record<TileDisplayMode, () => TileRenderer> = {
	"table": () => new TableTileRenderer(),
	"stat-card": () => new StatCardTileRenderer(),
	"line-chart": () => new ChartTileRenderer(),
	"bar-chart": () => new ChartTileRenderer(),
	"area-chart": () => new ChartTileRenderer(),
	"pie-chart": () => new PieChartTileRenderer(),
};

/** Create a tile sub-renderer for the given display mode. Returns null for unknown modes. */
export function createTileRenderer(mode: TileDisplayMode): TileRenderer | null {
	const factory = renderers[mode];
	return factory ? factory() : null;
}
