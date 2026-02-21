/**
 * Core types for the Signal domain.
 *
 * Signals connect Flowti to external data sources (Azure DevOps, etc.).
 * Each signal represents a configured connection that can pull items
 * into the vault as structured notes.
 */

/** Supported signal adapter types. */
export type SignalAdapterType = "azure-devops";

/** Connection status for a signal. */
export type SignalStatus = "connected" | "disconnected" | "error";

/** Strategy for handling existing notes during sync. */
export type ConflictStrategy = "skip" | "update" | "overwrite";

/** Configuration for a single signal connection. */
export interface SignalConfig {
	id: string;
	name: string;
	type: SignalAdapterType;
	orgUrl: string;
	project: string;
	pat: string;
	targetFolder: string;
	itemTypeFilter: string[];
	conflictStrategy: ConflictStrategy;
	lastSync: string | null;
	lastSyncItemCount: number;
	status: SignalStatus;
}

/** Persisted state for the Signal domain. */
export interface SignalState {
	signals: SignalConfig[];
}

/** Result of a sync operation. */
export interface SyncResult {
	signalId: string;
	itemsCreated: number;
	itemsUpdated: number;
	itemsSkipped: number;
	errors: SyncError[];
	duration: number;
	timestamp: string;
}

/** A single error encountered during sync. */
export interface SyncError {
	workItemId: number;
	message: string;
	recoverable: boolean;
}

/** Mapped representation of an Azure DevOps work item. */
export interface WorkItemMapping {
	id: number;
	rev: number;
	type: string;
	title: string;
	state: string;
	assignedTo: string;
	areaPath: string;
	iterationPath: string;
	priority: number;
	tags: string[];
	url: string;
	description: string;
	createdDate: string;
	changedDate: string;
}
