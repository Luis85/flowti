/**
 * Obsidian ItemView shell for the Project Detail.
 * Mounts the root <flowti-project-detail> Lit component.
 */

import { ItemView } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IProjectService } from "../../domain/projects/types.js";
import { VIEW_TYPE_PROJECT_DETAIL } from "./types.js";

export interface ProjectDetailDeps {
	readonly projectService: IProjectService;
	readonly openNote: (path: string) => void;
	readonly createNote: (name: string) => void;
	readonly openInWebviewer: (url: string) => void;
	readonly navigateBack: () => void;
}

export class ProjectDetailView extends ItemView {
	private deps: ProjectDetailDeps;
	private dispose: (() => void) | null = null;
	private projectName = "";

	constructor(leaf: WorkspaceLeaf, deps: ProjectDetailDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string {
		return VIEW_TYPE_PROJECT_DETAIL;
	}

	getDisplayText(): string {
		return this.projectName ? `Project: ${this.projectName}` : "Project detail";
	}

	getIcon(): string {
		return "folder-open";
	}

	async setState(state: Record<string, unknown>): Promise<void> {
		if (state.projectName && typeof state.projectName === "string") {
			this.projectName = state.projectName;
		}
		await super.setState(state);
	}

	getState(): Record<string, unknown> {
		return { ...super.getState(), projectName: this.projectName };
	}

	async onOpen(): Promise<void> {
		this.contentEl.addClass("ft-project-detail");
		this.contentEl.empty();

		const { mountProjectDetail } = await import("../../infrastructure/handlers/project-handlers.js");
		this.dispose = mountProjectDetail(this.contentEl, {
			projectService: this.deps.projectService,
			projectName: this.projectName,
			openNote: this.deps.openNote,
			createNote: this.deps.createNote,
			openInWebviewer: this.deps.openInWebviewer,
			navigateBack: this.deps.navigateBack,
		});
	}

	async onClose(): Promise<void> {
		if (this.dispose) {
			this.dispose();
			this.dispose = null;
		}
	}
}
