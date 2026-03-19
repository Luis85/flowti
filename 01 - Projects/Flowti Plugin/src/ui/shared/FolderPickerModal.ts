/**
 * Shared folder picker modal.
 *
 * A fuzzy-searchable modal that lists all vault folders
 * and invokes a callback when one is chosen.
 * Supports type-to-create: when the typed text doesn't match
 * any existing folder, a "+ Create: {text}" option appears.
 */

import { App, FuzzySuggestModal, TFolder } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";

const CREATE_PREFIX = "+ Create: ";

export class FolderPickerModal extends FuzzySuggestModal<string> {
	private folders: string[];
	private folderSet: Set<string>;
	private onChoose: (folder: string) => void;
	private eventBus?: IEventBus;

	constructor(app: App, folders: string[], onChoose: (folder: string) => void, eventBus?: IEventBus) {
		super(app);
		this.folders = folders;
		this.folderSet = new Set(folders);
		this.onChoose = onChoose;
		this.eventBus = eventBus;
	}

	getItems(): string[] {
		const query = this.inputEl?.value?.trim() ?? "";

		// When the user types a path that doesn't match an existing folder,
		// offer to create it — only allocate a new array then
		if (query && !this.folderSet.has(query)) {
			return [...this.folders, `${CREATE_PREFIX}${query}`];
		}

		return this.folders;
	}

	getItemText(item: string): string {
		if (item.startsWith(CREATE_PREFIX)) return item;
		return item || "(vault root)";
	}

	async onChooseItem(item: string): Promise<void> {
		if (item.startsWith(CREATE_PREFIX)) {
			const newPath = item.slice(CREATE_PREFIX.length);
			try {
				// TD-31 accepted exception: standalone folder creation is orthogonal
			// to the doc lifecycle pipeline. No IFileSystemClient.createFolder exists.
			await this.app.vault.createFolder(newPath);
				if (this.eventBus) void this.eventBus.emit("notice.success", { message: `Folder created: ${newPath}` });
			} catch {
				// Folder may already exist (race), which is fine
			}
			this.onChoose(newPath);
		} else {
			this.onChoose(item);
		}
	}
}

/** Returns all vault folder paths, sorted, with empty string for root. */
export function getVaultFolders(app: App): string[] {
	const folders: string[] = [""];
	app.vault.getAllLoadedFiles().forEach((f) => {
		if (f instanceof TFolder) folders.push(f.path);
	});
	folders.sort();
	return folders;
}
