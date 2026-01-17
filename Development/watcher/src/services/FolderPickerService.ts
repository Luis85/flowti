/**
 * FolderPickerService - Native folder picker using Electron's dialog API
 *
 * This service provides a native folder picker dialog for selecting
 * external folders (source folders) in the file watcher plugin.
 */

/**
 * Opens a native folder picker dialog and returns the selected path
 * @param defaultPath - Optional default path to start from
 * @returns The selected folder path, or null if cancelled
 */
export async function pickFolder(defaultPath?: string): Promise<string | null> {
	try {
		// Access Electron's remote module through the window object
		// Obsidian exposes this for plugin use
		const { remote } = require("electron");

		const result = await remote.dialog.showOpenDialog({
			properties: ["openDirectory"],
			defaultPath: defaultPath || undefined,
			title: "Select Source Folder",
		});

		if (result.canceled || result.filePaths.length === 0) {
			return null;
		}

		return result.filePaths[0];
	} catch (error) {
		console.error("Failed to open folder picker:", error);
		return null;
	}
}

/**
 * Check if the native folder picker is available
 * (Electron's remote module must be accessible)
 */
export function isFolderPickerAvailable(): boolean {
	try {
		const { remote } = require("electron");
		return !!remote?.dialog?.showOpenDialog;
	} catch {
		return false;
	}
}
