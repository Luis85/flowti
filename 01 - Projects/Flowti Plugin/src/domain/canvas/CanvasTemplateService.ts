/**
 * CanvasTemplateService — creates canvas files from the template library.
 *
 * Pure orchestration: looks up the template, generates CanvasData,
 * writes the .canvas file via IFileSystemClient, and emits an event.
 */
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { IEventBus } from "../../infrastructure/events/types";
import { CANVAS_TEMPLATES, getCanvasTemplate } from "./templates/canvasTemplates";
import type { CanvasTemplate } from "./templates/types";

export interface CanvasTemplateServiceDeps {
	fileSystem: IFileSystemClient;
	eventBus: IEventBus;
}

export class CanvasTemplateService {
	private readonly fileSystem: IFileSystemClient;
	private readonly eventBus: IEventBus;

	constructor(deps: CanvasTemplateServiceDeps) {
		this.fileSystem = deps.fileSystem;
		this.eventBus = deps.eventBus;
	}

	/** Returns all available canvas templates. */
	getTemplates(): readonly CanvasTemplate[] {
		return CANVAS_TEMPLATES;
	}

	/** Returns a single template by ID, or undefined. */
	getTemplate(id: string): CanvasTemplate | undefined {
		return getCanvasTemplate(id);
	}

	/** Creates a new canvas file from a template. Returns the canvas path. */
	async createFromTemplate(templateId: string, canvasPath: string): Promise<string> {
		const template = getCanvasTemplate(templateId);
		if (!template) {
			throw new Error(`Unknown canvas template: ${templateId}`);
		}

		const canvasData = template.generate();
		const json = JSON.stringify(canvasData, null, "\t");

		await this.fileSystem.createFile(canvasPath, json, { createFolders: true });

		void this.eventBus.emit("canvas.template.created", {
			templateId: template.id,
			templateName: template.name,
			canvasPath,
		});

		return canvasPath;
	}
}
