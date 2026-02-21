/**
 * TrainCaptureModal — Serial thought capture modal for Train of Thoughts.
 *
 * Follows the same pattern as QuickCaptureModal.
 * Each submission calls onSubmit, which creates the thought and opens
 * a new modal (recursive loop managed by the caller in main.ts).
 */

import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";

export interface TrainCaptureModalOptions {
	trainTitle: string;
	previousThoughtTitle: string | null;
	thoughtCount: number;
	onSubmit: (title: string) => void;
	onCancel: () => void;
}

export class TrainCaptureModal extends Modal {
	private readonly options: TrainCaptureModalOptions;
	private submitted = false;

	constructor(app: App, options: TrainCaptureModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: `Train: ${this.options.trainTitle}` });

		// Context banner (hidden for first thought)
		if (this.options.previousThoughtTitle) {
			const bannerEl = contentEl.createDiv({ cls: "flowti-train-context" });
			bannerEl.createSpan({ text: `Previous: ${this.options.previousThoughtTitle}` });
		}

		// Thought counter
		contentEl.createDiv({
			cls: "flowti-train-counter",
			text: `Thought #${this.options.thoughtCount + 1}`,
		});

		let titleValue = "";

		const submit = (): void => {
			const trimmed = titleValue.trim();
			if (trimmed) {
				this.submitted = true;
				this.options.onSubmit(trimmed);
				this.close();
			}
		};

		// Title input
		new Setting(contentEl)
			.setName("Thought")
			.addText((text) => {
				text
					.setPlaceholder("What\u2019s on your mind\u2026")
					.onChange((value) => { titleValue = value; });
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						submit();
					}
				});
				// Auto-focus with slight delay for modal rendering
				setTimeout(() => text.inputEl.focus(), 50);
			});

		// Action buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Pause Train").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText("Add Thought")
					.setCta()
					.onClick(() => submit())
			);
	}

	onClose(): void {
		if (!this.submitted) {
			this.options.onCancel();
		}
		this.contentEl.empty();
	}
}
