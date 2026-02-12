import { App, Modal, Setting } from "obsidian";

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
	private submitLabel: string;
	private inputName: string;
	private inputDesc: string;
	private onSubmit: (value: string) => void;

	constructor(app: App, options: { title: string; placeholder?: string; submitLabel?: string; inputName?: string; inputDesc?: string; onSubmit: (value: string) => void }) {
		super(app);
		this.title = options.title;
		this.placeholder = options.placeholder ?? "";
		this.submitLabel = options.submitLabel ?? "Create";
		this.inputName = options.inputName ?? "Event name";
		this.inputDesc = options.inputDesc ?? "Use dot notation (e.g. my.custom.event)";
		this.onSubmit = options.onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.title });

		let inputValue = "";

		new Setting(contentEl)
			.setName(this.inputName)
			.setDesc(this.inputDesc)
			.addText((text) =>
				text
					.setPlaceholder(this.placeholder)
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
