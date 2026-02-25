/**
 * Shared context for analytics handler modules.
 *
 * Mirrors the SessionService handler pattern (TD-101):
 * handlers receive a context with state access + persistence,
 * keeping the service class as a thin orchestrator.
 */

import type { IEventBus } from "../../../infrastructure/events/types";
import type {
	AnalyticsState,
	Dashboard,
	SavedAnalyticsQuery,
} from "../types";

export interface AnalyticsHandlerContext {
	/** Current analytics state (mutable). */
	getState: () => AnalyticsState;
	/** Persist state to storage. */
	save: () => Promise<void>;
	/** Event bus for emitting analytics events. */
	eventBus?: IEventBus;
	/** Generate a unique ID for new entities. */
	generateId: () => string;
	/** Look up a saved query by ID. */
	getQuery: (id: string) => SavedAnalyticsQuery | undefined;
	/** Look up a dashboard by ID. */
	getDashboard: (id: string) => Dashboard | undefined;
}
