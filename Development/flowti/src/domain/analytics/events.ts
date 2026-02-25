/**
 * Event definitions for the Analytics domain.
 *
 * 25 events covering analytics queries, dashboards, templates, and measurements:
 * - Lifecycle: loaded
 * - Query execution: started / completed / failed
 * - Query persistence: query.saved / query.deleted / query.renamed / query.duplicated
 * - Query favorites: query.favorited
 * - Dashboard CRUD: dashboard.created / updated / deleted
 * - Dashboard favorites: dashboard.favorited / dashboard.defaultChanged
 * - Tile CRUD: dashboard.tile.added / removed / updated / reordered
 * - Dashboard refresh: dashboard.refreshed
 * - Templates: template.saved / template.used
 */

import type { AnalyticsResult, Dashboard, DashboardTile, Measurement } from "./types";

export interface AnalyticsEventMap {
	/** Analytics domain loaded — emitted after state is restored from storage */
	"analytics.loaded": {
		queryCount: number;
		dashboardCount: number;
		measurementCount: number;
	};

	/** Analytics query execution started */
	"analytics.query.started": {
		queryName?: string;
		sourceCount: number;
		dimensionCount: number;
		measureCount: number;
	};

	/** Analytics query completed successfully */
	"analytics.query.completed": {
		queryName?: string;
		rowCount: number;
		groupCount: number;
		durationMs: number;
		result: AnalyticsResult;
	};

	/** Analytics query failed */
	"analytics.query.failed": {
		queryName?: string;
		error: string;
	};

	/** Analytics query saved to persistence */
	"analytics.query.saved": {
		queryId: string;
		queryName: string;
	};

	/** Saved analytics query removed */
	"analytics.query.deleted": {
		queryId: string;
		queryName: string;
	};

	/** A saved query's favorite status was toggled */
	"analytics.query.favorited": {
		queryId: string;
		queryName: string;
		isFavorite: boolean;
	};

	/** A new dashboard was created */
	"analytics.dashboard.created": {
		dashboard: Dashboard;
	};

	/** An existing dashboard was updated (name, description) */
	"analytics.dashboard.updated": {
		dashboard: Dashboard;
	};

	/** A dashboard was deleted */
	"analytics.dashboard.deleted": {
		dashboardId: string;
		dashboardName: string;
	};

	/** A dashboard's favorite status was toggled */
	"analytics.dashboard.favorited": {
		dashboardId: string;
		dashboardName: string;
		isFavorite: boolean;
	};

	/** The default dashboard was changed */
	"analytics.dashboard.defaultChanged": {
		dashboardId: string | null;
		dashboardName?: string;
	};

	/** A tile was added to a dashboard */
	"analytics.dashboard.tile.added": {
		dashboardId: string;
		tile: DashboardTile;
	};

	/** A tile was removed from a dashboard */
	"analytics.dashboard.tile.removed": {
		dashboardId: string;
		tileId: string;
	};

	/** A tile was updated within a dashboard */
	"analytics.dashboard.tile.updated": {
		dashboardId: string;
		tile: DashboardTile;
	};

	/** A dashboard's tiles were refreshed (re-executed) */
	"analytics.dashboard.refreshed": {
		dashboardId: string;
		tileCount: number;
	};

	/** A saved query was renamed */
	"analytics.query.renamed": {
		queryId: string;
		oldName: string;
		newName: string;
	};

	/** A saved query was duplicated */
	"analytics.query.duplicated": {
		originalQueryId: string;
		newQueryId: string;
		newQueryName: string;
	};

	/** A dashboard tile was reordered */
	"analytics.dashboard.tile.reordered": {
		dashboardId: string;
		tileId: string;
		direction: "up" | "down";
	};

	/** A dashboard was saved as a reusable template */
	"analytics.template.saved": {
		templateId: string;
		templateName: string;
		domain: string;
	};

	/** A new dashboard was created from a template */
	"analytics.template.used": {
		templateId: string;
		dashboardId: string;
		dashboardName: string;
	};

	// ── Measurement events ───────────────────────────────

	/** A measurement was created */
	"analytics.measurement.created": {
		measurement: Measurement;
	};

	/** A measurement was updated */
	"analytics.measurement.updated": {
		measurement: Measurement;
	};

	/** A measurement was deleted */
	"analytics.measurement.deleted": {
		measurementId: string;
		measurementName: string;
	};

	/** A measurement's favorite status was toggled */
	"analytics.measurement.favorited": {
		measurementId: string;
		measurementName: string;
		isFavorite: boolean;
	};
}
