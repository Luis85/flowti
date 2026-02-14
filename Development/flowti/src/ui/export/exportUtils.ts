/**
 * Pure helper functions for the ExportView.
 */

import type { FilePropertyDef, VaultFileInfo } from "../../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../../domain/dataExchange/types";

/** Returns the user-friendly label for a file property key. */
export function getFilePropertyLabel(key: string): string {
	const def = STANDARD_FILE_PROPERTIES.find((p: FilePropertyDef) => p.key === key);
	return def?.label ?? key.replace(/^file\./, "");
}

/** Resolves a file property value from a VaultFileInfo. */
export function resolveFileProperty(file: VaultFileInfo, key: string): string {
	switch (key) {
		case "file.name": return file.basename;
		case "file.basename": return file.basename;
		case "file.fullname": return `${file.basename}.${file.extension}`;
		case "file.path": return file.path;
		case "file.folder": return file.folder;
		case "file.ext": return file.extension;
		case "file.ctime":
			return file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "";
		case "file.mtime":
			return file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "";
		case "file.size":
			return file.stat?.size !== undefined ? String(file.stat.size) : "";
		case "file.tags": return file.tags?.join(", ") ?? "";
		default: return "";
	}
}

/** Extracts the filename portion of a path. */
export function getFilenameFromPath(p: string): string {
	const parts = p.replace(/\\/g, "/").split("/");
	return parts[parts.length - 1] || p;
}

/** Returns the folder portion of an output path. */
export function getOutputFolder(outputPath: string): string {
	const norm = outputPath.replace(/\\/g, "/");
	const lastSlash = norm.lastIndexOf("/");
	return lastSlash === -1 ? "" : norm.slice(0, lastSlash);
}

/** Returns just the filename from an output path. */
export function getOutputFilename(outputPath: string): string {
	return getFilenameFromPath(outputPath);
}

/** Builds an output path from folder + filename. */
export function buildOutputPath(folder: string, filename: string): string {
	return folder ? `${folder}/${filename}` : filename;
}

/** Swaps the file extension when format changes (.csv ↔ .txt). */
export function swapOutputExtension(
	outputPath: string,
	oldFormat: "csv" | "tab",
	newFormat: "csv" | "tab",
): string {
	const filename = getOutputFilename(outputPath);
	let newFilename = filename;
	if (oldFormat === "csv" && newFormat === "tab" && filename.endsWith(".csv")) {
		newFilename = filename.replace(/\.csv$/, ".txt");
	} else if (oldFormat === "tab" && newFormat === "csv" && filename.endsWith(".txt")) {
		newFilename = filename.replace(/\.txt$/, ".csv");
	}
	if (newFilename === filename) return outputPath;
	const folder = getOutputFolder(outputPath);
	return buildOutputPath(folder, newFilename);
}
