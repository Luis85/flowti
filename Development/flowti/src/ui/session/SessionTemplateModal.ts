/**
 * Modal for editing an existing session template.
 *
 * Reuses the SessionService.updateTemplate() API.
 * Pattern follows SaveTemplateModal in modals.ts.
 */

import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { SessionTemplate, SessionType } from "../../domain/session/types";
import { SESSION_TYPES } from "../../domain/session/types";

export interface SessionTemplateModalOptions {
	template: SessionTemplate;
	onSubmit: (updates: { name: string; type: SessionType; durationMinutes: number; description: string }) => void;
}

export class SessionTemplateModal extends Modal {
	private opts: SessionTemplateModalOptions;

	constructor(app: App, opts: SessionTemplateModalOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: "Edit template" });

		let name = this.opts.template.name;
		let type: SessionType = this.opts.template.type;
		let duration = this.opts.template.durationMinutes;
		let description = this.opts.template.description ?? "";

		new Setting(contentEl)
			.setName("Name")
			.addText((text) =>
				text.setValue(name).onChange((v) => { name = v; }),
			);

		new Setting(contentEl)
			.setName("Type")
			.addDropdown((dd) => {
				for (const st of SESSION_TYPES) {
					dd.addOption(st.type, st.label);
				}
				dd.setValue(type);
				dd.onChange((v) => { type = v as SessionType; });
			});

		new Setting(contentEl)
			.setName("Duration (minutes)")
			.addText((text) =>
				text.setValue(String(duration)).onChange((v) => { duration = parseInt(v, 10) || duration; }),
			);

		new Setting(contentEl)
			.setName("Description")
			.addText((text) =>
				text.setValue(description).onChange((v) => { description = v; }),
			);

		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Cancel").onClick(() => this.close()),
			)
			.addButton((btn) =>
				btn.setButtonText("Save changes").setCta().onClick(() => {
					const trimmed = name.trim();
					if (trimmed && duration > 0) {
						this.opts.onSubmit({
							name: trimmed,
							type,
							durationMinutes: duration,
							description: description.trim(),
						});
						this.close();
					}
				}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
