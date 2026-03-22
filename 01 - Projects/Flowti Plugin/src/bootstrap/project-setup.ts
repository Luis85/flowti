/**
 * Project domain bootstrap — registers project detail view + command.
 * Fully offline — uses vault scanning + local shell for all operations.
 */

import type { App, Plugin, WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types.js";
import { VaultProjectService } from "../infrastructure/projects/vault-project-service.js";
import { ProjectDetailView, type ProjectDetailDeps } from "../ui/projects/project-detail-view.js";
import { VIEW_TYPE_PROJECT_DETAIL } from "../ui/projects/types.js";
import { FolderPickerModal, getVaultFolders } from "../ui/shared/FolderPickerModal.js";
import { revealFolderInExplorer } from "../ui/hub/helpers.js";

export interface ProjectSetupDeps {
	readonly plugin: Plugin;
	readonly app: App;
	readonly eventBus: IEventBus;
}

export interface ProjectSetupResult {
	readonly projectService: VaultProjectService;
}

export function setupProjectDomain(deps: ProjectSetupDeps): ProjectSetupResult {
	const projectService = new VaultProjectService(deps.app);

	const viewDeps: ProjectDetailDeps = {
		projectService,
		openNote: (path: string) => {
			void deps.app.workspace.openLinkText(path, "", false);
		},
		createNote: (name: string): Promise<void> => {
			const projectPath = `01 - Projects/${name}/${name}.md`;

			return new Promise<void>((resolve, reject) => {
				let timer: ReturnType<typeof setTimeout> | null = null;

				const cleanup = () => {
					if (timer !== null) { clearTimeout(timer); timer = null; }
					unsub();
					unsubExists();
				};

				const unsub = deps.eventBus.on("doc.created", (event) => {
					cleanup();
					void deps.app.workspace.openLinkText(event.payload.docType === "ProjectBrief" ? event.payload.path : projectPath, "", false);
					resolve();
				});
				const unsubExists = deps.eventBus.on("doc.exists", (event) => {
					cleanup();
					void deps.app.workspace.openLinkText(event.payload.docType === "ProjectBrief" ? event.payload.path : projectPath, "", false);
					resolve();
				});

				timer = setTimeout(() => {
					cleanup();
					reject(new Error("createNote timeout"));
				}, 5000);

				void deps.eventBus.emit("doc.create", {
					docType: "ProjectBrief",
					name,
					path: projectPath,
					source: "ProjectSetup",
				});
			});
		},
		navigateBack: () => {
			const leaves = deps.app.workspace.getLeavesOfType(VIEW_TYPE_PROJECT_DETAIL);
			for (const leaf of leaves) leaf.detach();
		},
		pickFolder: () => new Promise<string | null>((resolve) => {
			const folders = getVaultFolders(deps.app);
			new FolderPickerModal(deps.app, folders, (folder) => resolve(folder)).open();
		}),
		revealFolder: (path: string) => {
			revealFolderInExplorer(deps.app, path);
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

	return { projectService };
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
