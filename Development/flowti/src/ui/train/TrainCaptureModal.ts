/**
 * TrainCaptureModal — Serial thought capture modal for Train of Thoughts.
 *
 * Follows the same pattern as QuickCaptureModal.
 * Each submission calls onSubmit, which creates the thought and opens
 * a new modal (recursive loop managed by the caller in main.ts).
 */

import { Modal, Setting } from "obsidian";
import type { App } from "obsidian";
import type { ThoughtDirection } from "../../domain/train/types";

/** Format milliseconds as MM:SS. */
function formatTimer(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export interface TrainCaptureModalOptions {
	trainTitle: string;
	previousThoughtTitle: string | null;
	thoughtCount: number;
	onSubmit: (title: string, direction: ThoughtDirection) => void;
	onComplete: () => void;
	onCancel: () => void;
	/** Timer duration in minutes (0 = no timer). */
	durationMinutes: number;
	/** Subscribe to session.timer.tick — returns unsubscribe fn. */
	subscribeTimerTick?: (cb: (remainingMs: number) => void) => () => void;
	/** Subscribe to session.timer.completed — returns unsubscribe fn. */
	subscribeTimerCompleted?: (cb: () => void) => () => void;
}

export class TrainCaptureModal extends Modal {
	private readonly options: TrainCaptureModalOptions;
	private submitted = false;
	private completed = false;
	private unsubTick: (() => void) | null = null;
	private unsubCompleted: (() => void) | null = null;

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

		// Timer display (only when timeboxed)
		if (this.options.durationMinutes > 0 && this.options.subscribeTimerTick) {
			const timerEl = contentEl.createDiv({ cls: "flowti-train-timer" });
			timerEl.setText(formatTimer(this.options.durationMinutes * 60_000));

			this.unsubTick = this.options.subscribeTimerTick((remainingMs) => {
				timerEl.setText(formatTimer(remainingMs));
			});

			if (this.options.subscribeTimerCompleted) {
				this.unsubCompleted = this.options.subscribeTimerCompleted(() => {
					this.completed = true;
					this.close();
				});
			}
		}

		let titleValue = "";
		let selectedDirection: ThoughtDirection = "next";

		const submit = (): void => {
			const trimmed = titleValue.trim();
			if (trimmed) {
				this.submitted = true;
				this.options.onSubmit(trimmed, selectedDirection);
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

		// Direction selector (hidden for first thought — no previous to branch from)
		if (this.options.previousThoughtTitle) {
			new Setting(contentEl)
				.setName("Direction")
				.addDropdown((dd) => {
					dd.addOption("next", "Continue chain \u2192");
					dd.addOption("branch", "Branch \u2197");
					dd.onChange((value) => { selectedDirection = value as ThoughtDirection; });
				});
		}

		// Action buttons
		new Setting(contentEl)
			.addButton((btn) =>
				btn.setButtonText("Pause").onClick(() => this.close())
			)
			.addButton((btn) =>
				btn.setButtonText("Complete").onClick(() => {
					this.completed = true;
					this.close();
				})
			)
			.addButton((btn) =>
				btn
					.setButtonText("Add Thought")
					.setCta()
					.onClick(() => submit())
			);
	}

	onClose(): void {
		this.unsubTick?.();
		this.unsubCompleted?.();

		if (!this.submitted) {
			if (this.completed) {
				this.options.onComplete();
			} else {
				this.options.onCancel();
			}
		}
		this.contentEl.empty();
	}
}
