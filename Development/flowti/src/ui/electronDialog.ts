/**
 * Shared Electron native dialog utility.
 * Wraps `remote.dialog.showSaveDialog` to eliminate duplication across views.
 */

import type { ExportFormat } from "../domain/dataExchange/types";

export interface NativeSaveDialogOptions {
	format: ExportFormat;
	defaultFilename?: string;
}

export interface NativeSaveDialogResult {
	canceled: boolean;
	filePath?: string;
}

/**
 * Opens the native Electron save dialog for CSV/Tab exports.
 * Returns null if the dialog could not be opened (e.g. not running in Electron).
 */
export async function showNativeSaveDialog(
	options: NativeSaveDialogOptions,
): Promise<NativeSaveDialogResult | null> {
	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const { remote } = require("electron");
		const ext = options.format === "tab" ? "txt" : "csv";
		const filters = options.format === "tab"
			? [{ name: "Tab-Separated", extensions: ["txt", "tsv"] }, { name: "All Files", extensions: ["*"] }]
			: [{ name: "CSV Files", extensions: ["csv"] }, { name: "All Files", extensions: ["*"] }];

		const defaultPath = options.defaultFilename ?? `export.${ext}`;

		const result: NativeSaveDialogResult = await remote.dialog.showSaveDialog(
			remote.getCurrentWindow(),
			{ defaultPath, filters },
		);
		return result;
	} catch {
		return null;
	}
}
