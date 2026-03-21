import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";

// Re-export NewSessionModal and its types from dedicated file
export { NewSessionModal } from "./NewSessionModal.js";
export type { SessionTemplateSummary } from "./NewSessionModal.js";

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
 * A manual QA checkpoint modal with instruction text, a notes textarea,
 * and Fail/Pass buttons. Used by E2E tests to pause for operator verification.
 */
export class ManualQaModal extends Modal {
	private instruction: string;
	private onResult: (result: { value: "pass" | "fail"; notes: string }) => void;

	constructor(app: App, options: { instruction: string; onResult: (result: { value: "pass" | "fail"; notes: string }) => void }) {
		super(app);
		this.instruction = options.instruction;
		this.onResult = options.onResult;
	}

	onOpen(): void {
		const { contentEl } = this;
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		contentEl.createEl("h3", { text: "Manual QA" });
		contentEl.createEl("p", { text: this.instruction });

		let notes = "";

		new Setting(contentEl)
			.setName("Notes")
			.setDesc("Optional observations")
			.addTextArea((ta) => {
				ta.setPlaceholder("Optional observations...");
				ta.onChange((value) => { notes = value; });
				ta.inputEl.rows = 4;
				ta.inputEl.addClass("ft-w-full");
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Fail").setWarning().onClick(() => {
					this.onResult({ value: "fail", notes: notes.trim() });
					this.close();
				})
			)
			.addButton((btn) =>
				btn.setButtonText("Pass").setCta().onClick(() => {
					this.onResult({ value: "pass", notes: notes.trim() });
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

		const submit = (): void => {
			const trimmed = inputValue.trim();
			if (trimmed) {
				this.onSubmit(trimmed);
				this.close();
			}
		};

		new Setting(contentEl)
			.setName(this.inputName)
			.setDesc(this.inputDesc)
			.addText((text) => {
				text
					.setPlaceholder(this.placeholder)
					.setValue(this.defaultValue)
					.onChange((value) => { inputValue = value; });
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						submit();
					}
				});
				setTimeout(() => text.inputEl.focus(), 50);
			});

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText(this.submitLabel)
					.setCta()
					.onClick(() => submit())
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
		contentEl.createEl("h3", { text: "Save as template" });

		const desc = contentEl.createDiv({ cls: "ft-text-sm ft-text-muted ft-desc-margin" });
		desc.setText(`Type: ${this.sessionType} | Duration: ${this.sessionDuration} min`);

		let name = this.sessionTitle;

		new Setting(contentEl)
			.setName("Template name")
			.setDesc("A name to identify this template")
			.addText((text) =>
				text.setValue(this.sessionTitle)
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("e.g. Sprint storming")
					.onChange((value) => { name = value; })
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Save template").setCta().onClick(() => {
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
			// eslint-disable-next-line obsidianmd/ui/sentence-case
		.setDesc("Use dot notation (e.g. order.placed)")
			.addText((text) =>
				// eslint-disable-next-line obsidianmd/ui/sentence-case
			text.setPlaceholder("my.custom.event")
					.onChange((value) => { eventName = value; })
			);

		new Setting(contentEl)
			.setName("Category")
			.setDesc("Group this event under a category (e.g. Orders)")
			.addText((text) =>
				text.setPlaceholder("Optional")
					.onChange((value) => { category = value; })
			);

		if (this.existingCategories.length > 0) {
			const hint = contentEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-hint-spacing" });
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
