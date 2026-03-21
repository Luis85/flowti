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

	/** Remap a path if it starts with oldPath or oldPrefix. Returns [newValue, changed]. */
	private remapPath(path: string, oldPath: string, oldPrefix: string, newPath: string): [string, boolean] {
		if (path === oldPath || path.startsWith(oldPrefix)) {
			return [newPath + path.slice(oldPath.length), true];
		}
		return [path, false];
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
			let c: boolean;
			[cfg.sourcePath, c] = this.remapPath(cfg.sourcePath, oldPath, oldPrefix, newPath); changed = changed || c;
			if (!cfg.isExternal) {
				[cfg.outputPath, c] = this.remapPath(cfg.outputPath, oldPath, oldPrefix, newPath); changed = changed || c;
			}
		}

		for (const cfg of state.savedImportConfigs) {
			let c: boolean;
			if (cfg.sourcePath) {
				[cfg.sourcePath, c] = this.remapPath(cfg.sourcePath, oldPath, oldPrefix, newPath); changed = changed || c;
			}
			[cfg.targetFolder, c] = this.remapPath(cfg.targetFolder, oldPath, oldPrefix, newPath); changed = changed || c;
		}

		for (const pipe of state.savedPipelines ?? []) {
			let c: boolean;
			[pipe.targetFolder, c] = this.remapPath(pipe.targetFolder, oldPath, oldPrefix, newPath); changed = changed || c;
			for (const src of pipe.sources) {
				[src.csvPath, c] = this.remapPath(src.csvPath, oldPath, oldPrefix, newPath); changed = changed || c;
			}
		}

		if (changed) {
			await this.deps.saveState();
			this.deps.emitConfigChanged();
		}
	}
}
