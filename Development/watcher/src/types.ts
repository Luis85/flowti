export type ConflictResolution = "overwrite" | "rename" | "skip" | "keepNewer";

export type SyncDirection = "source-only" | "vault-only" | "bidirectional";

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
	/** Direction of sync: source-only (import), vault-only (export), bidirectional */
	syncDirection: SyncDirection;
	/** Conflict resolution for vault→source sync (used when syncDirection !== "source-only") */
	reverseConflictResolution?: ConflictResolution;
	/** Patterns to exclude from sync (glob-like patterns, e.g. "node_modules", "*.log", "temp/*") */
	excludePatterns?: string[];
}

/**
 * Default values for FolderMapping properties.
 * Used when creating new mappings.
 */
export const DEFAULT_MAPPING_VALUES: Omit<FolderMapping, "id"> = {
	enabled: true,
	sourceFolder: "",
	targetFolder: "",
	watchSubfolders: true,
	fileExtensions: [],
	conflictResolution: "keepNewer",
	debounceDelay: 800,
	description: "",
	usePolling: false,
	pollingInterval: 300,
	reconcileOnStart: true,
	syncDirection: "source-only",
	reverseConflictResolution: "keepNewer",
	excludePatterns: [],
};

/**
 * Creates a new FolderMapping with default values.
 * @param overrides - Optional values to override defaults
 * @returns A new FolderMapping with a generated ID
 */
export function createDefaultMapping(
	overrides: Partial<FolderMapping> = {}
): FolderMapping {
	return {
		...DEFAULT_MAPPING_VALUES,
		id: crypto.randomUUID?.() ?? String(Date.now()),
		...overrides,
	};
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

/**
 * Type of file change event.
 * Used by both watchers and sync operations.
 */
export type ChangeType = "added" | "changed" | "deleted";

export type PendingJob = {
	filePath: string;
	changeType: ChangeType;
	timer?: ReturnType<typeof setTimeout>;
};

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
