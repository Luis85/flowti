/**
 * DashboardNameModal — prompts for a dashboard name on creation.
 *
 * Simple Obsidian Modal with a text input and Create/Cancel buttons.
 * Empty name validation: Create button disabled when input is empty.
 */

import { Modal } from "obsidian";
import type { App } from "obsidian";

export interface DashboardNameModalOptions {
	onConfirm: (name: string) => void;
}

export class DashboardNameModal extends Modal {
	private readonly options: DashboardNameModalOptions;

	constructor(app: App, options: DashboardNameModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;

		contentEl.createEl("h3", { text: "New dashboard" });
		contentEl.createDiv({
			text: "Give your dashboard a meaningful name.",
			cls: "ft-text-muted ft-text-sm",
		});

		const inputEl = contentEl.createEl("input", { type: "text", cls: "ft-nq-modal-input" });
		inputEl.placeholder = "Dashboard name";

		const btnRow = contentEl.createDiv({ cls: "ft-flex ft-gap-1 ft-justify-end" });

		const cancelBtn = btnRow.createEl("button", { text: "Cancel" });
		cancelBtn.addEventListener("click", () => this.close());

		const createBtn = btnRow.createEl("button", { text: "Create", cls: "mod-cta" });
		createBtn.disabled = true;

		inputEl.addEventListener("input", () => {
			createBtn.disabled = inputEl.value.trim().length === 0;
		});

		const submit = (): void => {
			const name = inputEl.value.trim();
			if (name.length === 0) return;
			this.options.onConfirm(name);
			this.close();
		};

		createBtn.addEventListener("click", submit);
		inputEl.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				submit();
			}
		});

		// Auto-focus the input
		setTimeout(() => inputEl.focus(), 50);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
