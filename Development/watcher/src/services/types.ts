import { ReconcileProgress, FolderMapping, ReconcileStats } from "src/types";

export type ReconcileCallbacks = {
	onProgress?: (
		p: ReconcileProgress,
		meta: { mappingIndex: number; mappingTotal: number }
	) => void;
	onMappingDone?: (mapping: FolderMapping, stats: ReconcileStats) => void;
};
