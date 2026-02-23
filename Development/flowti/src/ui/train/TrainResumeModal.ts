/**
 * TrainResumeModal — Smart resume decision modal.
 *
 * Shown when resuming a paused train and the last active thought
 * is NOT the head node. Presents 3 options:
 *   1. "Jump to end" — navigate to head, open capture from there
 *   2. "Branch from here" — stay on current node, open capture with branch direction
 *   3. "Stay here" — dismiss, open detail view at current position
 */

import { Modal, setIcon } from "obsidian";
import type { App } from "obsidian";

export type ResumeChoice = "jump-to-end" | "branch-from-here" | "stay-here";

export interface TrainResumeModalOptions {
	trainTitle: string;
	currentThoughtTitle: string;
	headThoughtTitle: string;
	onChoice: (choice: ResumeChoice) => void;
}

export class TrainResumeModal extends Modal {
	private readonly options: TrainResumeModalOptions;
	private chosen = false;

	constructor(app: App, options: TrainResumeModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("ft-train-resume-modal");

		// Title
		contentEl.createEl("h3", { text: `Resume: ${this.options.trainTitle}` });

		// Description
		const desc = contentEl.createDiv({ cls: "ft-text-muted ft-text-sm ft-mb-3" });
		desc.setText(
			`You're on "${this.options.currentThoughtTitle}" — not the latest thought ("${this.options.headThoughtTitle}").`,
		);

		// Options
		const optionsEl = contentEl.createDiv({ cls: "ft-flex ft-flex-col ft-gap-2 ft-train-resume-options" });

		// Option 1: Jump to end
		this.renderOption(optionsEl, {
			icon: "fast-forward",
			label: "Jump to end",
			description: `Continue from "${this.options.headThoughtTitle}"`,
			choice: "jump-to-end",
			primary: true,
		});

		// Option 2: Branch from here
		this.renderOption(optionsEl, {
			icon: "git-branch",
			label: "Branch from here",
			description: `Create a branch from "${this.options.currentThoughtTitle}"`,
			choice: "branch-from-here",
		});

		// Option 3: Stay here
		this.renderOption(optionsEl, {
			icon: "eye",
			label: "Stay here",
			description: "Open detail view at current position",
			choice: "stay-here",
		});
	}

	onClose(): void {
		if (!this.chosen) {
			// Treat close without choice as "stay here"
			this.options.onChoice("stay-here");
		}
	}

	private renderOption(
		container: HTMLElement,
		config: {
			icon: string;
			label: string;
			description: string;
			choice: ResumeChoice;
			primary?: boolean;
		},
	): void {
		const btn = container.createEl("button", {
			cls: `ft-btn ${config.primary ? "ft-btn-primary" : "ft-btn-ghost"} ft-text-left ft-p-3 ft-train-resume-option`,
		});
		btn.dataset.choice = config.choice;

		const row = btn.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const iconEl = row.createSpan();
		setIcon(iconEl, config.icon);
		const textCol = row.createDiv();
		textCol.createDiv({ text: config.label, cls: "ft-text-sm ft-text-bold" });
		textCol.createDiv({ text: config.description, cls: "ft-text-xs ft-text-muted" });

		btn.addEventListener("click", () => {
			this.chosen = true;
			this.options.onChoice(config.choice);
			this.close();
		});
	}
}
