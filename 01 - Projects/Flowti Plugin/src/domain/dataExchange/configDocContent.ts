/**
 * Pure functions for generating markdown doc content.
 * Extracted from ConfigDocService to separate content generation from orchestration.
 */

import { basename, stripExtension } from "../../utils/pathUtils";
import type {
	SavedImportConfig,
	SavedExportConfig,
	DataDictionaryEntry,
} from "./types";

/** Sanitizes a name for use in file paths (removes unsafe characters). */
export function sanitizeDocName(name: string): string {
	return name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
}

/** Strips trailing slashes from a base path. */
function cleanBase(base: string): string {
	return base.replace(/\/+$/, "");
}

// ── Path helpers ────────────────────────────────────────────

export function getConfigsFolder(docsRoot: string): string {
	return `${cleanBase(docsRoot)}/Configs`;
}

export function getReportsFolder(docsRoot: string): string {
	return `${cleanBase(docsRoot)}/Reports`;
}

export function getPropertiesFolder(docsRoot: string): string {
	return `${cleanBase(docsRoot)}/Properties`;
}

export function getTypesFolder(docsRoot: string): string {
	return `${cleanBase(docsRoot)}/Types`;
}

export function getCsvDocPath(docsRoot: string, csvPath: string): string {
	const folder = getReportsFolder(docsRoot);
	const csvBasename = stripExtension(basename(csvPath), ".csv") || "csv";
	const safeName = sanitizeDocName(csvBasename);

	// Include parent folder path to disambiguate CSV files with the same name
	const lastSlash = csvPath.lastIndexOf("/");
	if (lastSlash > 0) {
		const parentPath = csvPath.substring(0, lastSlash).replace(/\//g, " - ");
		const safeParent = sanitizeDocName(parentPath);
		return `${folder}/CSV - ${safeName} (${safeParent}).md`;
	}
	return `${folder}/CSV - ${safeName}.md`;
}

/** Legacy path (basename-only) for backward compatibility with pre-existing docs. */
export function getLegacyCsvDocPath(docsRoot: string, csvPath: string): string {
	const folder = getReportsFolder(docsRoot);
	const csvBasename = stripExtension(basename(csvPath), ".csv") || "csv";
	const safeName = sanitizeDocName(csvBasename);
	return `${folder}/CSV - ${safeName}.md`;
}

export function getConfigDocPath(
	docsRoot: string,
	configName: string,
	configType: "import" | "export",
): string {
	const folder = getConfigsFolder(docsRoot);
	const safeName = sanitizeDocName(configName);
	const prefix = configType === "import" ? "Import" : "Export";
	return `${folder}/${prefix} - ${safeName}.md`;
}

export function getPropertyDocPath(docsRoot: string, propertyName: string): string {
	const folder = getPropertiesFolder(docsRoot);
	const safeName = sanitizeDocName(propertyName);
	return `${folder}/Property - ${safeName}.md`;
}

export function getPipelineDocPath(docsRoot: string, pipelineName: string): string {
	const folder = getConfigsFolder(docsRoot);
	const safeName = sanitizeDocName(pipelineName);
	return `${folder}/Pipeline - ${safeName}.md`;
}

export function getEventDocPath(docsRoot: string, eventType: string): string {
	return `${cleanBase(docsRoot)}/Events/${eventType}.md`;
}

export function getTypeDocPath(docsRoot: string, typeName: string): string {
	const folder = getTypesFolder(docsRoot);
	const safeName = sanitizeDocName(typeName);
	return `${folder}/Type - ${safeName}.md`;
}

// ── Content builders ────────────────────────────────────────

export function buildCsvDocContent(
	csvPath: string,
	headers: string[],
	rowCount: number,
	delimiter?: string,
): string {
	const csvBasename = basename(csvPath) || "file.csv";
	const now = new Date().toISOString();
	// Strip surrounding quotes from headers (CSV parsing may leave them)
	const cleanHeaders = headers.map((h) => h.replace(/^"+|"+$/g, ""));

	const lines: string[] = [
		"---",
		"type: CsvDoc",
		`csvFile: "[[${csvBasename}]]"`,
		`filePath: "${csvPath}"`,
		`name: "${csvBasename}"`,
		`description: ""`,
		`columns: ${cleanHeaders.length}`,
		`rows: ${rowCount}`,
		`delimiter: "${delimiter ?? ","}"`,
		`headers: [${cleanHeaders.map((h) => `"${h}"`).join(", ")}]`,
		`noteType: ""`,
		`created: "${now}"`,
		"---",
		"",
		`# ${csvBasename}`,
		"",
		"> CSV file documentation.",
		"",
		"## Overview",
		"",
		`- **File**: [[${csvBasename}]]`,
		`- **Columns**: ${headers.length}`,
		`- **Rows**: ${rowCount}`,
		"",
		"## Notes",
		"",
		"> Document usage notes, data source, or workflow context.",
		"",
	];

	return lines.join("\n");
}

/** Collect related files from config references. */
function collectRelatedFiles(
	configRefs: DataDictionaryEntry["usedInConfigs"],
	importConfigs: Array<{ id: string; name: string; sourcePath?: string; basePath?: string }>,
	exportConfigs: Array<{ id: string; name: string; sourcePath: string; outputPath: string; isExternal?: boolean }>,
): Set<string> {
	const relatedFiles = new Set<string>();
	for (const ref of configRefs) {
		if (ref.configType === "import") {
			const cfg = importConfigs.find((c) => c.id === ref.configId);
			if (cfg?.sourcePath) relatedFiles.add(cfg.sourcePath);
			if (cfg?.basePath) relatedFiles.add(cfg.basePath);
		} else {
			const cfg = exportConfigs.find((c) => c.id === ref.configId);
			if (cfg) {
				relatedFiles.add(cfg.sourcePath);
				if (!cfg.isExternal) relatedFiles.add(cfg.outputPath);
			}
		}
	}
	return relatedFiles;
}

export function buildPropertyDocContent(
	propertyName: string,
	docsRoot: string,
	entry: DataDictionaryEntry | undefined,
	importConfigs: Array<{ id: string; name: string; sourcePath?: string; basePath?: string }>,
	exportConfigs: Array<{ id: string; name: string; sourcePath: string; outputPath: string; isExternal?: boolean }>,
): string {
	const now = new Date().toISOString();
	const csvColumns = entry?.csvColumnNames ?? [];
	const configRefs = entry?.usedInConfigs ?? [];

	const configDocLinks: string[] = configRefs.map((ref) => {
		const configDocPath = getConfigDocPath(docsRoot, ref.configName, ref.configType);
		const configDocName = stripExtension(basename(configDocPath), ".md") || ref.configName;
		return `- [[${configDocName}]]`;
	});

	const relatedFiles = collectRelatedFiles(configRefs, importConfigs, exportConfigs);

	const reportLinks: string[] = [...relatedFiles]
		.filter((f) => f.toLowerCase().endsWith(".csv"))
		.map((filePath) => {
			const reportDocPath = getCsvDocPath(docsRoot, filePath);
			const reportDocName = stripExtension(basename(reportDocPath), ".md") || filePath;
			return `- [[${reportDocName}]]`;
		});

	const fileLinks = [...relatedFiles].map((f) => `- [[${basename(f) || f}]]`);

	const lines: string[] = [
		"---",
		"type: PropertyDoc",
		`property: "${propertyName}"`,
		`description: ""`,
		`csvColumns: [${csvColumns.map((c) => `"${c}"`).join(", ")}]`,
		`configs: [${configRefs.map((c) => `"${c.configName}"`).join(", ")}]`,
		`created: "${now}"`,
		"---",
		"",
		`# ${propertyName}`,
		"",
		"> Property documentation.",
		"",
		"## Overview",
		"",
		`- **Property**: \`${propertyName}\``,
		...(csvColumns.length > 0
			? [`- **CSV Columns**: ${csvColumns.join(", ")}`]
			: []),
		"",
		"## Description",
		"",
		"> Describe what this property represents, valid values, and any constraints.",
		"",
	];

	if (configDocLinks.length > 0) {
		lines.push("## Configs", "", ...configDocLinks, "");
	}

	if (fileLinks.length > 0) {
		lines.push("## Related Files", "", ...fileLinks, "");
	}

	if (reportLinks.length > 0) {
		lines.push("## Reports", "", ...reportLinks, "");
	}

	lines.push(
		"## Notes",
		"",
		"> Document usage context, data lineage, or related properties.",
		"",
	);

	return lines.join("\n");
}

/** Filter out placeholder empty lines from frontmatter template arrays. */
function filterEmptyPlaceholders(lines: string[]): string[] {
	return lines.filter((l) => l !== "" || lines.indexOf(l) > 10);
}

/** Append a notes section (user-written or default placeholder). */
function appendNotesSection(lines: string[], userNotes: string | undefined): void {
	if (userNotes !== undefined) {
		lines.push("## Notes", "", userNotes);
	} else {
		lines.push("## Notes", "", "> Document usage notes, scheduling, or workflow context.", "");
	}
}

export function buildImportDocContent(config: SavedImportConfig, userNotes?: string): string {
	const now = new Date(config.createdAt).toISOString();
	const included = config.columnMappings.filter((m) => m.included);

	const lines: string[] = [
		"---",
		"type: ImportConfigDoc",
		`configId: "${config.id}"`,
		`name: "${config.name}"`,
		`targetFolder: "${config.targetFolder}"`,
		`nameColumn: "${config.nameColumn}"`,
		`namePrefix: "${config.namePrefix ?? ""}"`,
		`nameSuffix: "${config.nameSuffix ?? ""}"`,
		`conflictStrategy: "${config.conflictStrategy}"`,
		`columns: ${config.columnMappings.length}`,
		`includedColumns: ${included.length}`,
		config.noteType ? `noteType: "${config.noteType}"` : "",
		config.sourcePath ? `sourcePath: "${config.sourcePath}"` : "",
		`created: "${now}"`,
		"---",
		"",
		`# ${config.name}`,
		"",
		"> Import configuration for CSV-to-Notes pipeline.",
		"",
		"## Settings",
		"",
		"| Setting           | Value            |",
		"| ----------------- | ---------------- |",
		`| **Target Folder** | \`${config.targetFolder}\` |`,
		`| **Name Column**   | \`${config.nameColumn}\` |`,
		`| **Name Prefix**   | ${config.namePrefix ? `\`${config.namePrefix}\`` : "_(none)_"} |`,
		`| **Name Suffix**   | ${config.nameSuffix ? `\`${config.nameSuffix}\`` : "_(none)_"} |`,
		`| **Conflict**      | ${config.conflictStrategy} |`,
		`| **Columns**       | ${included.length} of ${config.columnMappings.length} |`,
		config.noteType ? `| **Note Type**     | [[Type - ${sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
		config.sourcePath ? `| **Source CSV**    | [[${config.sourcePath}\\|${basename(config.sourcePath)}]] |` : "",
		"",
	];

	const filtered = filterEmptyPlaceholders(lines);

	if (included.length > 0) {
		filtered.push("## Column Mappings", "");
		filtered.push("| CSV Column | Frontmatter Key | Included |");
		filtered.push("| ---------- | --------------- | -------- |");
		for (const m of config.columnMappings) {
			filtered.push(`| ${m.csvColumn} | \`${m.frontmatterKey}\` | ${m.included ? "Yes" : "No"} |`);
		}
		filtered.push("");
	}

	if (config.customProperties && Object.keys(config.customProperties).length > 0) {
		filtered.push("## Custom Properties", "");
		for (const [k, v] of Object.entries(config.customProperties)) {
			filtered.push(`- \`${k}\` = \`${v}\``);
		}
		filtered.push("");
	}

	appendNotesSection(filtered, userNotes);

	return filtered.join("\n");
}

export function buildExportDocContent(config: SavedExportConfig, userNotes?: string): string {
	const now = new Date(config.createdAt).toISOString();
	const formatLabel = config.format === "tab" ? "Tab-delimited" : "CSV";

	const lines: string[] = [
		"---",
		"type: ExportConfigDoc",
		`configId: "${config.id}"`,
		`name: "${config.name}"`,
		`sourcePath: "${config.sourcePath}"`,
		`sourceType: "${config.sourceType}"`,
		`format: "${config.format}"`,
		`outputPath: "${config.outputPath}"`,
		`columns: ${config.columns.length}`,
		`fileProperties: ${config.fileProperties.length}`,
		`conflictStrategy: "${config.conflictStrategy ?? "overwrite"}"`,
		config.isExternal ? `isExternal: true` : "",
		config.noteType ? `noteType: "${config.noteType}"` : "",
		`created: "${now}"`,
		"---",
		"",
		`# ${config.name}`,
		"",
		"> Export configuration for vault data extraction.",
		"",
		"## Settings",
		"",
		"| Setting           | Value              |",
		"| ----------------- | ------------------ |",
		`| **Source**        | [[${config.sourcePath}\\|${basename(config.sourcePath)}]] |`,
		`| **Source Type**   | ${config.sourceType} |`,
		`| **Format**       | ${formatLabel} |`,
		`| **Output**       | \`${config.outputPath}\` |`,
		`| **Conflict**     | ${config.conflictStrategy ?? "overwrite"} |`,
		config.isExternal ? `| **External**     | Yes |` : "",
		config.noteType ? `| **Note Type**    | [[Type - ${sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
		"",
	];

	const filtered = filterEmptyPlaceholders(lines);

	if (config.columns.length > 0) {
		filtered.push("## Note Properties", "");
		for (const col of config.columns) {
			filtered.push(`- \`${col}\``);
		}
		filtered.push("");
	}

	if (config.fileProperties.length > 0) {
		filtered.push("## File Properties", "");
		for (const fp of config.fileProperties) {
			filtered.push(`- \`${fp}\``);
		}
		filtered.push("");
	}

	appendNotesSection(filtered, userNotes);

	return filtered.join("\n");
}

// PipelineDocContext and buildPipelineDocContent have been moved to pipelineDocContent.ts
export type { PipelineDocContext } from "./pipelineDocContent";
export { buildPipelineDocContent } from "./pipelineDocContent";

// TypeDocContext and buildTypeDocContent have been moved to typeDocContent.ts
export type { TypeDocContext } from "./typeDocContent";
export { buildTypeDocContent } from "./typeDocContent";
