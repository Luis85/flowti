/**
 * Pure helper functions for the ExportView.
 */

import type { FilePropertyDef, ResolvedColumn, VaultFileInfo } from "../../domain/dataExchange/types";
import { STANDARD_FILE_PROPERTIES } from "../../domain/dataExchange/types";
import { basename as pathBasename, dirname } from "../../utils/pathUtils";

/** Returns the user-friendly label for a file property key. */
export function getFilePropertyLabel(key: string): string {
	const def = STANDARD_FILE_PROPERTIES.find((p: FilePropertyDef) => p.key === key);
	return def?.label ?? key.replace(/^file\./, "");
}

/** Resolves a file property value from a VaultFileInfo. */
export function resolveFileProperty(file: VaultFileInfo, key: string): string {
	const resolvers: Record<string, () => string> = {
		"file.name": () => file.basename,
		"file.basename": () => file.basename,
		"file.fullname": () => `${file.basename}.${file.extension}`,
		"file.path": () => file.path,
		"file.folder": () => file.folder,
		"file.ext": () => file.extension,
		"file.ctime": () => file.stat?.ctime ? new Date(file.stat.ctime).toISOString() : "",
		"file.mtime": () => file.stat?.mtime ? new Date(file.stat.mtime).toISOString() : "",
		"file.size": () => file.stat?.size !== undefined ? String(file.stat.size) : "",
		"file.tags": () => file.tags?.join(", ") ?? "",
	};
	return resolvers[key]?.() ?? "";
}

/** Resolves a column value from a file using a ResolvedColumn descriptor. */
export function resolveColumnValue(file: VaultFileInfo, rc: ResolvedColumn): string {
	if (rc.source === "file") {
		return resolveFileProperty(file, rc.resolveKey);
	}
	if (rc.source === "formula") {
		if (rc.resolveSource === "file") {
			return resolveFileProperty(file, rc.resolveKey);
		}
		const value = file.frontmatter?.[rc.resolveKey];
		return value !== undefined && value !== null ? String(value) : "";
	}
	// frontmatter
	const value = file.frontmatter?.[rc.resolveKey];
	return value !== undefined && value !== null ? String(value) : "";
}

/** Extracts the filename portion of a path. */
export function getFilenameFromPath(p: string): string {
	return pathBasename(p) || p;
}

/** Returns the folder portion of an output path. */
export function getOutputFolder(outputPath: string): string {
	return dirname(outputPath);
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
