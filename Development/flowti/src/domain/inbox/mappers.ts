/**
 * Pure mapper functions that transform source event payloads into InboxItems.
 *
 * Each function receives the event payload and a pre-generated ID,
 * and returns a fully-formed InboxItem. No side effects, no dependencies.
 */

import type { InboxItem } from "./types";

/**
 * Maps a `subscription.matched` event to an inbox item.
 */
export function mapSubscriptionMatched(
	payload: {
		eventType: string;
		subscriptionId: string;
		subscriptionLabel?: string;
		timestamp: string;
	},
	id: string,
): InboxItem {
	const label = payload.subscriptionLabel || payload.eventType;
	return {
		id,
		type: "info",
		title: `Watcher matched: ${label}`,
		description: `Event "${payload.eventType}" matched watcher ${payload.subscriptionId}.`,
		sourceEvent: "subscription.matched",
		sourceHub: "subscription",
		timestamp: payload.timestamp,
		read: false,
	};
}

/**
 * Maps a `dataExchange.import.completed` event to an inbox item.
 */
export function mapImportCompleted(
	payload: {
		result: {
			totalRows: number;
			created: number;
			updated: number;
			skipped: number;
			failed: number;
		};
	},
	id: string,
): InboxItem {
	const r = payload.result;
	const hasFailures = r.failed > 0;
	return {
		id,
		type: hasFailures ? "action" : "info",
		title: hasFailures
			? `Import completed with ${r.failed} error${r.failed === 1 ? "" : "s"}`
			: `Import completed: ${r.created} created`,
		description: `${r.totalRows} rows processed: ${r.created} created, ${r.updated} updated, ${r.skipped} skipped, ${r.failed} failed.`,
		sourceEvent: "dataExchange.import.completed",
		sourceHub: "data-exchange",
		timestamp: new Date().toISOString(),
		read: false,
	};
}

/**
 * Maps a `dataExchange.import.failed` event to an inbox item.
 */
export function mapImportFailed(
	payload: {
		error: string;
		config: { sourcePath: string };
	},
	id: string,
): InboxItem {
	return {
		id,
		type: "action",
		title: "Import failed",
		description: `Import of "${payload.config.sourcePath}" failed: ${payload.error}`,
		sourceEvent: "dataExchange.import.failed",
		sourceHub: "data-exchange",
		timestamp: new Date().toISOString(),
		read: false,
	};
}

/**
 * Maps a `dataExchange.export.completed` event to an inbox item.
 */
export function mapExportCompleted(
	payload: {
		result: {
			totalRows: number;
			totalColumns: number;
			outputPath: string;
			skipped?: boolean;
		};
	},
	id: string,
): InboxItem {
	const r = payload.result;
	if (r.skipped) {
		return {
			id,
			type: "info",
			title: "Export skipped",
			description: `Export to "${r.outputPath}" was skipped (file already exists).`,
			sourceEvent: "dataExchange.export.completed",
			sourceHub: "data-exchange",
			timestamp: new Date().toISOString(),
			read: false,
		};
	}
	return {
		id,
		type: "info",
		title: `Export completed: ${r.totalRows} rows`,
		description: `Exported ${r.totalRows} rows and ${r.totalColumns} columns to "${r.outputPath}".`,
		sourceEvent: "dataExchange.export.completed",
		sourceHub: "data-exchange",
		timestamp: new Date().toISOString(),
		read: false,
	};
}
