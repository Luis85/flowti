/**
 * Handles file/folder rename events by updating all saved config paths.
 *
 * Extracted from DataExchangeService to reduce its LOC.
 */

import type { DataExchangeState } from "./types";

export interface ConfigPathTrackerDeps {
	getState: () => DataExchangeState;
	saveState: () => Promise<void>;
	emitConfigChanged: () => void;
}

export class ConfigPathTracker {
	constructor(private deps: ConfigPathTrackerDeps) {}

	/** Updates saved configs when a file is renamed/moved. */
	async handleFileRenamed(
		oldPath: string,
		newPath: string,
	): Promise<void> {
		const state = this.deps.getState();
		let changed = false;

		for (const cfg of state.savedImportConfigs) {
			if (cfg.sourcePath === oldPath) {
				cfg.sourcePath = newPath;
				changed = true;
			}
		}

		for (const cfg of state.savedExportConfigs) {
			if (cfg.sourcePath === oldPath) {
				cfg.sourcePath = newPath;
				changed = true;
			}
			if (!cfg.isExternal && cfg.outputPath === oldPath) {
				cfg.outputPath = newPath;
				changed = true;
			}
		}

		for (const pipe of state.savedPipelines ?? []) {
			for (const src of pipe.sources) {
				if (src.csvPath === oldPath) {
					src.csvPath = newPath;
					changed = true;
				}
			}
		}

		if (changed) {
			await this.deps.saveState();
			this.deps.emitConfigChanged();
		}
	}

	/** Updates saved configs when a folder is renamed/moved. */
	async handleFolderRenamed(
		oldPath: string,
		newPath: string,
	): Promise<void> {
		const state = this.deps.getState();
		let changed = false;
		const oldPrefix = oldPath + "/";

		for (const cfg of state.savedExportConfigs) {
			if (
				cfg.sourcePath === oldPath ||
				cfg.sourcePath.startsWith(oldPrefix)
			) {
				cfg.sourcePath = newPath + cfg.sourcePath.slice(oldPath.length);
				changed = true;
			}
			if (
				!cfg.isExternal &&
				(cfg.outputPath === oldPath ||
					cfg.outputPath.startsWith(oldPrefix))
			) {
				cfg.outputPath = newPath + cfg.outputPath.slice(oldPath.length);
				changed = true;
			}
		}

		for (const cfg of state.savedImportConfigs) {
			if (
				cfg.sourcePath &&
				(cfg.sourcePath === oldPath ||
					cfg.sourcePath.startsWith(oldPrefix))
			) {
				cfg.sourcePath =
					newPath + cfg.sourcePath.slice(oldPath.length);
				changed = true;
			}
			if (
				cfg.targetFolder === oldPath ||
				cfg.targetFolder.startsWith(oldPrefix)
			) {
				cfg.targetFolder =
					newPath + cfg.targetFolder.slice(oldPath.length);
				changed = true;
			}
		}

		for (const pipe of state.savedPipelines ?? []) {
			if (
				pipe.targetFolder === oldPath ||
				pipe.targetFolder.startsWith(oldPrefix)
			) {
				pipe.targetFolder = newPath + pipe.targetFolder.slice(oldPath.length);
				changed = true;
			}
			for (const src of pipe.sources) {
				if (src.csvPath.startsWith(oldPrefix)) {
					src.csvPath = newPath + src.csvPath.slice(oldPath.length);
					changed = true;
				}
			}
		}

		if (changed) {
			await this.deps.saveState();
			this.deps.emitConfigChanged();
		}
	}
}
