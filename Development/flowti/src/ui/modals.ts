import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";

/**
 * A simple confirmation modal with a message and confirm/cancel buttons.
 */
export class ConfirmModal extends Modal {
	private message: string;
	private confirmLabel: string;
	private onConfirm: () => void;

	constructor(app: App, options: { message: string; confirmLabel?: string; onConfirm: () => void }) {
		super(app);
		this.message = options.message;
		this.confirmLabel = options.confirmLabel ?? "Confirm";
		this.onConfirm = options.onConfirm;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message });

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.confirmLabel)
					.setWarning()
					.setCta()
					.onClick(() => {
						this.onConfirm();
						this.close();
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * A modal with a single text input and submit/cancel buttons.
 */
export class InputModal extends Modal {
	private title: string;
	private placeholder: string;
	private defaultValue: string;
	private submitLabel: string;
	private inputName: string;
	private inputDesc: string;
	private onSubmit: (value: string) => void;

	constructor(app: App, options: { title: string; placeholder?: string; defaultValue?: string; submitLabel?: string; inputName?: string; inputDesc?: string; onSubmit: (value: string) => void }) {
		super(app);
		this.title = options.title;
		this.placeholder = options.placeholder ?? "";
		this.defaultValue = options.defaultValue ?? "";
		this.submitLabel = options.submitLabel ?? "Create";
		this.inputName = options.inputName ?? "Event name";
		this.inputDesc = options.inputDesc ?? "Use dot notation (e.g. my.custom.event)";
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.title });

		let inputValue = this.defaultValue;

		new Setting(contentEl)
			.setName(this.inputName)
			.setDesc(this.inputDesc)
			.addText((text) =>
				text
					.setPlaceholder(this.placeholder)
					.setValue(this.defaultValue)
					.onChange((value) => { inputValue = value; })
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.submitLabel)
					.setCta()
					.onClick(() => {
						const trimmed = inputValue.trim();
						if (trimmed) {
							this.onSubmit(trimmed);
							this.close();
						}
					})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * A modal for creating a new documentation session.
 * Collects title, type, and duration then calls onSubmit.
 */
export interface SessionTemplateSummary {
	id: string;
	name: string;
	type: string;
	durationMinutes: number;
}

export class NewSessionModal extends Modal {
	private sessionTypes: ReadonlyArray<{ type: string; label: string; description: string }>;
	private templates: ReadonlyArray<SessionTemplateSummary>;
	private prefill?: { title: string; type: string; durationMinutes: number };
	private onSubmit: (title: string, type: string, durationMinutes: number) => void;

	constructor(app: App, options: {
		sessionTypes: ReadonlyArray<{ type: string; label: string; description: string }>;
		templates?: ReadonlyArray<SessionTemplateSummary>;
		prefill?: { title: string; type: string; durationMinutes: number };
		onSubmit: (title: string, type: string, durationMinutes: number) => void;
	}) {
		super(app);
		this.sessionTypes = options.sessionTypes;
		this.templates = options.templates ?? [];
		this.prefill = options.prefill;
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "New Session" });

		let title = this.prefill?.title ?? "";
		let type = this.prefill?.type ?? this.sessionTypes[0]?.type ?? "event-storming";
		let duration = this.prefill?.durationMinutes ?? 25;

		// Template chooser (only shown when templates exist)
		if (this.templates.length > 0) {
			new Setting(contentEl)
				.setName("From Template")
				.setDesc("Pre-fill from a saved template")
				.addDropdown((dropdown) => {
					dropdown.addOption("", "-- None --");
					for (const t of this.templates) {
						dropdown.addOption(t.id, t.name);
					}
					dropdown.onChange((templateId) => {
						if (!templateId) return;
						const tmpl = this.templates.find((t) => t.id === templateId);
						if (tmpl) {
							// Close and re-open with prefill (Obsidian controls lack .setValue())
							this.close();
							new NewSessionModal(this.app, {
								sessionTypes: this.sessionTypes,
								templates: this.templates,
								prefill: { title: tmpl.name, type: tmpl.type, durationMinutes: tmpl.durationMinutes },
								onSubmit: this.onSubmit,
							}).open();
						}
					});
				});
		}

		new Setting(contentEl)
			.setName("Title")
			.setDesc("A short name for this session")
			.addText((text) =>
				text.setPlaceholder("e.g. Sprint 12 Event Storming")
					.setValue(title)
					.onChange((value) => { title = value; })
			);

		new Setting(contentEl)
			.setName("Type")
			.setDesc("The kind of documentation activity")
			.addDropdown((dropdown) => {
				for (const st of this.sessionTypes) {
					dropdown.addOption(st.type, st.label);
				}
				dropdown.setValue(type);
				dropdown.onChange((value) => { type = value; });
			});

		new Setting(contentEl)
			.setName("Duration")
			.setDesc("Timer length in minutes")
			.addDropdown((dropdown) => {
				dropdown.addOption("25", "25 min (Pomodoro)");
				dropdown.addOption("50", "50 min (Deep Work)");
				dropdown.addOption("15", "15 min (Quick)");
				dropdown.addOption("45", "45 min");
				dropdown.addOption("60", "60 min");
				dropdown.setValue(String(duration));
				dropdown.onChange((value) => { duration = parseInt(value, 10); });
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Create").setCta().onClick(() => {
					const trimmed = title.trim();
					if (trimmed) {
						this.onSubmit(trimmed, type, duration);
						this.close();
					}
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * A modal for saving a session as a reusable template.
 * Pre-fills the name from the session title; shows type and duration as read-only.
 */
export class SaveTemplateModal extends Modal {
	private sessionTitle: string;
	private sessionType: string;
	private sessionDuration: number;
	private onSubmit: (name: string) => void;

	constructor(app: App, options: {
		sessionTitle: string;
		sessionType: string;
		sessionDuration: number;
		onSubmit: (name: string) => void;
	}) {
		super(app);
		this.sessionTitle = options.sessionTitle;
		this.sessionType = options.sessionType;
		this.sessionDuration = options.sessionDuration;
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Save as Template" });

		const desc = contentEl.createDiv({ cls: "ft-text-sm ft-text-muted" });
		desc.style.marginBottom = "0.75rem";
		desc.setText(`Type: ${this.sessionType} | Duration: ${this.sessionDuration} min`);

		let name = this.sessionTitle;

		new Setting(contentEl)
			.setName("Template Name")
			.setDesc("A name to identify this template")
			.addText((text) =>
				text.setValue(this.sessionTitle)
					.setPlaceholder("e.g. Sprint Storming")
					.onChange((value) => { name = value; })
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Save Template").setCta().onClick(() => {
					const trimmed = name.trim();
					if (trimmed) {
						this.onSubmit(trimmed);
						this.close();
					}
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * A fuzzy-suggest modal for choosing between saved configs (or starting fresh).
 */
export interface ConfigChooserItem {
	id: string;
	name: string;
}

const FRESH_ITEM: ConfigChooserItem = { id: "__fresh__", name: "Start fresh (no config)" };

export class ConfigChooserModal extends FuzzySuggestModal<ConfigChooserItem> {
	private items: ConfigChooserItem[];
	private onChooseConfig: (id: string | null) => void;

	constructor(
		app: App,
		configs: ConfigChooserItem[],
		onChoose: (id: string | null) => void,
	) {
		super(app);
		this.items = [...configs, FRESH_ITEM];
		this.onChooseConfig = onChoose;
		this.setPlaceholder("Choose a config or start fresh...");
	}

	getItems(): ConfigChooserItem[] {
		return this.items;
	}

	getItemText(item: ConfigChooserItem): string {
		return item.name;
	}

	onChooseItem(item: ConfigChooserItem): void {
		this.onChooseConfig(item.id === "__fresh__" ? null : item.id);
	}
}

/**
 * A modal for creating a new event with an optional category.
 */
export class CreateEventModal extends Modal {
	private title: string;
	private existingCategories: string[];
	private onSubmit: (eventName: string, category?: string) => void;

	constructor(app: App, options: {
		title: string;
		existingCategories?: string[];
		onSubmit: (eventName: string, category?: string) => void;
	}) {
		super(app);
		this.title = options.title;
		this.existingCategories = options.existingCategories ?? [];
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.title });

		let eventName = "";
		let category = "";

		new Setting(contentEl)
			.setName("Event name")
			.setDesc("Use dot notation (e.g. order.placed)")
			.addText((text) =>
				text.setPlaceholder("my.custom.event")
					.onChange((value) => { eventName = value; })
			);

		new Setting(contentEl)
			.setName("Category")
			.setDesc("Group this event under a category (e.g. Orders)")
			.addText((text) =>
				text.setPlaceholder("optional")
					.onChange((value) => { category = value; })
			);

		if (this.existingCategories.length > 0) {
			const hint = contentEl.createDiv({ cls: "ft-text-muted ft-text-sm" });
			hint.style.marginTop = "-0.5rem";
			hint.style.marginBottom = "0.75rem";
			hint.style.paddingLeft = "0.5rem";
			hint.setText("Existing: " + this.existingCategories.join(", "));
		}

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Create").setCta().onClick(() => {
					const trimmed = eventName.trim();
					if (trimmed) {
						this.onSubmit(trimmed, category.trim() || undefined);
						this.close();
					}
				})
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
