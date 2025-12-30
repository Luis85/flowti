import { App, Modal } from "obsidian";

export interface ConfirmModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: "default" | "danger" | "warning";
}

export class ConfirmModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private options: ConfirmModalOptions,
		private onResult: (confirmed: boolean) => void
	) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mm-confirm-modal");

		if (this.options.variant) {
			contentEl.addClass(`is-${this.options.variant}`);
		}

		// Title
		contentEl.createEl("h2", {
			text: this.options.title,
			cls: "mm-confirm-modal__title",
		});

		// Message
		contentEl.createEl("p", {
			text: this.options.message,
			cls: "mm-confirm-modal__message",
		});

		// Actions
		const actions = contentEl.createDiv({ cls: "mm-confirm-modal__actions" });

		// Cancel button
		const cancelBtn = actions.createEl("button", {
			text: this.options.cancelText ?? "Cancel",
			cls: "mm-confirm-modal__btn mm-confirm-modal__btn--cancel",
		});
		cancelBtn.addEventListener("click", () => {
			this.resolve(false);
		});

		// Confirm button
		const confirmBtn = actions.createEl("button", {
			text: this.options.confirmText ?? "Confirm",
			cls: `mm-confirm-modal__btn mm-confirm-modal__btn--confirm is-${this.options.variant ?? "default"}`,
		});
		confirmBtn.addEventListener("click", () => {
			this.resolve(true);
		});

		// Focus cancel by default for dangerous actions
		if (this.options.variant === "danger") {
			cancelBtn.focus();
		} else {
			confirmBtn.focus();
		}
	}

	private resolve(confirmed: boolean) {
		if (this.resolved) return;
		this.resolved = true;
		this.onResult(confirmed);
		this.close();
	}

	onClose() {
		// If closed without resolving (e.g., Escape key), treat as cancel
		if (!this.resolved) {
			this.onResult(false);
		}
		this.contentEl.empty();
	}
}
