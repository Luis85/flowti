/**
 * Project domain bootstrap — registers project detail view + command.
 * Uses vault-based project scanning (works offline).
 * Storybook operations delegate to CLI server when available.
 */

import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import { VaultProjectService } from "../infrastructure/projects/vault-project-service.js";
import { HttpProjectService } from "../infrastructure/projects/http-project-service.js";
import { ProjectDetailView, type ProjectDetailDeps } from "../ui/projects/project-detail-view.js";
import { VIEW_TYPE_PROJECT_DETAIL } from "../ui/projects/types.js";

export interface ProjectSetupDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly cliServerUrl?: string;
}

export interface ProjectSetupResult {
	readonly projectService: VaultProjectService;
	/** Call when CLI server comes online to enable storybook operations. */
	readonly connectHttpService: () => void;
}

export function setupProjectDomain(deps: ProjectSetupDeps): ProjectSetupResult {
	const baseUrl = deps.cliServerUrl ?? "http://localhost:3000";
	const httpService = new HttpProjectService(baseUrl);
	const projectService = new VaultProjectService(deps.app, null);

	const viewDeps: ProjectDetailDeps = {
		projectService,
		openNote: (path: string) => {
			void deps.app.workspace.openLinkText(path, "", false);
		},
		createNote: (name: string) => {
			const projectPath = `01 - Projects/${name}/${name}.md`;
			const content = `---\ntype: ProjectBrief\n---\n\n# ${name}\n\n`;
			void deps.app.vault.create(projectPath, content).then((file) => {
				void deps.app.workspace.openLinkText(file.path, "", false);
			});
		},
		openInWebviewer: (url: string) => {
			window.open(url);
		},
		navigateBack: () => {
			const leaves = deps.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_DETAIL);
			for (const leaf of leaves) leaf.detach();
		},
	};

	try {
		deps.plugin.registerView(VIEW_TYPE_PROJECT_DETAIL, (leaf: WorkspaceLeaf) => {
			return new ProjectDetailView(leaf, viewDeps);
		});
	} catch (err) {
		if (err instanceof Error && !err.message.includes("existing view type")) throw err;
	}

	deps.plugin.addCommand({
		id: "open-project-hub",
		name: "Open project hub",
		callback: () => {
			void openProjectDetail(deps.app, "");
		},
	});

	function connectHttpService(): void {
		projectService.setHttpService(httpService);
	}

	return { projectService, connectHttpService };
}

/** Open project detail view for a specific project. */
export async function openProjectDetail(app: App, projectName: string): Promise<void> {
	const leaf = app.workspace.getRightLeaf(false);
	if (leaf) {
		await leaf.setViewState({
			type: VIEW_TYPE_PROJECT_DETAIL,
			active: true,
			state: { projectName },
		});
	}
}
