/**
 * Event definitions for the Analytics domain.
 *
 * 5 events covering the analytics query lifecycle:
 * - Query execution: started / completed / failed
 * - Persistence: query.saved / query.deleted
 */

import type { AnalyticsResult } from "./types";

export interface AnalyticsEventMap {
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
