/**
 * Config documentation service — orchestrates doc creation, user-note preservation,
 * and event emission.
 *
 * Content generation is delegated to {@link configDocContent}.
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
import {
	sanitizeDocName,
	getConfigsFolder,
	getReportsFolder,
	getPropertiesFolder,
	getTypesFolder,
	getCsvDocPath as _getCsvDocPath,
	getConfigDocPath as _getConfigDocPath,
	getPropertyDocPath as _getPropertyDocPath,
	getPipelineDocPath as _getPipelineDocPath,
	getEventDocPath as _getEventDocPath,
	getTypeDocPath as _getTypeDocPath,
	buildCsvDocContent,
	buildPropertyDocContent,
	buildImportDocContent,
	buildExportDocContent,
	buildPipelineDocContent,
	buildTypeDocContent,
} from "./configDocContent";

export interface ConfigDocServiceDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
	getDocsRootPath: () => string;
	getState: () => Readonly<DataExchangeState>;
	getExportConfig: (id: string) => SavedExportConfig | undefined;
	buildDataDictionary: () => DataDictionaryEntry[];
}

/** Default placeholder for user notes in generated docs. */
const DEFAULT_NOTES_PLACEHOLDER = "> Document usage notes, scheduling, or workflow context.";
const RE_NOTES_SECTION = /## Notes\n\n([\s\S]*?)$/;

export class ConfigDocService {
	constructor(private deps: ConfigDocServiceDeps) {}

	// ── Path accessors (public) ──────────────────────────────

	getConfigsFolderPath(): string {
		return getConfigsFolder(this.deps.getDocsRootPath());
	}

	getReportsFolderPath(): string {
		return getReportsFolder(this.deps.getDocsRootPath());
	}

	getPropertiesFolderPath(): string {
		return getPropertiesFolder(this.deps.getDocsRootPath());
	}

	getTypesFolderPath(): string {
		return getTypesFolder(this.deps.getDocsRootPath());
	}

	getCsvDocPath(csvPath: string): string {
		return _getCsvDocPath(this.deps.getDocsRootPath(), csvPath);
	}

	getConfigDocPath(
		configName: string,
		configType: "import" | "export",
	): string {
		return _getConfigDocPath(this.deps.getDocsRootPath(), configName, configType);
	}

	getPropertyDocPath(propertyName: string): string {
		return _getPropertyDocPath(this.deps.getDocsRootPath(), propertyName);
	}

	getPipelineDocPath(pipelineName: string): string {
		return _getPipelineDocPath(this.deps.getDocsRootPath(), pipelineName);
	}

	getEventDocPath(eventType: string): string {
		return _getEventDocPath(this.deps.getDocsRootPath(), eventType);
	}

	getTypeDocPath(typeName: string): string {
		return _getTypeDocPath(this.deps.getDocsRootPath(), typeName);
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
		const content = buildCsvDocContent(csvPath, headers, rowCount, delimiter);

		await this.deps.eventBus.emit("doc.create", {
			docType: "CsvDoc" as const,
			name: basename,
			path: docPath,
			content,
			source: "ConfigDocService",
		});
		return docPath;
	}

	// ── Property doc ─────────────────────────────────────────

	async createPropertyDoc(propertyName: string): Promise<string> {
		const docPath = this.getPropertyDocPath(propertyName);
		const entry = this.deps.buildDataDictionary().find((e) => e.propertyName === propertyName);
		const state = this.deps.getState();

		const content = buildPropertyDocContent(
			propertyName,
			this.deps.getDocsRootPath(),
			entry,
			state.savedImportConfigs,
			state.savedExportConfigs,
		);

		await this.deps.eventBus.emit("doc.create", {
			docType: "PropertyDoc" as const,
			name: propertyName,
			path: docPath,
			content,
			source: "ConfigDocService",
		});
		return docPath;
	}

	// ── Import config doc ────────────────────────────────────

