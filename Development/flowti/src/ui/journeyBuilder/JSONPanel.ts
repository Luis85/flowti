/**
 * JSONPanel — collapsible JSON preview panel for the Journey Builder sidebar.
 *
 * Shows formatted JSON of the current journey definition. Starts collapsed.
 * Supports live updates via `update()` and copy-to-clipboard.
 */
import { setIcon } from "obsidian";

export interface JSONPanelDeps {
	/** Returns the current JSON string to display. */
	getJSON: () => string;
	/** Whether the panel starts collapsed. Default: true. */
	collapsed?: boolean;
	/** Called after JSON is copied to clipboard. */
	onCopied?: () => void;
}

export class JSONPanel {
	private isCollapsed: boolean;
	private contentEl: HTMLElement | null = null;

	constructor(
		private readonly container: HTMLElement,
		private readonly deps: JSONPanelDeps,
	) {
		this.isCollapsed = deps.collapsed ?? true;
	}

	render(): void {
		this.container.empty();

		// Toggle header
		const header = this.container.createDiv({ cls: "ft-jb-json-header" });
		header.dataset.testId = "jb-json-toggle";
		const chevron = header.createSpan({ text: this.isCollapsed ? "▸" : "▾" });
		chevron.dataset.testId = "jb-json-chevron";
		header.createSpan({ text: " JSON Preview" });

		// Copy button
		const copyBtn = header.createSpan({ cls: "ft-jb-json-copy" });
		copyBtn.dataset.testId = "jb-json-copy";
		copyBtn.setAttribute("role", "button");
		copyBtn.setAttribute("tabindex", "0");
		copyBtn.setAttribute("aria-label", "Copy JSON");
		setIcon(copyBtn, "copy");
		copyBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.copyToClipboard(copyBtn);
		});
		copyBtn.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				e.stopPropagation();
				this.copyToClipboard(copyBtn);
			}
		});

		// Content panel
		const panel = this.container.createDiv({ cls: "ft-jb-json-panel" });
		panel.dataset.testId = "jb-json-panel";
		if (this.isCollapsed) panel.addClass("ft-hidden");

		const content = panel.createEl("pre", { cls: "ft-jb-json-content" });
		content.dataset.testId = "jb-json-content";
		content.textContent = this.deps.getJSON();
		this.contentEl = content;

		// Toggle on click
		header.addEventListener("click", () => {
			this.isCollapsed = !this.isCollapsed;
			if (this.isCollapsed) {
				panel.addClass("ft-hidden");
			} else {
				panel.removeClass("ft-hidden");
			}
			chevron.textContent = this.isCollapsed ? "▸" : "▾";
		});
	}

	/** Update the JSON content without rebuilding the DOM. Preserves collapse state. */
	update(): void {
		if (this.contentEl) {
			this.contentEl.textContent = this.deps.getJSON();
		}
	}

	private copyToClipboard(btn: HTMLElement): void {
		const json = this.deps.getJSON();
		void navigator.clipboard.writeText(json).then(() => {
			setIcon(btn, "check");
			setTimeout(() => setIcon(btn, "copy"), 1500);
			this.deps.onCopied?.();
		});
	}
}
