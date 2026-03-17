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
import { validateJourneyJSON } from "./validateJourney";
import { parseJourneyCanvas } from "./canvasParser";
import type { CanvasData } from "obsidian/canvas";

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
	private unsubFileModified: (() => void) | undefined;
	private activeCanvasPath: string | null = null;
	private lastCanvasWriteTime = 0;
	private static readonly SELF_WRITE_WINDOW_MS = 2000;

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
		this.unsubFileModified = this.eventBus.on(
			"file.modified",
			(event) => void this.handleFileModified(event.payload as { path: string }),
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
		this.unsubFileModified?.();
		this.unsubFileModified = undefined;
		this.activeCanvasPath = null;
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

	private async handleImport(payload: { path: string }): Promise<void> {
		const fileName = payload.path.split("/").pop() ?? payload.path;
		try {
			const raw = await this.fileSystem.readFile(payload.path);

			if (payload.path.endsWith(".canvas")) {
				this.importCanvas(raw, fileName, payload.path);
				return;
			}

			const result = validateJourneyJSON(raw);
			if (!result.valid) {
				const detail = result.errors.slice(0, 3).join("; ");
				void this.eventBus.emit("notice.error", {
					message: `Cannot import "${fileName}": ${detail}`,
				});
				void this.eventBus.emit("journey-builder.import-failed", {
					path: payload.path,
					errors: result.errors,
				});
				return;
			}
			void this.eventBus.emit("journey-builder.imported", { json: raw });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			const isTimeout = message.includes("timed out");
			const userMessage = isTimeout
				? `Could not read "${fileName}": file read timed out. Check the file exists in your vault.`
				: `Could not import "${fileName}": ${message}`;
			void this.eventBus.emit("notice.error", { message: userMessage });
			void this.eventBus.emit("journey-builder.import-failed", {
				path: payload.path,
				errors: [message],
			});
		}
	}

	private importCanvas(raw: string, fileName: string, path: string): void {
		let canvasData: CanvasData;
		try {
			canvasData = JSON.parse(raw) as CanvasData;
		} catch {
			void this.eventBus.emit("notice.error", {
				message: `Cannot import "${fileName}": invalid canvas JSON`,
			});
			void this.eventBus.emit("journey-builder.import-failed", {
				path,
				errors: ["invalid canvas JSON"],
			});
			return;
		}

		const parsed = parseJourneyCanvas(canvasData);
		if (!parsed) {
			void this.eventBus.emit("notice.error", {
				message: `Cannot import "${fileName}": not a journey canvas (missing START/END nodes)`,
			});
			void this.eventBus.emit("journey-builder.import-failed", {
				path,
				errors: ["not a journey canvas"],
			});
			return;
		}

		const json = JSON.stringify({
			journey: fileName.replace(/\.canvas$/, ""),
			description: "",
			startEvent: parsed.startEvent,
			endEvent: parsed.endEvent,
			steps: parsed.steps.map((s, i) => ({
				id: `step-${i + 1}`,
				title: s.title,
				description: s.description,
				swimlane: "",
				actions: [],
			})),
		});
		void this.eventBus.emit("journey-builder.imported", { json });
	}

	private async handleCanvasSync(payload: {
		canvasPath: string;
		definition: CanvasSyncInput;
	}): Promise<void> {
		try {
			this.activeCanvasPath = payload.canvasPath;
			this.lastCanvasWriteTime = Date.now();
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

	private async handleFileModified(payload: { path: string }): Promise<void> {
		if (!this.activeCanvasPath || payload.path !== this.activeCanvasPath) return;
		if (Date.now() - this.lastCanvasWriteTime < JourneyBuilderService.SELF_WRITE_WINDOW_MS) return;
		try {
			const content = await this.fileSystem.readFile(payload.path);
			const canvasData = JSON.parse(content) as CanvasData;
			const parsed = parseJourneyCanvas(canvasData);
			if (!parsed) return;
			void this.eventBus.emit("journey-builder.canvas.changed", {
				canvasPath: payload.path,
				...parsed,
			});
		} catch {
			// Silent — canvas may be malformed during editing
		}
	}
}
