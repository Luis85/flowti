/**
 * JSONPanel — collapsible JSON preview panel for the Journey Builder sidebar.
 *
 * Shows formatted JSON of the current journey definition. Starts collapsed.
 */
export interface JSONPanelDeps {
	/** Returns the current JSON string to display. */
	getJSON: () => string;
	/** Whether the panel starts collapsed. Default: true. */
	collapsed?: boolean;
}

export class JSONPanel {
	private isCollapsed: boolean;

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

		// Content panel
		const panel = this.container.createDiv({ cls: "ft-jb-json-panel" });
		panel.dataset.testId = "jb-json-panel";
		if (this.isCollapsed) panel.addClass("ft-hidden");

		const content = panel.createEl("pre", { cls: "ft-jb-json-content" });
		content.dataset.testId = "jb-json-content";
		content.textContent = this.deps.getJSON();

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
}
