/**
 * JourneyBuilderService — handles export and canvas sync for journey definitions.
 *
 * Listens for:
 *   - `journey-builder.exported` → writes journey JSON to vault
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
}

export class JourneyBuilderService {
	private readonly fileSystem: IFileSystemClient;
	private readonly eventBus: IEventBus;
	private unsubExport: (() => void) | undefined;
	private unsubCanvasSync: (() => void) | undefined;

	constructor(deps: JourneyBuilderServiceDeps) {
		this.fileSystem = deps.fileSystem;
		this.eventBus = deps.eventBus;
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
	}

	/** Stops listening. */
	stop(): void {
		this.unsubExport?.();
		this.unsubExport = undefined;
		this.unsubCanvasSync?.();
		this.unsubCanvasSync = undefined;
	}

	/** Builds the JSON content from an export payload. */
	buildDefinitionJSON(payload: JourneyExportPayload): string {
		const { definition } = payload;
		const output = {
			journey: definition.journey,
			description: definition.description,
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

	private async handleExport(payload: JourneyExportPayload): Promise<void> {
		try {
			const json = this.buildDefinitionJSON(payload);
			await this.fileSystem.createFile(payload.path, json, { createFolders: true });
		} catch (err) {
			console.error("[JourneyBuilderService] Export failed:", err);
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
