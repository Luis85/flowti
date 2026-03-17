/**
 * Adapter interface for signal data sources.
 *
 * Each external data source (Azure DevOps, GitHub, Jira, etc.)
 * implements this interface. The SignalService delegates all
 * network communication to the adapter.
 */

import type { SignalConfig, SyncError, WorkItemMapping } from "../types";

/** Result of a connection test. */
export interface TestConnectionResult {
	success: boolean;
	error?: string;
}

/** Result of fetching items from the external source. */
export interface FetchItemsResult {
	items: WorkItemMapping[];
	errors: SyncError[];
}

/** Contract that all signal adapters must implement. */
export interface SignalAdapter {
	/** Validate that the signal configuration can connect to the source. */
	testConnection(config: SignalConfig): Promise<TestConnectionResult>;

	/** Fetch items from the external source. */
	fetchItems(config: SignalConfig): Promise<FetchItemsResult>;
}
