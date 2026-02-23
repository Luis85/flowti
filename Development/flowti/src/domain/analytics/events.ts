/**
 * Event definitions for the Analytics domain.
 *
 * 6 events covering the analytics query lifecycle:
 * - Lifecycle: loaded
 * - Query execution: started / completed / failed
 * - Persistence: query.saved / query.deleted
 */

import type { AnalyticsResult } from "./types";

export interface AnalyticsEventMap {
	/** Analytics domain loaded — emitted after state is restored from storage */
	"analytics.loaded": {
		queryCount: number;
		dashboardCount: number;
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
}
