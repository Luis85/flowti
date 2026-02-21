/**
 * CaptureService — Quick note capture via ribbon icons and command palette.
 *
 * Stateless service: creates notes with typed frontmatter in a configured folder.
 * No TypedStorage needed — all state lives in the created files.
 */

import type { IEventBus } from "../../infrastructure/events/types";
import type { IFileSystemClient } from "../../infrastructure/filesystem/types";
import type { CaptureInput, CaptureResult } from "./types";

export interface CaptureServiceOptions {
	eventBus: IEventBus;
	fileSystem: IFileSystemClient;
	getSettings: () => { captureFolder: string };
}

export class CaptureService {
	private readonly eventBus: IEventBus;
	private readonly fileSystem: IFileSystemClient;

	/** Late-binding settings getter — overridden in main.ts after service load. */
	public getSettings: () => { captureFolder: string };

	constructor(options: CaptureServiceOptions) {
		this.eventBus = options.eventBus;
		this.fileSystem = options.fileSystem;
		this.getSettings = options.getSettings;
	}

	/**
	 * Capture a note: create file with frontmatter and emit events.
	 */
	async capture(input: CaptureInput): Promise<CaptureResult> {
		const { captureFolder } = this.getSettings();
		const sanitizedTitle = this.sanitizeFileName(input.title);
		const path = `${captureFolder}/${sanitizedTitle}.md`;
		const timestamp = new Date().toISOString();

		// Build frontmatter — types are title case in vault notes (e.g. "Idea", "Feedback")
		const displayType = input.type.charAt(0).toUpperCase() + input.type.slice(1);
		const frontmatter = [
			"---",
			`type: ${displayType}`,
			...(input.description ? [`description: "${input.description}"`] : []),
			`created: ${timestamp}`,
			`origin: quick-capture`,
			"---",
			"",
		].join("\n");

		await this.fileSystem.createFile(path, frontmatter, { createFolders: true });

		// Emit type-specific event
		if (input.type === "idea") {
			void this.eventBus.emit("capture.idea.created", { path, title: input.title });
		} else if (input.type === "feedback") {
			void this.eventBus.emit("capture.feedback.created", { path, title: input.title });
		}

		// Always emit generic capture event
		void this.eventBus.emit("capture.note.created", {
			path,
			title: input.title,
			type: input.type,
		});

		return { path, title: input.title, type: input.type };
	}

	/**
	 * Sanitize a title for use as a file name.
	 * Removes characters that are invalid in file paths.
	 */
	private sanitizeFileName(title: string): string {
		return title
			.replace(/[\\/:*?"<>|]/g, "")
			.replace(/\s+/g, " ")
			.trim();
	}
}
