/**
 * Event definitions for the Signal domain.
 *
 * 14 events following the command/state pair pattern:
 * - CRUD: configured / removed
 * - Connection: connection.tested / connection.failed
 * - Auth: auth.expired
 * - Health: health.checked / health.changed
 * - Sync lifecycle: sync.started / sync.progress / sync.completed / sync.failed
 * - Item-level: item.created / item.updated
 * - System: loaded
 */

import type { SyncResult } from "./types";

export interface SignalEventMap {
	/** A signal connection was created or updated */
	"signal.configured": {
		signalId: string;
		name: string;
		type: string;
		project: string;
	};

	/** A signal connection was removed */
	"signal.removed": {
		signalId: string;
		name: string;
	};

	/** Connection test completed */
	"signal.connection.tested": {
		signalId: string;
		success: boolean;
		error?: string;
	};

	/** Sync operation started */
	"signal.sync.started": {
		signalId: string;
		name: string;
	};

	/** Per-item sync progress */
	"signal.sync.progress": {
		signalId: string;
		current: number;
		total: number;
	};

	/** Sync operation completed successfully */
	"signal.sync.completed": {
		signalId: string;
		result: SyncResult;
	};

	/** Sync operation failed */
	"signal.sync.failed": {
		signalId: string;
		error: string;
	};

	/** A new work item note was created */
	"signal.item.created": {
		signalId: string;
		workItemId: number;
		notePath: string;
	};

	/** An existing work item note was updated */
	"signal.item.updated": {
		signalId: string;
		workItemId: number;
		notePath: string;
		fields: string[];
	};

	/** Signal state loaded from storage */
	"signal.loaded": {
		signalCount: number;
	};

	/** PAT token expired or invalid (401 detected) */
	"signal.auth.expired": {
		signalId: string;
		message: string;
	};

	/** Network connection to the signal source failed */
	"signal.connection.failed": {
		signalId: string;
		message: string;
	};

	/** A health check was performed */
	"signal.health.checked": {
		signalId: string;
		status: string;
		latencyMs: number;
		success: boolean;
	};

	/** Health status transitioned (e.g. healthy → degraded) */
	"signal.health.changed": {
		signalId: string;
		previousStatus: string;
		newStatus: string;
	};
}
