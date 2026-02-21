/**
 * Triage panel for vault folder inbox items.
 *
 * Renders a type dropdown, optional description field, and file path
 * display. "Triage" button applies frontmatter and optionally routes
 * the file to a target folder via InboxService.triageVaultFolderItem().
 */

import { setIcon } from "obsidian";
import type { UserHubComponentDeps, InboxItem } from "./types";

/** Available note types for triage classification. */
export const NOTE_TYPES = [
	"idea", "note", "task", "question", "feedback", "bug",
	"risk", "assumption", "issue", "decision",
] as const;

export class VaultFolderTriagePanel {
	constructor(
		private containerEl: HTMLElement,
		private deps: UserHubComponentDeps,
		private item: InboxItem,
	) {}

	render(): void {
		const section = this.containerEl.createDiv({ cls: "ft-detail-section" });

		// Section heading
		const heading = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = heading.createSpan();
		setIcon(icon, "file-check");
		icon.addClass("ft-icon-muted");
		heading.createEl("h4", { text: "Triage", cls: "ft-heading" }).style.margin = "0";

		// Type dropdown
		const typeRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		typeRow.style.marginTop = "0.5rem";
		typeRow.createSpan({ text: "Type", cls: "ft-text-sm" }).style.minWidth = "80px";
		const typeSelect = typeRow.createEl("select", { cls: "dropdown" });
		typeSelect.style.flex = "1";
		for (const t of NOTE_TYPES) {
			const opt = typeSelect.createEl("option", { text: t });
			opt.value = t;
		}

		// Description field
		const descRow = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		descRow.style.marginTop = "0.5rem";
		descRow.createSpan({ text: "Description", cls: "ft-text-sm" }).style.minWidth = "80px";
		const descInput = descRow.createEl("input", { cls: "ft-input" });
		descInput.type = "text";
		descInput.placeholder = "Optional description...";
		descInput.style.flex = "1";

		// File path display
		if (this.item.filePath) {
			const pathRow = section.createDiv({ cls: "ft-text-sm ft-text-muted" });
			pathRow.style.marginTop = "0.5rem";
			pathRow.setText(`File: ${this.item.filePath}`);
		}

		// Triage button
		const btnRow = section.createDiv({ cls: "ft-flex ft-gap-2" });
		btnRow.style.marginTop = "0.75rem";
		const triageBtn = btnRow.createEl("button", { cls: "mod-cta" });
		setIcon(triageBtn, "check-circle");
		triageBtn.appendText(" Triage");
		triageBtn.addEventListener("click", () => {
			void this.deps.inboxService.triageVaultFolderItem(
				this.item.id,
				typeSelect.value,
				descInput.value || undefined,
			);
		});
	}
}
