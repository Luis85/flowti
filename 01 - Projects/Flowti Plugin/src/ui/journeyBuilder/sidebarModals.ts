/**
 * Fuzzy suggest modals used by JourneyBuilderSidebar.
 *
 * Extracted to reduce main sidebar module size.
 */
import { FuzzySuggestModal } from "obsidian";
import type { App } from "obsidian";

/** Adapter-based journey file picker — groups .journey and .canvas files. */
export class JourneyPickerModal extends FuzzySuggestModal<string> {
	private paths: string[];
	private onChoosePath: (path: string) => void;

	constructor(app: App, paths: string[], onChoose: (path: string) => void) {
		super(app);
		// Sort: .journey files first, .canvas second — groups by type
		this.paths = [...paths].sort((a, b) => {
			const aIsCanvas = a.endsWith(".canvas") ? 1 : 0;
			const bIsCanvas = b.endsWith(".canvas") ? 1 : 0;
			return aIsCanvas - bIsCanvas || a.localeCompare(b);
		});
		this.onChoosePath = onChoose;
	}

	getItems(): string[] { return this.paths; }
	getItemText(item: string): string { return item.split("/").pop() ?? item; }
	onChooseItem(item: string): void { this.onChoosePath(item); }

	renderSuggestion(match: import("obsidian").FuzzyMatch<string>, el: HTMLElement): void {
		el.empty();
		el.addClass("ft-jb-picker-item");
		const isCanvas = match.item.endsWith(".canvas");

		// Top row: badge + filename
		const row = el.createDiv({ cls: "ft-jb-picker-row" });
		const badge = row.createSpan({ cls: "ft-jb-picker-badge" });
		badge.textContent = isCanvas ? "Canvas" : "Journey";
		badge.dataset.type = isCanvas ? "canvas" : "journey";
		const fileName = match.item.split("/").pop() ?? match.item;
		row.createSpan({ cls: "ft-jb-picker-name", text: fileName });

		// Subtitle: folder path
		const parts = match.item.split("/");
		if (parts.length > 1) {
			el.createDiv({ cls: "ft-jb-picker-path", text: parts.slice(0, -1).join("/") });
		}
	}
}

export const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

/** File picker filtered to image files. */
export class ImagePickerModal extends FuzzySuggestModal<string> {
	private paths: string[];
	private onChoosePath: (path: string) => void;

	constructor(app: App, paths: string[], onChoose: (path: string) => void) {
		super(app);
		this.paths = paths;
		this.onChoosePath = onChoose;
		this.setPlaceholder("Search images\u2026");
	}

	getItems(): string[] { return this.paths; }
	getItemText(item: string): string { return item.split("/").pop() ?? item; }
	onChooseItem(item: string): void { this.onChoosePath(item); }
}
