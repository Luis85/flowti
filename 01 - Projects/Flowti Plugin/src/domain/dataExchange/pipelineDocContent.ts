/**
 * Pure functions for generating Pipeline doc markdown content.
 * Extracted from configDocContent to reduce file size.
 */

import { basename } from "../../utils/pathUtils";
import type { SavedExportConfig, SavedMultiImportPipeline } from "./types";
import { sanitizeDocName } from "./configDocContent";

export interface PipelineDocContext {
	getExportConfig: (id: string) => SavedExportConfig | undefined;
	docsRoot: string;
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

/** Build the Sources section for a pipeline doc. */
function buildPipelineSources(
	pipeline: SavedMultiImportPipeline,
	lines: string[],
): void {
	if (pipeline.sources.length === 0) return;
	lines.push("## Sources", "");
	for (const source of pipeline.sources) {
		const csvName = basename(source.csvPath) || source.csvPath;
		const included = source.columnMappings.filter((m) => m.included);
		lines.push(`### [[${source.csvPath}|${csvName}]]`, "");
		lines.push(`- **Merge Key Column**: \`${source.mergeKeyColumn}\` → \`${pipeline.mergeKey}\``);
		lines.push(`- **Mapped Columns**: ${included.length} of ${source.columnMappings.length}`);
		if (source.customProperties && Object.keys(source.customProperties).length > 0) {
			lines.push(`- **Custom Properties**: ${Object.entries(source.customProperties).map(([k, v]) => `\`${k}\`=\`${v}\``).join(", ")}`);
		}
		if (included.length > 0) {
			lines.push("");
			lines.push("| CSV Column | Frontmatter Key |");
			lines.push("| ---------- | --------------- |");
			for (const m of included) {
				lines.push(`| ${m.csvColumn} | \`${m.frontmatterKey}\` |`);
			}
		}
		lines.push("");
	}
}

/** Build the Export Steps table for a pipeline doc. */
function buildPipelineExportSteps(
	exportConfigIds: string[],
	ctx: PipelineDocContext,
	lines: string[],
): void {
	if (exportConfigIds.length === 0) return;
	lines.push("## Export Steps", "");
	lines.push("| # | Config | Format | Output | Conflict |");
	lines.push("| - | ------ | ------ | ------ | -------- |");
	for (let i = 0; i < exportConfigIds.length; i++) {
		const exportCfg = ctx.getExportConfig(exportConfigIds[i]);
		if (exportCfg) {
			const cfgSafe = sanitizeDocName(exportCfg.name);
			const formatLabel = exportCfg.format === "tab" ? "Tab" : "CSV";
			const outputName = basename(exportCfg.outputPath) || exportCfg.outputPath;
			const conflict = exportCfg.conflictStrategy ?? "overwrite";
			lines.push(`| ${i + 1} | [[Export - ${cfgSafe}\\|${exportCfg.name}]] | ${formatLabel} | \`${outputName}\` | ${conflict} |`);
		} else {
			lines.push(`| ${i + 1} | _(deleted config)_ | — | — | — |`);
		}
	}
	lines.push("");
}

/** Build the Related section for a pipeline doc. */
function buildPipelineRelated(
	pipeline: SavedMultiImportPipeline,
	ctx: PipelineDocContext,
	lines: string[],
): void {
	lines.push("## Related", "");
	lines.push(`- **Target folder**: \`${pipeline.targetFolder}\``);
	if (pipeline.sources.length > 0) {
		lines.push("- **Source files**:");
		for (const source of pipeline.sources) {
			const csvName = basename(source.csvPath) || source.csvPath;
			lines.push(`  - [[${source.csvPath}|${csvName}]]`);
		}
	}
	const exportIds = pipeline.exportConfigIds ?? [];
	if (exportIds.length > 0) {
		lines.push("- **Export configs**:");
		for (const exportId of exportIds) {
			const exportCfg = ctx.getExportConfig(exportId);
			if (exportCfg) {
				const cfgSafe = sanitizeDocName(exportCfg.name);
				lines.push(`  - [[Export - ${cfgSafe}|${exportCfg.name}]]`);
			}
		}
	}
	lines.push("");
}

/** Build the frontmatter and settings header for a pipeline doc. */
function buildPipelineHeader(
	pipeline: SavedMultiImportPipeline,
	ctx: PipelineDocContext,
): string[] {
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
	return filterEmptyPlaceholders(lines);
}

export function buildPipelineDocContent(
	pipeline: SavedMultiImportPipeline,
	ctx: PipelineDocContext,
	userNotes?: string,
): string {
	const filtered = buildPipelineHeader(pipeline, ctx);

	buildPipelineSources(pipeline, filtered);
	buildPipelineExportSteps(pipeline.exportConfigIds ?? [], ctx, filtered);

	if (pipeline.createBase && pipeline.basePath) {
		filtered.push("## Base View", "");
		filtered.push(`Linked base view: [[${pipeline.basePath}]]`, "");
	}

	buildPipelineRelated(pipeline, ctx, filtered);
	appendNotesSection(filtered, userNotes);

	return filtered.join("\n");
}
