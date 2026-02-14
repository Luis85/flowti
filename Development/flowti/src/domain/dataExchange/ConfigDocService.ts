/**
 * Config documentation service — all doc generation, path resolution, event doc emission.
 *
 * Extracted from DataExchangeService to reduce its LOC.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { EventDocMeta } from "../discovery/types";
import type {
	DataDictionaryEntry,
	DataExchangeState,
	SavedImportConfig,
	SavedExportConfig,
	SavedMultiImportPipeline,
} from "./types";

export interface ConfigDocServiceDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
	getDocsRootPath: () => string;
	getState: () => Readonly<DataExchangeState>;
	getExportConfig: (id: string) => SavedExportConfig | undefined;
	buildDataDictionary: () => DataDictionaryEntry[];
}

export class ConfigDocService {
	constructor(private deps: ConfigDocServiceDeps) {}

	// ── Path helpers (private) ───────────────────────────────

	private getConfigsFolder(): string {
		const base = this.deps.getDocsRootPath().replace(/\/+$/, "");
		return `${base}/Configs`;
	}

	private getReportsFolder(): string {
		const base = this.deps.getDocsRootPath().replace(/\/+$/, "");
		return `${base}/Reports`;
	}

	private getPropertiesFolder(): string {
		const base = this.deps.getDocsRootPath().replace(/\/+$/, "");
		return `${base}/Properties`;
	}

	private getTypesFolder(): string {
		const base = this.deps.getDocsRootPath().replace(/\/+$/, "");
		return `${base}/Types`;
	}

	private sanitizeDocName(name: string): string {
		return name.replace(/[\\/:*?"<>|#^[\]]/g, "").replace(/\s+/g, " ").trim();
	}

	// ── Path accessors (public) ──────────────────────────────

	getConfigsFolderPath(): string {
		return this.getConfigsFolder();
	}

	getReportsFolderPath(): string {
		return this.getReportsFolder();
	}

	getPropertiesFolderPath(): string {
		return this.getPropertiesFolder();
	}

	getTypesFolderPath(): string {
		return this.getTypesFolder();
	}

	getCsvDocPath(csvPath: string): string {
		const folder = this.getReportsFolder();
		const basename = csvPath.split("/").pop()?.replace(/\.csv$/i, "") ?? "csv";
		const safeName = this.sanitizeDocName(basename);
		return `${folder}/CSV - ${safeName}.md`;
	}

	getConfigDocPath(
		configName: string,
		configType: "import" | "export",
	): string {
		const folder = this.getConfigsFolder();
		const safeName = this.sanitizeDocName(configName);
		const prefix = configType === "import" ? "Import" : "Export";
		return `${folder}/${prefix} - ${safeName}.md`;
	}

	getPropertyDocPath(propertyName: string): string {
		const folder = this.getPropertiesFolder();
		const safeName = this.sanitizeDocName(propertyName);
		return `${folder}/Property - ${safeName}.md`;
	}

	getPipelineDocPath(pipelineName: string): string {
		const folder = this.getConfigsFolder();
		const safeName = this.sanitizeDocName(pipelineName);
		return `${folder}/Pipeline - ${safeName}.md`;
	}

	getEventDocPath(eventType: string): string {
		const base = this.deps.getDocsRootPath().replace(/\/+$/, "");
		return `${base}/Events/${eventType}.md`;
	}

	getTypeDocPath(typeName: string): string {
		const folder = this.getTypesFolder();
		const safeName = this.sanitizeDocName(typeName);
		return `${folder}/Type - ${safeName}.md`;
	}

	// ── CSV doc ──────────────────────────────────────────────

	async createCsvDoc(
		csvPath: string,
		headers: string[],
		rowCount: number,
		delimiter?: string,
	): Promise<string> {
		const docPath = this.getCsvDocPath(csvPath);
		const basename = csvPath.split("/").pop() ?? "file.csv";
		const now = new Date().toISOString();

		const lines: string[] = [
			"---",
			"type: CsvDoc",
			`csvFile: "[[${basename}]]"`,
			`filePath: "${csvPath}"`,
			`name: "${basename}"`,
			`description: ""`,
			`columns: ${headers.length}`,
			`rows: ${rowCount}`,
			`delimiter: "${delimiter ?? ","}"`,
			`headers: [${headers.map((h) => `"${h}"`).join(", ")}]`,
			`created: "${now}"`,
			"---",
			"",
			`# ${basename}`,
			"",
			"> CSV file documentation.",
			"",
			"## Overview",
			"",
			`- **File**: [[${basename}]]`,
			`- **Columns**: ${headers.length}`,
			`- **Rows**: ${rowCount}`,
			"",
			"## Notes",
			"",
			"> Document usage notes, data source, or workflow context.",
			"",
		];

		await this.deps.fileSystem.createFile(docPath, lines.join("\n"), { createFolders: true });
		return docPath;
	}

	// ── Property doc ─────────────────────────────────────────

	async createPropertyDoc(propertyName: string): Promise<string> {
		const docPath = this.getPropertyDocPath(propertyName);
		const entry = this.deps.buildDataDictionary().find((e) => e.propertyName === propertyName);
		const now = new Date().toISOString();
		const state = this.deps.getState();

		const csvColumns = entry?.csvColumnNames ?? [];
		const configRefs = entry?.usedInConfigs ?? [];

		// Collect wikilinks to all relevant files
		const relatedFiles = new Set<string>();
		const configDocLinks: string[] = [];

		for (const ref of configRefs) {
			// Config doc
			const configDocPath = this.getConfigDocPath(ref.configName, ref.configType);
			const configDocName = configDocPath.split("/").pop()?.replace(/\.md$/, "") ?? ref.configName;
			configDocLinks.push(`- [[${configDocName}]]`);

			if (ref.configType === "import") {
				const cfg = state.savedImportConfigs.find((c) => c.id === ref.configId);
				if (cfg) {
					if (cfg.sourcePath) relatedFiles.add(cfg.sourcePath);
					if (cfg.basePath) relatedFiles.add(cfg.basePath);
				}
			} else {
				const cfg = state.savedExportConfigs.find((c) => c.id === ref.configId);
				if (cfg) {
					relatedFiles.add(cfg.sourcePath);
					if (!cfg.isExternal) relatedFiles.add(cfg.outputPath);
				}
			}
		}

		// Build CSV report doc links
		const reportLinks: string[] = [];
		for (const filePath of relatedFiles) {
			if (filePath.toLowerCase().endsWith(".csv")) {
				const reportDocPath = this.getCsvDocPath(filePath);
				const reportDocName = reportDocPath.split("/").pop()?.replace(/\.md$/, "") ?? filePath;
				reportLinks.push(`- [[${reportDocName}]]`);
			}
		}

		// Build file wikilinks
		const fileLinks = [...relatedFiles].map((f) => {
			const name = f.split("/").pop() ?? f;
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

		await this.deps.fileSystem.createFile(docPath, lines.join("\n"), { createFolders: true });
		return docPath;
	}

	// ── Import config doc ────────────────────────────────────

	private buildImportDocContent(config: SavedImportConfig, userNotes?: string): string {
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
			config.noteType ? `| **Note Type**     | [[Type - ${this.sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
			config.sourcePath ? `| **Source CSV**    | [[${config.sourcePath}\\|${config.sourcePath.split("/").pop()}]] |` : "",
			"",
		];

		// Remove empty lines from conditional entries
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

	async createImportConfigDoc(config: SavedImportConfig): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(config.name);
			const path = `${folder}/Import - ${safeName}.md`;

			// Try to preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.deps.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					if (notes && notes !== "> Document usage notes, scheduling, or workflow context.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet — that's fine
			}

			const content = this.buildImportDocContent(config, userNotes);

			try {
				await this.deps.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				// File already exists — update it
				await this.deps.fileSystem.updateFile(path, content);
			}
		} catch (error) {
			console.error("[Flowti] Failed to create import config doc", error);
		}
	}

	// ── Export config doc ────────────────────────────────────

	private buildExportDocContent(config: SavedExportConfig, userNotes?: string): string {
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
			`| **Source**        | [[${config.sourcePath}\\|${config.sourcePath.split("/").pop()}]] |`,
			`| **Source Type**   | ${config.sourceType} |`,
			`| **Format**       | ${formatLabel} |`,
			`| **Output**       | \`${config.outputPath}\` |`,
			`| **Conflict**     | ${config.conflictStrategy ?? "overwrite"} |`,
			config.isExternal ? `| **External**     | Yes |` : "",
			config.noteType ? `| **Note Type**    | [[Type - ${this.sanitizeDocName(config.noteType)}\\|${config.noteType}]] |` : "",
			"",
		];

		// Remove empty lines from conditional entries
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

	async createExportConfigDoc(config: SavedExportConfig): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(config.name);
			const path = `${folder}/Export - ${safeName}.md`;

			// Try to preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.deps.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					if (notes && notes !== "> Document usage notes, scheduling, or workflow context.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet — that's fine
			}

			const content = this.buildExportDocContent(config, userNotes);

			try {
				await this.deps.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				// File already exists — update it
				await this.deps.fileSystem.updateFile(path, content);
			}
		} catch (error) {
			console.error("[Flowti] Failed to create export config doc", error);
		}
	}

	// ── Pipeline config doc ──────────────────────────────────

	private buildPipelineDocContent(pipeline: SavedMultiImportPipeline, userNotes?: string): string {
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
			pipeline.noteType ? `| **Note Type**     | [[Type - ${this.sanitizeDocName(pipeline.noteType)}\\|${pipeline.noteType}]] |` : "",
			pipeline.namePrefix ? `| **Name Prefix**   | \`${pipeline.namePrefix}\` |` : "",
			pipeline.nameSuffix ? `| **Name Suffix**   | \`${pipeline.nameSuffix}\` |` : "",
			pipeline.exportConfigIds?.length ? `| **Export Steps**  | ${pipeline.exportConfigIds.map((id) => this.deps.getExportConfig(id)?.name ?? id).join(", ")} |` : "",
			lastRun ? `| **Last Run**      | ${lastRun} |` : "",
			"",
		];

		// Remove empty lines from conditional entries in frontmatter/table
		const filtered = lines.filter((l) => l !== "" || lines.indexOf(l) > 10);

		if (pipeline.sources.length > 0) {
			filtered.push("## Sources", "");
			for (const source of pipeline.sources) {
				const csvName = source.csvPath.split("/").pop() ?? source.csvPath;
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
				const exportCfg = this.deps.getExportConfig(pipeline.exportConfigIds[i]);
				if (exportCfg) {
					const cfgSafe = this.sanitizeDocName(exportCfg.name);
					const formatLabel = exportCfg.format === "tab" ? "Tab" : "CSV";
					const outputName = exportCfg.outputPath.split("/").pop() ?? exportCfg.outputPath;
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
				const csvName = source.csvPath.split("/").pop() ?? source.csvPath;
				filtered.push(`  - [[${source.csvPath}|${csvName}]]`);
			}
		}
		if (pipeline.exportConfigIds && pipeline.exportConfigIds.length > 0) {
			filtered.push("- **Export configs**:");
			for (const exportId of pipeline.exportConfigIds) {
				const exportCfg = this.deps.getExportConfig(exportId);
				if (exportCfg) {
					const cfgSafe = this.sanitizeDocName(exportCfg.name);
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

	async createPipelineConfigDoc(pipeline: SavedMultiImportPipeline): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const folder = this.getConfigsFolder();
			const safeName = this.sanitizeDocName(pipeline.name);
			const path = `${folder}/Pipeline - ${safeName}.md`;

			// Try to preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.deps.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					// Only preserve if user replaced the default placeholder
					if (notes && notes !== "> Document usage notes, scheduling, or workflow context.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet — that's fine
			}

			const content = this.buildPipelineDocContent(pipeline, userNotes);

			try {
				await this.deps.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				// File already exists — update it
				await this.deps.fileSystem.updateFile(path, content);
			}
		} catch (error) {
			console.error("[Flowti] Failed to create pipeline config doc", error);
		}
	}

	// ── Ensure doc (recreate if deleted) ─────────────────────

	async ensureConfigDoc(
		configName: string,
		configType: "import" | "export",
	): Promise<string> {
		const path = this.getConfigDocPath(configName, configType);
		const state = this.deps.getState();
		if (configType === "import") {
			const cfg = state.savedImportConfigs.find((c) => c.name === configName);
			if (cfg) await this.createImportConfigDoc(cfg);
		} else {
			const cfg = state.savedExportConfigs.find((c) => c.name === configName);
			if (cfg) await this.createExportConfigDoc(cfg);
		}
		return path;
	}

	async ensurePipelineDoc(pipelineId: string): Promise<string> {
		const pipe = (this.deps.getState().savedPipelines ?? []).find((p) => p.id === pipelineId);
		if (pipe) {
			await this.createPipelineConfigDoc(pipe);
			return this.getPipelineDocPath(pipe.name);
		}
		return "";
	}

	// ── TypeDoc CRUD ─────────────────────────────────────────

	async createOrUpdateTypeDoc(typeName: string): Promise<void> {
		const state = this.deps.getState();
		const properties = new Set<string>();

		// Collect from pipelines
		for (const pipe of state.savedPipelines ?? []) {
			if (pipe.noteType !== typeName) continue;
			properties.add(pipe.mergeKey);
			for (const src of pipe.sources) {
				for (const m of src.columnMappings) {
					if (m.included) properties.add(m.frontmatterKey);
				}
				if (src.customProperties) {
					for (const key of Object.keys(src.customProperties)) {
						properties.add(key);
					}
				}
			}
		}

		// Collect from import configs
		for (const cfg of state.savedImportConfigs) {
			if (cfg.noteType !== typeName) continue;
			for (const m of cfg.columnMappings) {
				if (m.included) properties.add(m.frontmatterKey);
			}
			if (cfg.customProperties) {
				for (const key of Object.keys(cfg.customProperties)) {
					properties.add(key);
				}
			}
		}

		// Collect from export configs (column names = expected properties)
		for (const cfg of state.savedExportConfigs) {
			if (cfg.noteType !== typeName) continue;
			for (const col of cfg.columns) {
				properties.add(col);
			}
		}

		await this.createTypeDoc(typeName, [...properties].sort());
	}

	private async createTypeDoc(typeName: string, properties: string[]): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const path = this.getTypeDocPath(typeName);
			const state = this.deps.getState();

			// Preserve user-written notes from existing doc
			let userNotes: string | undefined;
			try {
				const existing = await this.deps.fileSystem.readFile(path);
				const notesMatch = existing.match(/## Notes\n\n([\s\S]*?)$/);
				if (notesMatch) {
					const notes = notesMatch[1].trim();
					if (notes && notes !== "> Describe this type, its purpose, and usage guidelines.") {
						userNotes = notesMatch[1];
					}
				}
			} catch {
				// File doesn't exist yet
			}

			const now = new Date().toISOString();

			// Find configs that use this type
			const pipelines = (state.savedPipelines ?? []).filter(
				(p) => p.noteType === typeName,
			);
			const importConfigs = state.savedImportConfigs.filter(
				(c) => c.noteType === typeName,
			);
			const exportConfigs = state.savedExportConfigs.filter(
				(c) => c.noteType === typeName,
			);
			const totalConfigs = pipelines.length + importConfigs.length + exportConfigs.length;

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
					const propDocPath = this.getPropertyDocPath(prop);
					const propDocName = propDocPath.split("/").pop()?.replace(/\.md$/, "") ?? prop;
					lines.push(`| [[${propDocName}\\|${prop}]] | — |`);
				}
				lines.push("");
			}

			if (totalConfigs > 0) {
				lines.push("## Configs", "");
				for (const pipe of pipelines) {
					const pipeDocPath = this.getPipelineDocPath(pipe.name);
					const pipeDocName = pipeDocPath.split("/").pop()?.replace(/\.md$/, "") ?? pipe.name;
					lines.push(`- [[${pipeDocName}\\|${pipe.name}]] — Pipeline (${pipe.sources.length} source${pipe.sources.length !== 1 ? "s" : ""})`);
				}
				for (const cfg of importConfigs) {
					const docPath = this.getConfigDocPath(cfg.name, "import");
					const docName = docPath.split("/").pop()?.replace(/\.md$/, "") ?? cfg.name;
					lines.push(`- [[${docName}\\|${cfg.name}]] — Import`);
				}
				for (const cfg of exportConfigs) {
					const docPath = this.getConfigDocPath(cfg.name, "export");
					const docName = docPath.split("/").pop()?.replace(/\.md$/, "") ?? cfg.name;
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

			const content = lines.join("\n");

			try {
				await this.deps.fileSystem.createFile(path, content, { createFolders: true });
			} catch {
				await this.deps.fileSystem.updateFile(path, content);
			}
			// Create CRUD event docs for this type
			await this.createTypeEventDocs(typeName);
		} catch (error) {
			console.error("[Flowti] Failed to create type doc", error);
		}
	}

	// ── Event doc emission ───────────────────────────────────

	private async createTypeEventDocs(typeName: string): Promise<void> {
		const lowerType = typeName.toLowerCase();
		const typeDocName = `Type - ${this.sanitizeDocName(typeName)}`;

		const crudDefs = [
			{ suffix: "created", label: "Created", desc: `A new ${typeName} was added` },
			{ suffix: "read", label: "Read", desc: `A ${typeName} was viewed or queried` },
			{ suffix: "updated", label: "Updated", desc: `An existing ${typeName} was modified` },
			{ suffix: "deleted", label: "Deleted", desc: `A ${typeName} was removed` },
		];

		for (const def of crudDefs) {
			const eventType = `${lowerType}.${def.suffix}`;
			const siblings = crudDefs
				.filter((d) => d.suffix !== def.suffix)
				.map((d) => `- [[${lowerType}.${d.suffix}\\|${lowerType}.${d.suffix}]] — ${d.desc}`);

			const docMeta: EventDocMeta = {
				description: def.desc,
				domain: "Types",
				services: "DataExchange",
				direction: "outbound",
				stability: "draft",
				visibility: "public",
				relatedEvents: siblings,
				extraSections: [
					`**Type**: [[${typeDocName}\\|${typeName}]]`,
				],
			};

			void this.deps.eventBus.emit("discovery.create", {
				eventName: eventType,
				category: typeName,
				docMeta,
			});
		}
	}

	createConfigEventDocs(
		configName: string,
		configType: "pipeline" | "import" | "export",
	): void {
		const safeName = configName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
		if (!safeName) return;

		const prefix = configType === "pipeline" ? "Pipeline" : configType === "import" ? "Import" : "Export";
		const configDocName = `${prefix} - ${this.sanitizeDocName(configName)}`;

		const crudDefs = [
			{ suffix: "created", label: "Created", desc: `A new ${configName} record was created` },
			{ suffix: "read", label: "Read", desc: `A ${configName} record was viewed or queried` },
			{ suffix: "updated", label: "Updated", desc: `An existing ${configName} record was modified` },
			{ suffix: "deleted", label: "Deleted", desc: `A ${configName} record was removed` },
		];

		for (const def of crudDefs) {
			const eventType = `${safeName}.${def.suffix}`;
			const siblings = crudDefs
				.filter((d) => d.suffix !== def.suffix)
				.map((d) => `- [[${safeName}.${d.suffix}\\|${safeName}.${d.suffix}]] — ${d.desc}`);

			const docMeta: EventDocMeta = {
				description: def.desc,
				domain: "Data Exchange",
				services: "DataExchange",
				direction: "outbound",
				stability: "draft",
				visibility: "public",
				relatedEvents: siblings,
				extraSections: [
					`**Config**: [[${configDocName}\\|${configName}]]`,
				],
			};

			void this.deps.eventBus.emit("discovery.create", {
				eventName: eventType,
				category: configName,
				docMeta,
			});
		}
	}
}
