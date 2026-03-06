/**
 * Event map for the Process Management domain.
 *
 * Events follow the `process.` prefix convention.
 * 12 events covering process lifecycle, node/edge changes, and execution.
 */

import type { ValidationResult } from "./types";

export interface ProcessEventMap {
	// ── Process lifecycle ────────────────────────────────────────

	/** Emitted when a process canvas is opened for viewing. */
	"process.opened": {
		processName: string;
		filePath: string;
	};

	/** Emitted when a new process definition is created. */
	"process.created": {
		processName: string;
		filePath: string;
		nodeCount: number;
	};

	/** Emitted when a process definition is updated (re-scanned). */
	"process.updated": {
		processName: string;
		filePath: string;
		nodeCount: number;
		edgeCount: number;
	};

	// ── Node operations ─────────────────────────────────────────

	/** Emitted when a node is added to a process. */
	"process.node.added": {
		processName: string;
		nodeId: string;
		nodeType: string;
		nodeName: string;
	};

	/** Emitted when a node is updated in a process. */
	"process.node.updated": {
		processName: string;
		nodeId: string;
		nodeType: string;
		nodeName: string;
	};

	/** Emitted when a node is removed from a process. */
	"process.node.removed": {
		processName: string;
		nodeId: string;
	};

	// ── Edge operations ─────────────────────────────────────────

	/** Emitted when an edge is created between nodes. */
	"process.edge.created": {
		processName: string;
		fromNode: string;
		toNode: string;
		label?: string;
	};

	/** Emitted when an edge is removed. */
	"process.edge.removed": {
		processName: string;
		fromNode: string;
		toNode: string;
	};

	// ── Compilation & sync ──────────────────────────────────────

	/** Emitted when a process is compiled (validated + ready for use). */
	"process.compiled": {
		processName: string;
		validation: ValidationResult;
	};

	/** Emitted when a process canvas is synced (re-parsed from file). */
	"process.canvas.synced": {
		processName: string;
		filePath: string;
		nodeCount: number;
		edgeCount: number;
	};

	// ── Execution ───────────────────────────────────────────────

	/** Emitted when process execution starts for a feature. */
	"process.execution.started": {
		processName: string;
		featureName: string;
		timestamp: string;
	};

	/** Emitted when process execution completes for a feature. */
	"process.execution.completed": {
		processName: string;
		featureName: string;
		compliancePercentage: number;
		timestamp: string;
	};
}
