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
	/** True when the source thought is a branch endpoint eligible for merge-down. */
	isBranchEndpoint?: boolean;
	/** Called when user selects "Merge down" direction. Creates thought + auto-merges to main chain. */
	onMergeDown?: (title: string) => void;
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
		// Title: show previous thought title (or train title for the first thought)
		contentEl.createEl("h3", {
			text: this.options.previousThoughtTitle ?? this.options.trainTitle,
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
		let selectedDirection: string = this.options.defaultDirection ?? "next";
		let dropdownEl: HTMLSelectElement | null = null;
		const hasDirection = !!this.options.previousThoughtTitle;
		const hasMergeDown = !!this.options.isBranchEndpoint && !!this.options.onMergeDown;
		let mergeDownPending = false;

		// Build the list of available directions for Tab cycling
		const directionOptions: string[] = ["next", "branch"];
		if (hasMergeDown) directionOptions.push("merge-down");

		const submit = (): void => {
			const trimmed = titleValue.trim();
			if (!trimmed) return;

			if (mergeDownPending || selectedDirection === "merge-down") {
				// Merge-down: intercepted before onSubmit — creates thought + auto-merges
				this.submitted = true;
				this.options.onMergeDown!(trimmed);
				this.close();
			} else {
				this.submitted = true;
				this.options.onSubmit(trimmed, selectedDirection as ThoughtDirection);
				this.close();
			}
		};

		const cycleDirection = (): void => {
			if (!hasDirection || !dropdownEl) return;
			const currentIdx = directionOptions.indexOf(selectedDirection);
			const nextIdx = (currentIdx + 1) % directionOptions.length;
			selectedDirection = directionOptions[nextIdx];
			mergeDownPending = selectedDirection === "merge-down";
			dropdownEl.value = selectedDirection;
			dropdownEl.dispatchEvent(new Event("change"));
		};

		// Modal-level keyboard handler: Esc to cancel, Tab to cycle direction
		contentEl.addEventListener("keydown", (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				this.close();
			} else if (e.key === "Tab" && hasDirection) {
				e.preventDefault();
				cycleDirection();
			}
		});

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

		// Action row: direction dropdown (left) + buttons (right) + thought count
		const actionSetting = new Setting(contentEl);

		// Direction dropdown in the left name area (hidden for first thought)
		if (hasDirection) {
			actionSetting.addDropdown((dd) => {
				dd.addOption("next", "Continue chain \u2192");
				dd.addOption("branch", "Branch \u2197");
				if (hasMergeDown) {
					dd.addOption("merge-down", "Merge down \u2193");
				}
				dd.setValue(selectedDirection);
				dd.onChange((value) => {
					selectedDirection = value;
					mergeDownPending = value === "merge-down";
				});
				dropdownEl = dd.selectEl;
			});
		}

		actionSetting
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

		// Keyboard hint below action row (only when direction is available)
		if (hasDirection) {
			const hint = actionSetting.controlEl.createSpan({ cls: "ft-text-sm ft-text-muted" });
			hint.style.marginLeft = "0.5rem";
			hint.setText("Tab to cycle");
		}

		// Thought count
		const countEl = actionSetting.controlEl.createSpan({ cls: "ft-text-sm ft-text-muted" });
		countEl.style.marginLeft = "0.5rem";
		countEl.setText(`#${this.options.thoughtCount + 1}`);
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
