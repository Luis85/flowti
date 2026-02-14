/**
 * Obsidian-specific implementations of VaultQueryService and WorkspaceService.
 *
 * These adapters wrap the Obsidian App instance, providing the abstraction
 * layer that UI components use instead of direct Obsidian API calls.
 */

import { TFile, TFolder } from "obsidian";
import type { App } from "obsidian";
import type {
	IVaultQueryService,
	VaultFileEntry,
	VaultChildEntry,
} from "./VaultQueryService";
import type { IWorkspaceService } from "./WorkspaceService";

/**
 * Creates a VaultQueryService backed by an Obsidian App instance.
 */
export function createVaultQueryService(app: App): IVaultQueryService {
	return {
		fileExists(path: string): boolean {
			return app.vault.getAbstractFileByPath(path) !== null;
		},

		getFile(path: string): VaultFileEntry | null {
			const f = app.vault.getAbstractFileByPath(path);
			if (!f || !(f instanceof TFile)) return null;
			return {
				path: f.path,
				name: f.name,
				basename: f.basename,
				extension: f.extension,
			};
		},

		isFolder(path: string): boolean {
			const f = app.vault.getAbstractFileByPath(path);
			return f instanceof TFolder;
		},

		isFile(path: string): boolean {
			const f = app.vault.getAbstractFileByPath(path);
			return f instanceof TFile;
		},

		getFrontmatter(path: string): Record<string, unknown> | undefined {
			const f = app.vault.getAbstractFileByPath(path);
			if (!f || !(f instanceof TFile)) return undefined;
			return app.metadataCache.getFileCache(f)?.frontmatter as
				Record<string, unknown> | undefined;
		},

		getChildren(folderPath: string): VaultChildEntry[] {
			const f = app.vault.getAbstractFileByPath(folderPath);
			if (!f || !(f instanceof TFolder)) return [];
			return f.children.map((child) => ({
				path: child.path,
				name: child.name,
				isFolder: child instanceof TFolder,
				extension: child instanceof TFile ? child.extension : undefined,
			}));
		},

		listMarkdownFiles(folderPath: string): VaultFileEntry[] {
			const f = app.vault.getAbstractFileByPath(folderPath);
			if (!f || !(f instanceof TFolder)) return [];
			return f.children
				.filter((child): child is TFile =>
					child instanceof TFile && child.extension === "md"
				)
				.map((file) => ({
					path: file.path,
					name: file.name,
					basename: file.basename,
					extension: file.extension,
				}));
		},

		async readFile(path: string): Promise<string> {
			const f = app.vault.getAbstractFileByPath(path);
			if (!f || !(f instanceof TFile)) {
				throw new Error(`File not found: ${path}`);
			}
			return app.vault.read(f);
		},
	};
}

/**
 * Creates a WorkspaceService backed by an Obsidian App instance.
 */
export function createWorkspaceService(app: App): IWorkspaceService {
	return {
		async openFile(path: string): Promise<void> {
			const f = app.vault.getAbstractFileByPath(path);
			if (f && f instanceof TFile) {
				const leaf = app.workspace.getLeaf(false);
				await leaf.openFile(f);
			}
		},

		async openFileInNewLeaf(path: string): Promise<void> {
			const f = app.vault.getAbstractFileByPath(path);
			if (f && f instanceof TFile) {
				const leaf = app.workspace.getLeaf(true);
				await leaf.openFile(f);
			}
		},

		async openLink(linkText: string): Promise<void> {
			await app.workspace.openLinkText(linkText, "", false);
		},

		async openView(viewType: string): Promise<void> {
			const leaf = app.workspace.getLeaf(true);
			await leaf.setViewState({ type: viewType, active: true });
			app.workspace.revealLeaf(leaf);
		},
	};
}