	async createImportConfigDoc(config: SavedImportConfig): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const path = this.getConfigDocPath(config.name, "import");
			const userNotes = await this.preserveUserNotes(path);
			const content = buildImportDocContent(config, userNotes);

			await this.deps.eventBus.emit("doc.create", {
				docType: "ImportConfigDoc" as const,
				name: config.name,
				path,
				content,
				upsert: true,
				source: "ConfigDocService",
			});
		} catch (error) {
			console.error("[Flowti] Failed to create import config doc", error);
		}
	}

	// ── Export config doc ────────────────────────────────────

	async createExportConfigDoc(config: SavedExportConfig): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const path = this.getConfigDocPath(config.name, "export");
			const userNotes = await this.preserveUserNotes(path);
			const content = buildExportDocContent(config, userNotes);

			await this.deps.eventBus.emit("doc.create", {
				docType: "ExportConfigDoc" as const,
				name: config.name,
				path,
				content,
				upsert: true,
				source: "ConfigDocService",
			});
		} catch (error) {
			console.error("[Flowti] Failed to create export config doc", error);
		}
	}

	// ── Pipeline config doc ──────────────────────────────────

	async createPipelineConfigDoc(pipeline: SavedMultiImportPipeline): Promise<void> {
		if (!this.deps.getDocsRootPath()) return;
		try {
			const path = this.getPipelineDocPath(pipeline.name);
			const userNotes = await this.preserveUserNotes(path);
			const content = buildPipelineDocContent(
				pipeline,
				{
					getExportConfig: (id) => this.deps.getExportConfig(id),
					docsRoot: this.deps.getDocsRootPath(),
				},
				userNotes,
			);

			await this.deps.eventBus.emit("doc.create", {
				docType: "PipelineConfigDoc" as const,
				name: pipeline.name,
				path,
				content,
				upsert: true,
				source: "ConfigDocService",
			});
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
			const docsRoot = this.deps.getDocsRootPath();

			const userNotes = await this.preserveUserNotes(
				path,
				"> Describe this type, its purpose, and usage guidelines.",
			);

			const content = buildTypeDocContent(
				typeName,
				properties,
				{
					docsRoot,
					pipelines: (state.savedPipelines ?? []).filter((p) => p.noteType === typeName),
					importConfigs: state.savedImportConfigs.filter((c) => c.noteType === typeName),
					exportConfigs: state.savedExportConfigs.filter((c) => c.noteType === typeName),
				},
				userNotes,
			);

			await this.deps.eventBus.emit("doc.create", {
				docType: "TypeDoc" as const,
				name: typeName,
				path,
				content,
				upsert: true,
				source: "ConfigDocService",
			});
			await this.createTypeEventDocs(typeName);
		} catch (error) {
			console.error("[Flowti] Failed to create type doc", error);
		}
	}

	// ── Event doc emission ───────────────────────────────────

	private async createTypeEventDocs(typeName: string): Promise<void> {
		const lowerType = typeName.toLowerCase();
		const typeDocName = `Type - ${sanitizeDocName(typeName)}`;

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
		const configDocName = `${prefix} - ${sanitizeDocName(configName)}`;

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

	// ── Private helpers ──────────────────────────────────────

	/**
	 * Reads an existing doc and extracts user-written Notes section content,
	 * returning it only if the user replaced the default placeholder.
	 */
	private async preserveUserNotes(
		path: string,
		defaultPlaceholder = DEFAULT_NOTES_PLACEHOLDER,
	): Promise<string | undefined> {
		try {
			const existing = await this.deps.fileSystem.readFile(path);
			const notesMatch = existing.match(RE_NOTES_SECTION);
			if (notesMatch) {
				const notes = notesMatch[1].trim();
				if (notes && notes !== defaultPlaceholder) {
					return notesMatch[1];
				}
			}
		} catch {
			// File doesn't exist yet — that's fine
		}
		return undefined;
	}
}
