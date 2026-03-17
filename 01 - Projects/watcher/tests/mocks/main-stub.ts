/**
 * Stub for the main plugin module in tests
 */

import { vi } from "vitest";

export default class FileWatcherPlugin {
	app: any = {
		vault: {
			adapter: {
				exists: vi.fn().mockResolvedValue(false),
				stat: vi.fn().mockResolvedValue(null),
				list: vi.fn().mockResolvedValue({ files: [], folders: [] }),
				writeBinary: vi.fn().mockResolvedValue(undefined),
			},
			createFolder: vi.fn().mockResolvedValue(undefined),
		},
	};

	settings = {
		folderMappings: [],
		ignoreOneDriveTemp: true,
		verifyFileStability: false,
		stabilityCheckInterval: 500,
		stabilityChecks: 3,
		syncOnStart: true,
		debugMode: false,
		reconcile: {
			parallelism: 8,
			progressThrottleMs: 250,
			fastSkipUnchanged: true,
			disableStabilityCheckDuringReconcile: true,
			notifyOnMappingDone: false,
		},
	};

	stats = {
		filesProcessed: 0,
		filesSkipped: 0,
		errors: 0,
		lastProcessed: null,
		perMappingStats: {},
	};

	syncFile = vi.fn().mockResolvedValue({ ok: true, action: "processed" });
	bumpProcessed = vi.fn();
	bumpSkipped = vi.fn();
	bumpError = vi.fn();

	fileSync = {
		reconcileFolder: vi.fn().mockResolvedValue({
			scanned: 0,
			processed: 0,
			skipped: 0,
			errors: 0,
		}),
	};

	statusbar = {
		onStatsChanged: vi.fn(),
	};
}
