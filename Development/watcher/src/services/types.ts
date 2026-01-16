import { ReconcileProgress, FolderMapping, ReconcileStats } from "src/types";
import { OperationLock } from "./AsyncMutex";

export type ReconcileCallbacks = {
	onProgress?: (
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) => void;
	onMappingDone?: (mapping: FolderMapping, stats: ReconcileStats) => void;
};

/** Progress data emitted by FileSyncService during reconcile */
export type ReconcileMappingProgress = {
	total: number;
	scanned: number;
	processed: number;
	skipped: number;
	errors: number;
	current?: string;
};

/** Interface for the file sync service used by ReconcileService */
export interface IFileSyncService {
	reconcileMapping(
		mapping: FolderMapping,
		onProgress?: (p: ReconcileMappingProgress) => void
	): Promise<ReconcileStats>;

	/** Get the operation lock for coordinating with watchers */
	getOperationLock(): OperationLock;
}
