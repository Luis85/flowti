import { Modal, Setting } from "obsidian";
import type FileWatcherPlugin from "src/main";
import { truncatePath } from "src/utils";

export class ReconcileProgressModal extends Modal {
	private plugin: FileWatcherPlugin;
	private headerEl!: HTMLElement;
	private bodyEl!: HTMLElement;
	private timer: number | null = null;

	constructor(plugin: FileWatcherPlugin) {
		super(plugin.app);
		this.plugin = plugin;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Reconcile progress" });

		this.headerEl = contentEl.createDiv();
		this.bodyEl = contentEl.createDiv();

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Close").onClick(() => this.close())
		);

		// Poll UI (simple + reliable)
		this.timer = window.setInterval(() => this.render(), 250);
		this.render();
	}

	onClose() {
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		this.contentEl.empty();
	}

	private render() {
		const p = this.plugin.getReconcileSnapshot?.() ?? null;
		this.headerEl.empty();
		this.bodyEl.empty();

		if (!p) {
			this.headerEl.createEl("div", { text: "No reconcile running." });
			return;
		}

		const label = p.mappingLabel || p.mappingId;
		this.headerEl.createEl("div", { text: `Mapping: ${label}` });
		this.headerEl.createEl("div", { text: `Phase: ${p.phase}` });

		const total = typeof p.total === "number" ? p.total : undefined;
		const scannedLine = total ? `${p.scanned}/${total}` : `${p.scanned}`;
		this.bodyEl.createEl("div", { text: `Scanned: ${scannedLine}` });
		this.bodyEl.createEl("div", { text: `✅ Processed: ${p.processed}` });
		this.bodyEl.createEl("div", { text: `⏭️ Skipped: ${p.skipped}` });
		this.bodyEl.createEl("div", { text: `⚠️ Errors: ${p.errors}` });
		if (p.current)
			this.bodyEl.createEl("div", {
				text: `Current: ${truncatePath(p.current, 120)}`,
			});
	}
}
