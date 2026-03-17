/**
 * Event types owned by the Ingestion domain.
 */

import type { IngestionStats } from "./types";

export interface IngestionEventMap {
	/** Emitted when a job is added to the queue */
	"ingestion.job.queued": { jobId: string; eventType: string };
	/** Emitted when a job starts processing */
	"ingestion.job.started": { jobId: string; eventType: string };
	/** Emitted when a job completes successfully */
	"ingestion.job.completed": { jobId: string; eventType: string; payload?: Record<string, unknown> };
	/** Emitted when a job fails (may retry) */
	"ingestion.job.failed": {
		jobId: string;
		eventType: string;
		error: string;
		retryCount: number;
		willRetry: boolean;
	};
	/** Emitted when a batch of jobs starts draining */
	"ingestion.batch.started": { jobCount: number };
	/** Emitted when a batch of jobs finishes draining */
	"ingestion.batch.completed": {
		processedCount: number;
		failedCount: number;
	};
	/** Emitted with current pipeline statistics */
	"ingestion.stats": { stats: IngestionStats };
	/** Emitted when pending jobs are recovered from storage after a crash */
	"ingestion.recovery.completed": { recoveredCount: number };
	/** Emitted when catch-up scanning starts */
	"catchup.started": { folderCount: number };
	/** Emitted when a file is found during catch-up that needs processing */
	"catchup.file.found": { path: string };
	/** Emitted when catch-up scanning completes */
	"catchup.completed": { scannedCount: number; newCount: number };
}
