/**
 * Pure functions for generating markdown doc content.
 * Extracted from ConfigDocService to separate content generation from orchestration.
 */

import { basename, stripExtension } from "../../utils/pathUtils";
import type {
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
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

	const relatedFiles = new Set<string>();
	const configDocLinks: string[] = [];

	for (const ref of configRefs) {
		const configDocPath = getConfigDocPath(docsRoot, ref.configName, ref.configType);
		const configDocName = stripExtension(basename(configDocPath), ".md") || ref.configName;
		configDocLinks.push(`- [[${configDocName}]]`);

		if (ref.configType === "import") {
			const cfg = importConfigs.find((c) => c.id === ref.configId);
			if (cfg) {
				if (cfg.sourcePath) relatedFiles.add(cfg.sourcePath);
				if (cfg.basePath) relatedFiles.add(cfg.basePath);
			}
		} else {
			const cfg = exportConfigs.find((c) => c.id === ref.configId);
			if (cfg) {
				relatedFiles.add(cfg.sourcePath);
				if (!cfg.isExternal) relatedFiles.add(cfg.outputPath);
			}
		}
	}

	const reportLinks: string[] = [];
	for (const filePath of relatedFiles) {
		if (filePath.toLowerCase().endsWith(".csv")) {
			const reportDocPath = getCsvDocPath(docsRoot, filePath);
			const reportDocName = stripExtension(basename(reportDocPath), ".md") || filePath;
			reportLinks.push(`- [[${reportDocName}]]`);
		}
	}

	const fileLinks = [...relatedFiles].map((f) => {
		const name = basename(f) || f;
		return `- [[${name}]]`;
	});

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

	const filtered = lines.filter((l) => l !== "" || lines.indexOf(l) > 10);

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

	if (userNotes !== undefined) {
		filtered.push("## Notes", "", userNotes);
	} else {
		filtered.push("## Notes", "", "> Document usage notes, scheduling, or workflow context.", "");
	}

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

	const filtered = lines.filter((l) => l !== "" || lines.indexOf(l) > 10);

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

	if (userNotes !== undefined) {
		filtered.push("## Notes", "", userNotes);
	} else {
		filtered.push("## Notes", "", "> Document usage notes, scheduling, or workflow context.", "");
	}

	return filtered.join("\n");
}

export interface PipelineDocContext {
	getExportConfig: (id: string) => SavedExportConfig | undefined;
	docsRoot: string;
}

