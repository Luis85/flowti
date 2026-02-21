/**
 * TrainCaptureModal — Serial thought capture modal for Train of Thoughts.
 *
 * Follows the same pattern as QuickCaptureModal.
 * Each submission calls onSubmit, which creates the thought and opens
 * a new modal (recursive loop managed by the caller in main.ts).
 *
 * Navigation mirrors the frontmatter link model:
 *   back  — linear parent
 *   next  — linear child
 *   up    — first branch child
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
	/** Navigate to the linear parent (back link). */
	onBack?: () => void;
	/** Navigate to the linear child (next link). */
	onNext?: () => void;
	/** Navigate to the first branch child (up link). */
	onUp?: () => void;
	/** Timer duration in minutes (0 = no timer). */
	durationMinutes: number;
	/** Default direction for new thoughts. When the source thought already has a "next" child, defaults to "branch". */
	defaultDirection?: ThoughtDirection;
	/** Subscribe to session.timer.tick — returns unsubscribe fn. */
	subscribeTimerTick?: (cb: (remainingMs: number) => void) => () => void;
	/** Subscribe to session.timer.completed — returns unsubscribe fn. */
	subscribeTimerCompleted?: (cb: () => void) => () => void;
}

type NavAction = "back" | "next" | "up";

export class TrainCaptureModal extends Modal {
	private readonly options: TrainCaptureModalOptions;
	private submitted = false;
	private completed = false;
	private navAction: NavAction | null = null;
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
			const bannerEl = contentEl.createDiv({ cls: "ft-train-context" });
			if (this.options.onBack) {
				const link = bannerEl.createEl("a", {
					text: `Previous: ${this.options.previousThoughtTitle}`,
					cls: "ft-train-context-link",
				});
				link.addEventListener("click", (e) => {
					e.preventDefault();
					this.navAction = "back";
					this.close();
				});
			} else {
				bannerEl.createSpan({ text: `Previous: ${this.options.previousThoughtTitle}` });
			}
		}

		// Thought counter
		contentEl.createDiv({
			cls: "ft-train-counter",
			text: `Thought #${this.options.thoughtCount + 1}`,
		});

		// Timer display (only when timeboxed)
		if (this.options.durationMinutes > 0 && this.options.subscribeTimerTick) {
			const timerEl = contentEl.createDiv({ cls: "ft-train-timer" });
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
		let selectedDirection: ThoughtDirection = this.options.defaultDirection ?? "next";

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
					dd.setValue(selectedDirection);
					dd.onChange((value) => { selectedDirection = value as ThoughtDirection; });
				});
		}

		// Navigation buttons — mirrors the thought's link directions
		const hasNav = this.options.onBack || this.options.onNext || this.options.onUp;
		if (hasNav) {
			const nav = new Setting(contentEl);
			if (this.options.onBack) {
				nav.addButton((btn) =>
					btn.setButtonText("\u25C4 Back").onClick(() => {
						this.navAction = "back";
						this.close();
					})
				);
			}
			if (this.options.onUp) {
				nav.addButton((btn) =>
					btn.setButtonText("\u2191 Up").onClick(() => {
						this.navAction = "up";
						this.close();
					})
				);
			}
			if (this.options.onNext) {
				nav.addButton((btn) =>
					btn.setButtonText("Next \u25BA").onClick(() => {
						this.navAction = "next";
						this.close();
					})
				);
			}
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
			if (this.navAction === "back") {
				this.options.onBack?.();
			} else if (this.navAction === "next") {
				this.options.onNext?.();
			} else if (this.navAction === "up") {
				this.options.onUp?.();
			} else if (this.completed) {
				this.options.onComplete();
			} else {
				this.options.onCancel();
			}
		}
		this.contentEl.empty();
	}
}
