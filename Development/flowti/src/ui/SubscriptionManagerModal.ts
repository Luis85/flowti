/**
 * Modal for managing event subscriptions.
 * Two pages: list (default) and form (add/edit).
 */

import { App, Modal, Notice, Setting } from "obsidian";
import type { IEventBus } from "../infrastructure/events/types";
import type { Subscription } from "../domain/subscription/types";

type Page = "list" | "form";

interface FormData {
	eventType: string;
	label: string;
	pathPattern: string;
	extension: string;
	namePattern: string;
}

export class SubscriptionManagerModal extends Modal {
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private subscriptions: Subscription[] = [];

	private page: Page = "list";
	private editingId: string | null = null;
	private formData: FormData = this.emptyForm();

	constructor(app: App, eventBus: IEventBus) {
		super(app);
		this.eventBus = eventBus;
	}

	async onOpen(): Promise<void> {
		this.modalEl.addClass("flowti-subscription-modal");
		this.titleEl.setText("Manage Watchers");

		// Listen for subscription state changes
		this.unsubscribes.push(
			this.eventBus.on("subscription.loaded", (event) => {
				this.subscriptions = event.payload.subscriptions;
				if (this.page === "list") this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.created", (event) => {
				this.subscriptions = [
					...this.subscriptions.filter((s) => s.id !== event.payload.subscription.id),
					event.payload.subscription,
				];
				this.page = "list";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.updated", (event) => {
				this.subscriptions = this.subscriptions.map((s) =>
					s.id === event.payload.subscription.id ? event.payload.subscription : s
				);
				this.page = "list";
				this.render();
			})
		);
		this.unsubscribes.push(
			this.eventBus.on("subscription.deleted", (event) => {
				this.subscriptions = this.subscriptions.filter(
					(s) => s.id !== event.payload.subscriptionId
				);
				this.render();
			})
		);

		// Request current state
		await this.eventBus.emit("subscription.refresh", {});

		this.render();
	}

