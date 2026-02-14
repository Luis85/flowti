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
		excludePaths?: string[],
	) {
		super(app);
		const extSet = new Set(extensions.map((e) => e.toLowerCase()));
		const excludeSet = excludePaths ? new Set(excludePaths) : undefined;
		this.files = app.vault
			.getFiles()
			.filter((f) => extSet.has(f.extension.toLowerCase()))
			.filter((f) => !excludeSet || !excludeSet.has(f.path))
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
