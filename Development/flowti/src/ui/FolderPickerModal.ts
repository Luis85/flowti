/**
 * Shared folder picker modal.
 *
 * A fuzzy-searchable modal that lists all vault folders
 * and invokes a callback when one is chosen.
 */

import { App, FuzzySuggestModal, TFolder } from "obsidian";

export class FolderPickerModal extends FuzzySuggestModal<string> {
	private folders: string[];
	private onChoose: (folder: string) => void;

	constructor(app: App, folders: string[], onChoose: (folder: string) => void) {
		super(app);
		this.folders = folders;
		this.onChoose = onChoose;
	}

	getItems(): string[] {
		return this.folders;
	}

	getItemText(item: string): string {
		return item || "(vault root)";
	}

	onChooseItem(item: string): void {
		this.onChoose(item);
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