	onClose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		if (this.page === "form") {
			this.renderForm(contentEl);
		} else {
			this.renderList(contentEl);
		}
	}

	// ─────────────────────────────────────────────────────────────
	// List page
	// ─────────────────────────────────────────────────────────────

	private renderList(container: HTMLElement): void {
		// Add button
		const header = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-mb-2" });
		const addBtn = header.createEl("button", {
			text: "Add watcher",
			cls: "ft-btn ft-btn-primary",
		});
		addBtn.addEventListener("click", () => {
			this.editingId = null;
			this.formData = this.emptyForm();
			this.page = "form";
			this.render();
		});

		if (this.subscriptions.length === 0) {
			container.createDiv({
				text: "No watchers yet.",
				cls: "ft-text-muted ft-text-sm ft-p-4",
			});
			return;
		}

		for (const sub of this.subscriptions) {
			this.renderSubscriptionRow(container, sub);
		}
	}

	private renderSubscriptionRow(container: HTMLElement, sub: Subscription): void {
		const setting = new Setting(container);

		// Build description from filters
		const filterParts: string[] = [];
		if (sub.filters.pathPattern) filterParts.push(`path: ${sub.filters.pathPattern}`);
		if (sub.filters.extension) filterParts.push(`ext: ${sub.filters.extension}`);
		if (sub.filters.namePattern) filterParts.push(`name: ${sub.filters.namePattern}`);
		const filterDesc = filterParts.length > 0 ? filterParts.join(", ") : "no filters";

		setting.setName(sub.label || sub.eventType);
		setting.setDesc(`${sub.eventType} — ${filterDesc}`);

		// Enable/disable toggle
		setting.addToggle((toggle) => {
			toggle.setValue(sub.enabled);
			toggle.onChange((value) => {
				void this.eventBus.emit("subscription.update", {
					subscriptionId: sub.id,
					enabled: value,
				});
			});
		});

		// Edit button
		setting.addExtraButton((btn) => {
			btn.setIcon("pencil");
			btn.setTooltip("Edit");
			btn.onClick(() => {
				this.editingId = sub.id;
				this.formData = {
					eventType: sub.eventType,
					label: sub.label ?? "",
					pathPattern: sub.filters.pathPattern ?? "",
					extension: sub.filters.extension ?? "",
					namePattern: sub.filters.namePattern ?? "",
				};
				this.page = "form";
				this.render();
			});
		});

		// Delete button
		setting.addExtraButton((btn) => {
			btn.setIcon("trash-2");
			btn.setTooltip("Delete");
			btn.onClick(() => {
				void this.eventBus.emit("subscription.remove", {
					subscriptionId: sub.id,
				});
			});
		});
	}

	// ─────────────────────────────────────────────────────────────
	// Form page
	// ─────────────────────────────────────────────────────────────

	private renderForm(container: HTMLElement): void {
		const isEdit = this.editingId !== null;

		container.createEl("h3", {
			text: isEdit ? "Edit Watcher" : "New Watcher",
		});

		container.createEl("p", {
			text: "A watcher monitors a specific event type and filters matching files for processing. All filter fields use AND logic \u2014 a file must match every specified filter.",
			cls: "ft-text-muted ft-text-sm ft-mb-2",
		});

		new Setting(container)
			.setName("Event type")
			.setDesc("The event type to watch for. Use dot notation (e.g. file.created, file.modified). Open the Event Catalog to browse all available types.")
			.addText((text) => {
				text.setPlaceholder("file.created");
				text.setValue(this.formData.eventType);
				text.onChange((value) => {
					this.formData.eventType = value;
				});
			});

		new Setting(container)
			.setName("Label")
			.setDesc("A friendly name to identify this watcher in lists. Recommended when you have multiple watchers for the same event.")
			.addText((text) => {
				text.setPlaceholder("My subscription");
				text.setValue(this.formData.label);
				text.onChange((value) => {
					this.formData.label = value;
				});
			});

		new Setting(container)
			.setName("Path pattern")
			.setDesc("Glob pattern matched against the full vault path. Use ** for any depth, * for one level. Example: Reports/** matches all files under Reports/. Leave empty to match any path.")
			.addText((text) => {
				text.setPlaceholder("Reports/**");
				text.setValue(this.formData.pathPattern);
				text.onChange((value) => {
					this.formData.pathPattern = value;
				});
			});

		new Setting(container)
			.setName("Extension")
			.setDesc("File extension without the dot. Only files with this extension will match. Example: csv, md, json. Leave empty to match any extension.")
			.addText((text) => {
				text.setPlaceholder("csv");
				text.setValue(this.formData.extension);
				text.onChange((value) => {
					this.formData.extension = value;
				});
			});

		new Setting(container)
			.setName("Name pattern")
			.setDesc("Glob pattern matched against the filename only (not the full path). Example: report-*.csv matches report-jan.csv. Leave empty to match any filename.")
			.addText((text) => {
				text.setPlaceholder("report-*.csv");
				text.setValue(this.formData.namePattern);
				text.onChange((value) => {
					this.formData.namePattern = value;
				});
			});

		// Action buttons
		const btnRow = container.createDiv({ cls: "ft-flex ft-gap-2 ft-mt-4" });

		const cancelBtn = btnRow.createEl("button", {
			text: "Cancel",
			cls: "ft-btn ft-btn-ghost",
		});
		cancelBtn.addEventListener("click", () => {
			this.page = "list";
			this.render();
		});

		const saveBtn = btnRow.createEl("button", {
			text: isEdit ? "Save" : "Create",
			cls: "ft-btn ft-btn-primary",
		});
		saveBtn.addEventListener("click", () => {
			if (!this.formData.eventType.trim()) return;

			const filters = {
				pathPattern: this.formData.pathPattern || undefined,
				extension: this.formData.extension || undefined,
				namePattern: this.formData.namePattern || undefined,
			};

			const promise = isEdit && this.editingId
				? this.eventBus.emit("subscription.update", {
						subscriptionId: this.editingId,
						label: this.formData.label || undefined,
						filters,
					})
				: this.eventBus.emit("subscription.create", {
						eventType: this.formData.eventType.trim(),
						label: this.formData.label || undefined,
						filters,
					});

			promise.catch((err: unknown) => {
				console.error("[Flowti] Watcher save failed:", err);
				new Notice("Failed to save watcher. Check console for details.", 5000);
			});
		});
	}

	private emptyForm(): FormData {
		return {
			eventType: "",
			label: "",
			pathPattern: "",
			extension: "",
			namePattern: "",
		};
	}
}
