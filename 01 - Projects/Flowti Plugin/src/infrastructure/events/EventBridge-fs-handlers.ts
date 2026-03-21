/**
 * File system and frontmatter request handlers for EventBridge.
 *
 * Extracted from EventBridge.ts to stay under max-lines.
 * Bridges EventBus file/folder/frontmatter request events with Obsidian's vault API.
 */

import { TFile } from "obsidian";
import type { App } from "obsidian";
import type { IEventBus } from "./types";
import type { ILogger } from "../logger/types";

/** Extensions handled by the EventBridge file-system handlers. */
const VAULT_MANAGED_EXTENSIONS = new Set([
	"md", "canvas",
	"png", "jpg", "jpeg", "gif", "svg", "webp", "bmp", "avif",
	"mp3", "wav", "m4a", "ogg", "3gp", "flac",
	"mp4", "ogv", "mov", "mkv", "webm",
	"pdf",
	"journey",
]);

/** Returns true if the file extension is managed by Obsidian's vault API. */
export function isVaultManaged(path: string): boolean {
	const dotIdx = path.lastIndexOf(".");
	if (dotIdx < 0) return false;
	return VAULT_MANAGED_EXTENSIONS.has(path.substring(dotIdx + 1).toLowerCase());
}

/** Extract error message from an unknown error. */
function errMsg(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/** Creates a file via the vault adapter (for non-vault-managed extensions). */
async function createViaAdapter(
	app: App,
	path: string,
	content: string,
	createFolders?: boolean,
): Promise<void> {
	const adapter = app.vault.adapter;
	if (createFolders) {
		const folderPath = path.substring(0, path.lastIndexOf("/"));
		if (folderPath && !(await adapter.exists(folderPath))) {
			await adapter.mkdir(folderPath);
		}
	}
	await adapter.write(path, content);
}

/**
 * Set up event listeners for file system operations.
 * Bridges the EventBus with Obsidian's file API.
 */
export function setupFileSystemHandlers(
	app: App,
	eventBus: IEventBus,
	logger: ILogger,
): (() => void)[] {
	const unsubscribers: (() => void)[] = [];

	// Handle file.create.request
	unsubscribers.push(
		eventBus.on("file.create.request", async (event) => {
			const { requestId, path, content, createFolders } = event.payload;
			try {
				if (!isVaultManaged(path)) {
					await createViaAdapter(app, path, content, createFolders);
					await eventBus.emit("file.create.response", { requestId, success: true, path });
					return;
				}

				if (createFolders) {
					const folderPath = path.substring(0, path.lastIndexOf("/"));
					if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
						try { await app.vault.createFolder(folderPath); } catch { /* race */ }
					}
				}

				if (app.vault.getAbstractFileByPath(path)) {
					await eventBus.emit("file.create.response", { requestId, success: true, path });
					return;
				}

				await app.vault.create(path, content);
				await eventBus.emit("file.create.response", { requestId, success: true, path });
			} catch (error) {
				await eventBus.emit("file.create.response", {
					requestId, success: false, path,
					error: { code: "FILE_CREATE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.read.request
	unsubscribers.push(
		eventBus.on("file.read.request", async (event) => {
			const { requestId, path } = event.payload;
			try {
				let content: string;
				if (!isVaultManaged(path)) {
					const adapter = app.vault.adapter;
					if (!(await adapter.exists(path))) throw new Error(`File not found: ${path}`);
					content = await adapter.read(path);
				} else {
					const file = app.vault.getAbstractFileByPath(path);
					if (file && file instanceof TFile) {
						content = await app.vault.read(file);
					} else {
						const adapter = app.vault.adapter;
						if (!(await adapter.exists(path))) throw new Error(`File not found: ${path}`);
						content = await adapter.read(path);
					}
				}
				await eventBus.emit("file.read.response", { requestId, success: true, path, content });
			} catch (error) {
				await eventBus.emit("file.read.response", {
					requestId, success: false, path,
					error: { code: "FILE_READ_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.update.request
	unsubscribers.push(
		eventBus.on("file.update.request", async (event) => {
			const { requestId, path, content } = event.payload;
			try {
				if (!isVaultManaged(path)) {
					const adapter = app.vault.adapter;
					if (!(await adapter.exists(path))) throw new Error(`File not found: ${path}`);
					await adapter.write(path, content);
				} else {
					const file = app.vault.getAbstractFileByPath(path);
					if (!file || !(file instanceof TFile)) throw new Error(`File not found: ${path}`);
					await app.vault.modify(file, content);
				}
				await eventBus.emit("file.update.response", { requestId, success: true, path });
			} catch (error) {
				await eventBus.emit("file.update.response", {
					requestId, success: false, path,
					error: { code: "FILE_UPDATE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.delete.request
	unsubscribers.push(
		eventBus.on("file.delete.request", async (event) => {
			const { requestId, path } = event.payload;
			try {
				if (!isVaultManaged(path)) {
					const adapter = app.vault.adapter;
					if (!(await adapter.exists(path))) throw new Error(`File not found: ${path}`);
					await adapter.remove(path);
				} else {
					const file = app.vault.getAbstractFileByPath(path);
					if (!file) throw new Error(`File not found: ${path}`);
					await app.fileManager.trashFile(file);
				}
				await eventBus.emit("file.delete.response", { requestId, success: true, path });
			} catch (error) {
				await eventBus.emit("file.delete.response", {
					requestId, success: false, path,
					error: { code: "FILE_DELETE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.move.request
	unsubscribers.push(
		eventBus.on("file.move.request", async (event) => {
			const { requestId, path, newPath } = event.payload;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file) throw new Error(`File not found: ${path}`);
				await app.fileManager.renameFile(file, newPath);
				await eventBus.emit("file.move.response", { requestId, success: true, path, newPath });
			} catch (error) {
				await eventBus.emit("file.move.response", {
					requestId, success: false, path,
					error: { code: "FILE_MOVE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.rename.request
	unsubscribers.push(
		eventBus.on("file.rename.request", async (event) => {
			const { requestId, path, newName } = event.payload;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file) throw new Error(`File not found: ${path}`);
				const folderPath = path.substring(0, path.lastIndexOf("/"));
				const newPath = folderPath ? `${folderPath}/${newName}` : newName;
				await app.fileManager.renameFile(file, newPath);
				await eventBus.emit("file.rename.response", { requestId, success: true, path, newPath });
			} catch (error) {
				await eventBus.emit("file.rename.response", {
					requestId, success: false, path,
					error: { code: "FILE_RENAME_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle file.list.request (recursive)
	unsubscribers.push(
		eventBus.on("file.list.request", async (event) => {
			const { requestId, path } = event.payload;
			try {
				const adapter = app.vault.adapter;
				if (!(await adapter.exists(path))) {
					await eventBus.emit("file.list.response", { requestId, success: true, path, files: [] });
					return;
				}
				const collectFiles = async (dir: string): Promise<string[]> => {
					const listing = await adapter.list(dir);
					let files = [...listing.files];
					for (const sub of listing.folders) {
						files = files.concat(await collectFiles(sub));
					}
					return files;
				};
				const files = await collectFiles(path);
				await eventBus.emit("file.list.response", { requestId, success: true, path, files });
			} catch (error) {
				await eventBus.emit("file.list.response", {
					requestId, success: false, path,
					error: { code: "FILE_LIST_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle folder.ensure.request
	unsubscribers.push(
		eventBus.on("folder.ensure.request", async (event) => {
			const { requestId, path } = event.payload;
			try {
				const adapter = app.vault.adapter;
				if (!(await adapter.exists(path))) {
					await adapter.mkdir(path);
				}
				await eventBus.emit("folder.ensure.response", { requestId, success: true, path });
			} catch (error) {
				await eventBus.emit("folder.ensure.response", {
					requestId, success: false, path,
					error: { code: "FOLDER_ENSURE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	logger.debug("File system handlers initialized");
	return unsubscribers;
}

/**
 * Set up event listeners for frontmatter operations.
 * Bridges the EventBus with Obsidian's metadata API.
 */
export function setupFrontmatterHandlers(
	app: App,
	eventBus: IEventBus,
	logger: ILogger,
): (() => void)[] {
	const unsubscribers: (() => void)[] = [];

	// Handle frontmatter.get.request
	unsubscribers.push(
		eventBus.on("frontmatter.get.request", async (event) => {
			const { requestId, path } = event.payload;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) throw new Error(`File not found: ${path}`);
				const cache = app.metadataCache.getFileCache(file);
				const data = cache?.frontmatter ?? {};
				await eventBus.emit("frontmatter.get.response", { requestId, success: true, path, data });
			} catch (error) {
				await eventBus.emit("frontmatter.get.response", {
					requestId, success: false, path,
					error: { code: "FRONTMATTER_GET_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle frontmatter.update.request (merge with existing)
	unsubscribers.push(
		eventBus.on("frontmatter.update.request", async (event) => {
			const { requestId, path, data } = event.payload;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) throw new Error(`File not found: ${path}`);
				let mergedFrontmatter: Record<string, unknown> = {};
				await app.fileManager.processFrontMatter(file, (frontmatter) => {
					Object.assign(frontmatter, data);
					mergedFrontmatter = { ...frontmatter };
				});
				await eventBus.emit("frontmatter.update.response", { requestId, success: true, path, data: mergedFrontmatter });
			} catch (error) {
				await eventBus.emit("frontmatter.update.response", {
					requestId, success: false, path,
					error: { code: "FRONTMATTER_UPDATE_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	// Handle frontmatter.set.request (replace entire frontmatter)
	unsubscribers.push(
		eventBus.on("frontmatter.set.request", async (event) => {
			const { requestId, path, data } = event.payload;
			try {
				const file = app.vault.getAbstractFileByPath(path);
				if (!file || !(file instanceof TFile)) throw new Error(`File not found: ${path}`);
				await app.fileManager.processFrontMatter(file, (frontmatter) => {
					for (const key of Object.keys(frontmatter)) {
						delete frontmatter[key];
					}
					Object.assign(frontmatter, data);
				});
				await eventBus.emit("frontmatter.set.response", { requestId, success: true, path });
			} catch (error) {
				await eventBus.emit("frontmatter.set.response", {
					requestId, success: false, path,
					error: { code: "FRONTMATTER_SET_FAILED", message: errMsg(error), path },
				});
			}
		})
	);

	logger.debug("Frontmatter handlers initialized");
	return unsubscribers;
}
