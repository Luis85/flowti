/**
 * Shared folder picker modal.
 *
 * A fuzzy-searchable modal that lists all vault folders
 * and invokes a callback when one is chosen.
 * Supports type-to-create: when the typed text doesn't match
 * any existing folder, a "+ Create: {text}" option appears.
 */

import { App, FuzzySuggestModal, Notice, TFolder } from "obsidian";

const CREATE_PREFIX = "+ Create: ";

export class FolderPickerModal extends FuzzySuggestModal<string> {
	private folders: string[];
	private onChoose: (folder: string) => void;

	constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
		super(app);
		this.folders = folders;
		this.onChoose = onChoose;
	}

	getItems(): string[] {
		const query = this.inputEl?.value?.trim() ?? "";
		const items = [...this.folders];

		// When the user types a path that doesn't match an existing folder,
		// offer to create it
		if (query && !this.folders.includes(query)) {
			items.push(`${CREATE_PREFIX}${query}`);
		}

		return items;
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
				new Notice(`Folder created: ${newPath}`);
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
