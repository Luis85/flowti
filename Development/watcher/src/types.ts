export type ConflictResolution = "overwrite" | "rename" | "skip" | "keepNewer";

export interface FolderMapping {
	id: string;
	enabled: boolean;
	sourceFolder: string; // absolute
	targetFolder: string; // vault-internal, e.g. "imported/onedrive"
	watchSubfolders: boolean;
	fileExtensions: string[];
	conflictResolution: ConflictResolution;
	debounceDelay: number;
	description: string;
	usePolling?: boolean;
	pollingInterval?: number;
	reconcileOnStart: boolean;
}

export interface WatcherStats {
	filesProcessed: number;
	filesSkipped: number;
	errors: number;
	lastProcessed: string | null;
	perMappingStats: Record<
		string,
		{ processed: number; skipped: number; errors: number }
	>;
}

export type ChangeType = "added" | "changed" | "deleted";

export type PendingJob = {
	filePath: string;
	changeType: ChangeType;
	timer?: ReturnType<typeof setTimeout>;
};

export type SyncChangeType = "added" | "changed" | "deleted";

export type SyncAction = "processed" | "skipped";

export type ConflictDecision =
	| { action: "overwrite"; targetPath: string }
	| { action: "rename"; targetPath: string }
	| { action: "skip"; targetPath: string };

export type SyncResult =
	| { ok: true; action: SyncAction; targetPath?: string; reason?: string }
	| { ok: false; error: Error; targetPath?: string };

export type ReconcileStats = {
	scanned: number;
	processed: number;
	skipped: number;
	errors: number;
};

export type ReconcilePhase =
	| "idle"
	| "scanning"
	| "syncing"
	| "done"
	| "error"
	| "cancelled";

export type ReconcileProgress = {
	mappingId: string;
	mappingLabel: string;
	phase: ReconcilePhase;
	total?: number;
	scanned: number;
	processed: number;
	skipped: number;
	errors: number;
	current?: string;
	/** Error message when phase is 'error' */
	errorMessage?: string;
};
