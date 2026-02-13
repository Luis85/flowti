/**
 * File picker modal — fuzzy-searchable vault file picker filtered by extension.
 *
 * Usage:
 *   new FilePickerModal(app, ["csv"], (path) => { ... }).open();
 */

import { App, FuzzySuggestModal, TFile } from "obsidian";

export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private files: TFile[];
	private onChooseFile: (filePath: string) => void;

	constructor(
		app: App,
		extensions: string[],
		onChoose: (filePath: string) => void,
	) {
		super(app);
		const extSet = new Set(extensions.map((e) => e.toLowerCase()));
		this.files = app.vault
			.getFiles()
			.filter((f) => extSet.has(f.extension.toLowerCase()))
			.sort((a, b) => a.path.localeCompare(b.path));
		this.onChooseFile = onChoose;
	}

	getItems(): TFile[] {
		return this.files;
	}

	getItemText(item: TFile): string {
		return item.path;
	}

	onChooseItem(item: TFile): void {
		this.onChooseFile(item.path);
	}
}
