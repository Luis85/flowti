import { App, Modal, Setting } from "obsidian";

export interface ConfirmModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	danger?: boolean;
}

export class ConfirmModal extends Modal {
	private options: ConfirmModalOptions;
	private resolved = false;
	private resolve: (confirmed: boolean) => void = () => {};

	constructor(app: App, options: ConfirmModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("filewatcher-confirm-modal");

		// Title
		contentEl.createEl("h2", { text: this.options.title });

		// Message
		contentEl.createEl("p", {
			text: this.options.message,
			cls: "confirm-message",
		});

		// Buttons
		const buttonContainer = contentEl.createDiv({ cls: "confirm-buttons" });

		new Setting(buttonContainer)
			.addButton((b) =>
				b
					.setButtonText(this.options.cancelText ?? "Cancel")
					.onClick(() => {
						this.resolved = true;
						this.resolve(false);
						this.close();
					})
			)
			.addButton((b) => {
				b.setButtonText(this.options.confirmText ?? "Confirm").onClick(() => {
					this.resolved = true;
					this.resolve(true);
					this.close();
				});
				if (this.options.danger) {
					b.setWarning();
				} else {
					b.setCta();
				}
			});
	}

	onClose() {
		if (!this.resolved) {
			this.resolve(false);
		}
		this.contentEl.empty();
	}

	async waitForResult(): Promise<boolean> {
		return new Promise((resolve) => {
			this.resolve = resolve;
			this.open();
		});
	}
}

/**
 * Show a confirmation dialog and wait for the user's response
 */
export async function confirm(app: App, options: ConfirmModalOptions): Promise<boolean> {
	const modal = new ConfirmModal(app, options);
	return modal.waitForResult();
}

/**
 * Show a delete confirmation dialog
 */
export async function confirmDelete(
	app: App,
	itemName: string,
	additionalMessage?: string
): Promise<boolean> {
	return confirm(app, {
		title: "Confirm Delete",
		message: additionalMessage
			? `Delete "${itemName}"?\n\n${additionalMessage}`
			: `Delete "${itemName}"?`,
		confirmText: "Delete",
		cancelText: "Cancel",
		danger: true,
	});
}