export function buildPipelineDocContent(
	pipeline: SavedMultiImportPipeline,
	ctx: PipelineDocContext,
	userNotes?: string,
): string {
	const now = new Date(pipeline.createdAt).toISOString();
	const lastRun = pipeline.lastExecutedAt
		? new Date(pipeline.lastExecutedAt).toISOString()
		: "";

	const lines: string[] = [
		"---",
		"type: PipelineConfigDoc",
		`configId: "${pipeline.id}"`,
		`name: "${pipeline.name}"`,
		`description: ""`,
		`targetFolder: "${pipeline.targetFolder}"`,
		`mergeKey: "${pipeline.mergeKey}"`,
		pipeline.noteType ? `noteType: "${pipeline.noteType}"` : "",
		pipeline.namePrefix ? `namePrefix: "${pipeline.namePrefix}"` : "",
		pipeline.nameSuffix ? `nameSuffix: "${pipeline.nameSuffix}"` : "",
		pipeline.exportConfigIds?.length ? `exportConfigIds: [${pipeline.exportConfigIds.map((id) => `"${id}"`).join(", ")}]` : "",
		`sources: ${pipeline.sources.length}`,
		`created: "${now}"`,
		lastRun ? `lastExecuted: "${lastRun}"` : "",
		"---",
		"",
		`# ${pipeline.name}`,
		"",
		"> Multi-import pipeline for merging CSV sources into enriched notes.",
		"",
		"## Settings",
		"",
		"| Setting           | Value            |",
		"| ----------------- | ---------------- |",
		`| **Target Folder** | \`${pipeline.targetFolder}\` |`,
		`| **Merge Key**     | \`${pipeline.mergeKey}\` |`,
		`| **Sources**       | ${pipeline.sources.length} |`,
		pipeline.noteType ? `| **Note Type**     | [[Type - ${sanitizeDocName(pipeline.noteType)}\\|${pipeline.noteType}]] |` : "",
		pipeline.namePrefix ? `| **Name Prefix**   | \`${pipeline.namePrefix}\` |` : "",
		pipeline.nameSuffix ? `| **Name Suffix**   | \`${pipeline.nameSuffix}\` |` : "",
		pipeline.exportConfigIds?.length ? `| **Export Steps**  | ${pipeline.exportConfigIds.map((id) => ctx.getExportConfig(id)?.name ?? id).join(", ")} |` : "",
		lastRun ? `| **Last Run**      | ${lastRun} |` : "",
		"",
	];

	const filtered = lines.filter((l) => l !== "" || lines.indexOf(l) > 10);

	if (pipeline.sources.length > 0) {
		filtered.push("## Sources", "");
		for (const source of pipeline.sources) {
			const csvName = basename(source.csvPath) || source.csvPath;
			const included = source.columnMappings.filter((m) => m.included);
			filtered.push(`### [[${source.csvPath}|${csvName}]]`, "");
			filtered.push(`- **Merge Key Column**: \`${source.mergeKeyColumn}\` → \`${pipeline.mergeKey}\``);
			filtered.push(`- **Mapped Columns**: ${included.length} of ${source.columnMappings.length}`);
			if (source.customProperties && Object.keys(source.customProperties).length > 0) {
				filtered.push(`- **Custom Properties**: ${Object.entries(source.customProperties).map(([k, v]) => `\`${k}\`=\`${v}\``).join(", ")}`);
			}
			if (included.length > 0) {
				filtered.push("");
				filtered.push("| CSV Column | Frontmatter Key |");
				filtered.push("| ---------- | --------------- |");
				for (const m of included) {
					filtered.push(`| ${m.csvColumn} | \`${m.frontmatterKey}\` |`);
				}
			}
			filtered.push("");
		}
	}

	if (pipeline.exportConfigIds && pipeline.exportConfigIds.length > 0) {
		filtered.push("## Export Steps", "");
		filtered.push("| # | Config | Format | Output | Conflict |");
		filtered.push("| - | ------ | ------ | ------ | -------- |");
		for (let i = 0; i < pipeline.exportConfigIds.length; i++) {
			const exportCfg = ctx.getExportConfig(pipeline.exportConfigIds[i]);
			if (exportCfg) {
				const cfgSafe = sanitizeDocName(exportCfg.name);
				const formatLabel = exportCfg.format === "tab" ? "Tab" : "CSV";
				const outputName = basename(exportCfg.outputPath) || exportCfg.outputPath;
				const conflict = exportCfg.conflictStrategy ?? "overwrite";
				filtered.push(`| ${i + 1} | [[Export - ${cfgSafe}\\|${exportCfg.name}]] | ${formatLabel} | \`${outputName}\` | ${conflict} |`);
			} else {
				filtered.push(`| ${i + 1} | _(deleted config)_ | — | — | — |`);
			}
		}
		filtered.push("");
	}

	if (pipeline.createBase && pipeline.basePath) {
		filtered.push("## Base View", "");
		filtered.push(`Linked base view: [[${pipeline.basePath}]]`, "");
	}

	filtered.push("## Related", "");
	filtered.push(`- **Target folder**: \`${pipeline.targetFolder}\``);
	if (pipeline.sources.length > 0) {
		filtered.push("- **Source files**:");
		for (const source of pipeline.sources) {
			const csvName = basename(source.csvPath) || source.csvPath;
			filtered.push(`  - [[${source.csvPath}|${csvName}]]`);
		}
	}
	if (pipeline.exportConfigIds && pipeline.exportConfigIds.length > 0) {
		filtered.push("- **Export configs**:");
		for (const exportId of pipeline.exportConfigIds) {
			const exportCfg = ctx.getExportConfig(exportId);
			if (exportCfg) {
				const cfgSafe = sanitizeDocName(exportCfg.name);
				filtered.push(`  - [[Export - ${cfgSafe}|${exportCfg.name}]]`);
			}
		}
	}
	filtered.push("");

	if (userNotes !== undefined) {
		filtered.push("## Notes", "", userNotes);
	} else {
		filtered.push("## Notes", "", "> Document usage notes, scheduling, or workflow context.", "");
	}

	return filtered.join("\n");
}

