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
	/** Pre-filled folder path from resolved capture config */
	defaultFolder?: string;
	/** Pre-filled template path from resolved capture config */
	defaultTemplate?: string;
}

export class QuickCaptureModal extends Modal {
	private readonly options: QuickCaptureModalOptions;

	constructor(app: App, options: QuickCaptureModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		const typeLabel = this.options.defaultType
			? this.options.defaultType.charAt(0).toUpperCase() + this.options.defaultType.slice(1)
			: null;
		contentEl.createEl("h3", { text: typeLabel ? `Capture ${typeLabel}` : "Quick Capture" });

		let selectedType: CaptureType = this.options.defaultType ?? "idea";
		let titleValue = "";

		// Type selector (only for command palette)
		if (this.options.showTypeSelector) {
			const typeRow = contentEl.createDiv({ cls: "setting-item" });
			typeRow.createDiv({ cls: "setting-item-info" }).createDiv({ cls: "setting-item-name", text: "Type" });
			const controlEl = typeRow.createDiv({ cls: "setting-item-control" });
			const selectEl = controlEl.createEl("select", { cls: "dropdown" });

			const generalGroup = selectEl.createEl("optgroup");
			generalGroup.label = "General";
			for (const [value, label] of [
				["idea", "Idea"], ["note", "Note"], ["task", "Task"],
				["question", "Question"], ["feedback", "Feedback"], ["bug", "Bug"],
				["learning", "Learning"],
			] as const) {
				const opt = generalGroup.createEl("option", { text: label });
				opt.value = value;
			}

			const raidGroup = selectEl.createEl("optgroup");
			raidGroup.label = "RAID";
			for (const [value, label] of [
				["risk", "Risk"], ["assumption", "Assumption"],
				["issue", "Issue"], ["decision", "Decision"],
			] as const) {
				const opt = raidGroup.createEl("option", { text: label });
				opt.value = value;
			}

			selectEl.value = selectedType;
			selectEl.addEventListener("change", () => {
				selectedType = selectEl.value as CaptureType;
			});
		}

		let descriptionValue = "";
		let folderValue = this.options.defaultFolder ?? "";
		let templateValue = this.options.defaultTemplate ?? "";

		const submit = (): void => {
			const trimmed = titleValue.trim();
			if (trimmed) {
				this.options.onSubmit({
					title: trimmed,
					type: selectedType,
					...(descriptionValue.trim() ? { description: descriptionValue.trim() } : {}),
					...(folderValue.trim() ? { folder: folderValue.trim() } : {}),
					...(templateValue.trim() ? { template: templateValue.trim() } : {}),
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
				text.inputEl.addClass("ft-input-full-width");
				text.inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") {
						e.preventDefault();
						submit();
					}
				});
			});

		// Description (optional)
		new Setting(contentEl)
			.setName("Description")
			.setDesc("Optional — adds context to the captured note")
			.addTextArea((area) => {
				area
					.setPlaceholder("Add a brief description\u2026")
					.onChange((value) => { descriptionValue = value; });
				area.inputEl.addClass("ft-input-full-width");
				area.inputEl.rows = 3;
			});

		// Folder
		new Setting(contentEl)
			.setName("Folder")
			.setDesc("Target folder for the captured note")
			.addText((text) => {
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case
					.setPlaceholder("00 - Connectivity/inbox")
					.setValue(folderValue)
					.onChange((value) => { folderValue = value; });
				text.inputEl.addClass("ft-input-full-width");
			});

		// Template
		new Setting(contentEl)
			.setName("Template")
			.setDesc("Optional — vault path to a template note")
			.addText((text) => {
				text
					.setPlaceholder("No template")
					.setValue(templateValue)
					.onChange((value) => { templateValue = value; });
				text.inputEl.addClass("ft-input-full-width");
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
