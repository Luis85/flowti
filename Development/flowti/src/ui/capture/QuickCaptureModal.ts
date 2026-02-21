/**
 * QuickCaptureModal — Minimal modal for capturing ideas and feedback.
 *
 * Follows the InputModal pattern from `src/ui/modals.ts`.
 * When opened from a ribbon icon, the type is pre-set (no selector).
 * When opened from the command palette, a type dropdown is shown.
 */

import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { CaptureInput, CaptureType } from "../../domain/capture/types";

export interface QuickCaptureModalOptions {
	onSubmit: (input: CaptureInput) => void;
	/** Show type selector dropdown (true for command palette, false for ribbon) */
	showTypeSelector?: boolean;
	/** Default capture type (pre-set from ribbon action) */
	defaultType?: CaptureType;
}

export class QuickCaptureModal extends Modal {
	private readonly options: QuickCaptureModalOptions;

	constructor(app: App, options: QuickCaptureModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Quick Capture" });

		let selectedType: CaptureType = this.options.defaultType ?? "idea";
		let titleValue = "";

		// Type selector (only for command palette)
		if (this.options.showTypeSelector) {
			new Setting(contentEl)
				.setName("Type")
				.addDropdown((dropdown) =>
					dropdown
						.addOption("idea", "Idea")
						.addOption("feedback", "Feedback")
						.addOption("bug", "Bug")
						.setValue(selectedType)
						.onChange((value) => { selectedType = value as CaptureType; })
				);
		}

		const submit = (): void => {
			const trimmed = titleValue.trim();
			if (trimmed) {
				this.options.onSubmit({
					title: trimmed,
					type: selectedType,
				});
				this.close();
			}
		};

		// Title input
		new Setting(contentEl)
			.setName("Title")
			.addText((text) => {
				text
					.setPlaceholder("Enter a title\u2026")
					.onChange((value) => { titleValue = value; });
				text.inputEl.style.width = "100%";
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						submit();
					}
				});
			});

		// Action buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn
					.setButtonText("Create")
					.setCta()
					.onClick(() => submit())
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