export interface TypeDocContext {
	docsRoot: string;
	pipelines: Array<{ name: string; sources: Array<{ columnMappings: Array<{ included: boolean }> }> }>;
	importConfigs: Array<{ name: string }>;
	exportConfigs: Array<{ name: string }>;
}

export function buildTypeDocContent(
	typeName: string,
	properties: string[],
	ctx: TypeDocContext,
	userNotes?: string,
): string {
	const now = new Date().toISOString();
	const totalConfigs = ctx.pipelines.length + ctx.importConfigs.length + ctx.exportConfigs.length;

	const lines: string[] = [
		"---",
		"type: TypeDoc",
		`name: "${typeName}"`,
		`description: ""`,
		`properties: [${properties.map((p) => `"${p}"`).join(", ")}]`,
		`pipelines: ${totalConfigs}`,
		`created: "${now}"`,
		"---",
		"",
		`# ${typeName}`,
		"",
		"> Note type definition.",
		"",
		"## Overview",
		"",
		`- **Type**: \`${typeName}\``,
		`- **Expected Properties**: ${properties.length}`,
		`- **Used by Configs**: ${totalConfigs}`,
		"",
	];

	if (properties.length > 0) {
		lines.push("## Expected Properties", "");
		lines.push("| Property | Documented |");
		lines.push("| -------- | ---------- |");
		for (const prop of properties) {
			const propDocPath = getPropertyDocPath(ctx.docsRoot, prop);
			const propDocName = stripExtension(basename(propDocPath), ".md") || prop;
			lines.push(`| [[${propDocName}\\|${prop}]] | — |`);
		}
		lines.push("");
	}

	if (totalConfigs > 0) {
		lines.push("## Configs", "");
		for (const pipe of ctx.pipelines) {
			const pipeDocPath = getPipelineDocPath(ctx.docsRoot, pipe.name);
			const pipeDocName = stripExtension(basename(pipeDocPath), ".md") || pipe.name;
			lines.push(`- [[${pipeDocName}\\|${pipe.name}]] — Pipeline (${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""})`);
		}
		for (const cfg of ctx.importConfigs) {
			const docPath = getConfigDocPath(ctx.docsRoot, cfg.name, "import");
			const docName = stripExtension(basename(docPath), ".md") || cfg.name;
			lines.push(`- [[${docName}\\|${cfg.name}]] — Import`);
		}
		for (const cfg of ctx.exportConfigs) {
			const docPath = getConfigDocPath(ctx.docsRoot, cfg.name, "export");
			const docName = stripExtension(basename(docPath), ".md") || cfg.name;
			lines.push(`- [[${docName}\\|${cfg.name}]] — Export`);
		}
		lines.push("");
	}

	// Lifecycle event wikilinks
	const lowerType = typeName.toLowerCase();
	const crudSuffixes = [
		{ suffix: "created", label: "Created" },
		{ suffix: "read", label: "Read" },
		{ suffix: "updated", label: "Updated" },
		{ suffix: "deleted", label: "Deleted" },
	];
	lines.push("## Lifecycle Events", "");
	for (const crud of crudSuffixes) {
		const eventType = `${lowerType}.${crud.suffix}`;
		lines.push(`- [[${eventType}\\|${eventType}]] — ${crud.label}`);
	}
	lines.push("");

	if (userNotes !== undefined) {
		lines.push("## Notes", "", userNotes);
	} else {
		lines.push("## Notes", "", "> Describe this type, its purpose, and usage guidelines.", "");
	}

	return lines.join("\n");
}
