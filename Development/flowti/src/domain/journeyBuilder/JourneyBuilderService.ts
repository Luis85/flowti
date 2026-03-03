/**
 * JourneyBuilderService — handles export and canvas sync for journey definitions.
 *
 * Listens for:
 *   - `journey-builder.exported` → writes journey JSON, test executor, and canvas to vault
 *   - `journey-builder.canvas.sync-requested` → writes companion .canvas file
 */
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyExportPayload } from "./events";
import type { CanvasSyncInput } from "./canvasSync";
import { buildJourneyCanvas } from "./canvasSync";

export interface JourneyBuilderServiceDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
	getSettings: () => { journeyFolder: string };
}

export class JourneyBuilderService {
	private readonly fileSystem: IFileSystemClient;
	private readonly eventBus: IEventBus;
	private readonly getSettings: () => { journeyFolder: string };
	private unsubExport: (() => void) | undefined;
	private unsubCanvasSync: (() => void) | undefined;
	private unsubImport: (() => void) | undefined;
	private unsubListFiles: (() => void) | undefined;

	constructor(deps: JourneyBuilderServiceDeps) {
		this.fileSystem = deps.fileSystem;
		this.eventBus = deps.eventBus;
		this.getSettings = deps.getSettings;
	}

	/** Starts listening for export and canvas sync events. */
	start(): void {
		this.unsubExport = this.eventBus.on(
			"journey-builder.exported",
			(event) => void this.handleExport(event.payload),
		);
		this.unsubCanvasSync = this.eventBus.on(
			"journey-builder.canvas.sync-requested",
			(event) => void this.handleCanvasSync(event.payload),
		);
		this.unsubImport = this.eventBus.on(
			"journey-builder.import-requested",
			(event) => void this.handleImport(event.payload),
		);
		this.unsubListFiles = this.eventBus.on(
			"journey-builder.list-files.requested",
			() => void this.handleListFiles(),
		);
	}

	/** Stops listening. */
	stop(): void {
		this.unsubExport?.();
		this.unsubExport = undefined;
		this.unsubCanvasSync?.();
		this.unsubCanvasSync = undefined;
		this.unsubImport?.();
		this.unsubImport = undefined;
		this.unsubListFiles?.();
		this.unsubListFiles = undefined;
	}

	/** Builds the JSON content from an export payload. */
	buildDefinitionJSON(payload: JourneyExportPayload): string {
		const { definition } = payload;
		const output = {
			journey: definition.journey,
			description: definition.description,
			startEvent: definition.startEvent,
			endEvent: definition.endEvent,
			tools: [] as string[],
			setup: [],
			steps: definition.steps.map((s) => ({
				id: s.id,
				title: s.title,
				description: s.description,
				swimlane: s.swimlane,
				guideSection: s.guideSection,
				events: [definition.startEvent],
				actions: s.actions ?? [],
			})),
			teardown: [],
		};
		return JSON.stringify(output, null, "\t");
	}

	/** Generates a test executor .ts file from a journey name and JSON filename. */
	buildTestExecutor(journeyName: string, jsonFileName: string): string {
		return [
			"/**",
			` * E2E Journey: ${journeyName}`,
			" *",
			` * Driven by declarative JSON — see journeys/${jsonFileName}`,
			" * for step definitions and actions.",
			" */",
			'import * as fs from "node:fs";',
			'import * as path from "node:path";',
			'import { executeJourney } from "./helpers/journeyExecutor";',
			'import type { JourneyDefinition } from "./helpers/journeyTypes";',
			"",
			`const configPath = path.join(__dirname, "journeys", "${jsonFileName}");`,
			'const definition = JSON.parse(fs.readFileSync(configPath, "utf-8")) as JourneyDefinition;',
			"",
			"executeJourney(definition);",
			"",
		].join("\n");
	}

	private async handleExport(payload: JourneyExportPayload): Promise<void> {
		try {
			// 1. Write journey JSON
			const json = this.buildDefinitionJSON(payload);
			await this.fileSystem.createFile(payload.path, json, { createFolders: true });

			// 2. Write test executor
			if (payload.testFilePath) {
				const jsonFileName = payload.path.split("/").pop() ?? "";
				const testContent = this.buildTestExecutor(payload.definition.journey, jsonFileName);
				await this.fileSystem.createFile(payload.testFilePath, testContent, { createFolders: true });
			}

			// 3. Write canvas snapshot
			if (payload.canvasPath) {
				const canvasInput: CanvasSyncInput = {
					journey: payload.definition.journey,
					description: payload.definition.description,
					startEvent: payload.definition.startEvent,
					endEvent: payload.definition.endEvent,
					steps: payload.definition.steps.map((s) => ({
						id: s.id,
						title: s.title,
						description: s.description,
						actions: s.actions ?? [],
					})),
				};
				const canvasData = buildJourneyCanvas(canvasInput);
				const canvasJson = JSON.stringify(canvasData, null, 2);
				const exists = await this.fileSystem.fileExists(payload.canvasPath);
				if (exists) {
					await this.fileSystem.updateFile(payload.canvasPath, canvasJson);
				} else {
					await this.fileSystem.createFile(payload.canvasPath, canvasJson, { createFolders: true });
				}
			}
		} catch (err) {
			console.error("[JourneyBuilderService] Export failed:", err);
		}
	}

	private async handleListFiles(): Promise<void> {
		try {
			const folder = this.getSettings().journeyFolder;
			await this.fileSystem.ensureFolder(folder);
			const allFiles = await this.fileSystem.listFiles(folder);
			const journeyFiles = allFiles.filter((f) => f.endsWith(".journey.json"));
			void this.eventBus.emit("journey-builder.list-files.response", { files: journeyFiles });
		} catch {
			void this.eventBus.emit("journey-builder.list-files.response", { files: [] });
		}
	}

	private async handleImport(payload: { path: string }): Promise<void> {
		try {
			const json = await this.fileSystem.readFile(payload.path);
			void this.eventBus.emit("journey-builder.imported", { json });
		} catch (err) {
			console.error("[JourneyBuilderService] Import failed:", err);
		}
	}

	private async handleCanvasSync(payload: {
		canvasPath: string;
		definition: CanvasSyncInput;
	}): Promise<void> {
		try {
			const canvasData = buildJourneyCanvas(payload.definition);
			const json = JSON.stringify(canvasData, null, 2);
			const exists = await this.fileSystem.fileExists(payload.canvasPath);
			if (exists) {
				await this.fileSystem.updateFile(payload.canvasPath, json);
			} else {
				await this.fileSystem.createFile(payload.canvasPath, json, { createFolders: true });
			}
			void this.eventBus.emit("journey-builder.canvas.synced", {
				canvasPath: payload.canvasPath,
			});
		} catch (err) {
			console.error("[JourneyBuilderService] Canvas sync failed:", err);
		}
	}
}
