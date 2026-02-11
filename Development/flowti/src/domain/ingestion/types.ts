/**
 * Types for the Ingestion domain.
 */

/**
 * Status of an ingestion job.
 */
export type IngestionJobStatus = "queued" | "processing" | "completed" | "failed";

/**
 * A single ingestion job representing an event to process.
 */
export interface IngestionJob {
	/** Unique job ID */
	id: string;
	/** The event type that triggered this job */
	eventType: string;
	/** The event payload */
	payload: Record<string, unknown>;
	/** Current job status */
	status: IngestionJobStatus;
	/** Number of retry attempts */
	retryCount: number;
	/** ISO timestamp when queued */
	queuedAt: string;
	/** ISO timestamp when processing started */
	startedAt?: string;
	/** ISO timestamp when completed or failed */
	completedAt?: string;
}

/**
 * Configuration for the ingestion pipeline.
 */
export interface IngestionConfig {
	/** Max concurrent jobs (default: 3) */
	concurrency: number;
	/** Time window in ms to batch incoming events (default: 500) */
	batchWindowMs: number;
	/** Max retry attempts for failed jobs (default: 3) */
	maxRetries: number;
	/** Base delay in ms for exponential backoff (default: 1000) */
	baseRetryDelayMs: number;
	/** Event types to watch for ingestion (default: ["file.created", "file.modified"]) */
	watchEventTypes: string[];
}

/**
 * Runtime statistics for the ingestion pipeline.
 */
export interface IngestionStats {
	/** Total jobs processed successfully */
	processedCount: number;
	/** Total jobs that failed after all retries */
	failedCount: number;
	/** Jobs currently queued */
	queuedCount: number;
	/** Jobs currently processing */
	activeCount: number;
}

/**
 * Persisted state for the ingestion domain.
 * Stores processed event keys for idempotency.
 */
export interface IngestionPersistentState {
	/** Deterministic keys of already-processed events (oldest first) */
	processedKeys: string[];
	/** Jobs that were pending when the plugin was unloaded (crash recovery) */
	pendingJobs?: IngestionJob[];
}

/**
 * Maximum number of processed keys to retain in the ledger.
 * Oldest entries are evicted first when this limit is exceeded.
 */
export const MAX_LEDGER_SIZE = 10000;

/**
 * Default ingestion configuration.
 */
export const DEFAULT_INGESTION_CONFIG: IngestionConfig = {
	concurrency: 3,
	batchWindowMs: 500,
	maxRetries: 3,
	baseRetryDelayMs: 1000,
	watchEventTypes: ["file.created", "file.modified"],
};
