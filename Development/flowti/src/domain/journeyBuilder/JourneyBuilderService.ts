/**
 * JourneyBuilderService — handles export of journey definitions to vault files.
 *
 * Listens for `journey-builder.exported` events and writes the journey
 * definition as a JSON file via IFileSystemClient.
 */
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IEventBus } from "../../infrastructure/events/types";
import type { JourneyExportPayload } from "./events";

export interface JourneyBuilderServiceDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
}

export class JourneyBuilderService {
	private readonly fileSystem: IFileSystemClient;
	private readonly eventBus: IEventBus;
	private unsubscribe: (() => void) | undefined;

	constructor(deps: JourneyBuilderServiceDeps) {
		this.fileSystem = deps.fileSystem;
		this.eventBus = deps.eventBus;
	}

	/** Starts listening for export events. */
	start(): void {
		this.unsubscribe = this.eventBus.on(
			"journey-builder.exported",
			(event) => void this.handleExport(event.payload),
		);
	}

	/** Stops listening. */
	stop(): void {
		this.unsubscribe?.();
		this.unsubscribe = undefined;
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
				guideSection: s.guideSection,
				events: [definition.startEvent],
				actions: [],
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
}
