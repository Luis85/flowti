/**
 * TrainCaptureModal — Serial thought capture modal for Train of Thoughts.
 *
 * Follows the same pattern as QuickCaptureModal.
 * Each submission calls onSubmit, which creates the thought and opens
 * a new modal (recursive loop managed by the caller in main.ts).
 *
 * Layout (top to bottom):
 *   1. Title (h3) + rename pencil
 *   2. Timer (if timeboxed)
 *   3. Title input (primary interaction)
 *   4. Direction row: counter + dropdown + Tab hint (secondary interaction)
 *   5. Action row: Back (outer left) | nav (Up/Next) + Pause/Complete/Add Thought
 */

import { Modal, Setting, setIcon } from "obsidian";
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
	/** Navigate to the branch parent (down link). */
	onDown?: () => void;
	/** Timer duration in minutes (0 = no timer). */
	durationMinutes: number;
	/** Current remaining time in ms — used as initial display to avoid reset flash. */
	initialRemainingMs?: number;
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
	/** Called when user renames the current thought via the pencil icon. */
	onRenameThought?: (newTitle: string) => void;
	/** Pre-select "Merge down" direction when opening from the detail view merge button. */
	defaultMergeDown?: boolean;
	/** True when the source thought has been merged into another thought. */
	isMerged?: boolean;
}

type NavAction = "back" | "next" | "up" | "down";

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

		// ── Row 1: Title + rename pencil ──
		const titleRow = contentEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });

		const titleEl = titleRow.createEl("h3", {
			text: this.options.previousThoughtTitle ?? this.options.trainTitle,
		});

		// Merged badge
		if (this.options.isMerged) {
			const badge = titleRow.createSpan({ cls: "ft-badge ft-badge-muted ft-train-merged-badge" });
			badge.setText("Merged");
		}

		// Rename thought (pencil icon) — only when navigated to an existing thought
		if (this.options.onRenameThought && this.options.previousThoughtTitle) {
			const editBtn = titleRow.createEl("button", { cls: "clickable-icon" });
			editBtn.setAttribute("aria-label", "Rename thought");
			setIcon(editBtn, "pencil");
			editBtn.addEventListener("click", () => {
				titleEl.style.display = "none";
				editBtn.style.display = "none";

				const input = document.createElement("input");
				input.type = "text";
				input.className = "ft-train-rename-input";
				input.value = titleEl.textContent ?? "";
				input.style.width = "100%";
				input.style.fontSize = "inherit";
				titleRow.appendChild(input);
				input.focus();
				input.select();

				const confirm = (): void => {
					const newTitle = input.value.trim();
					if (newTitle && newTitle !== this.options.previousThoughtTitle) {
						this.options.onRenameThought!(newTitle);
						titleEl.setText(newTitle);
					}
					input.remove();
					titleEl.style.display = "";
					editBtn.style.display = "";
				};

				const cancel = (): void => {
					input.remove();
					titleEl.style.display = "";
					editBtn.style.display = "";
				};

				input.addEventListener("keydown", (e: KeyboardEvent) => {
					if (e.key === "Enter") { e.preventDefault(); confirm(); }
					if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); cancel(); }
					if (e.key === "Tab") { e.stopPropagation(); } // Don't cycle direction while renaming
				});
				input.addEventListener("blur", confirm);
			});
		}

		// ── Row 2: Timer display (only when timeboxed) ──
		if (this.options.durationMinutes > 0 && this.options.subscribeTimerTick) {
			const timerEl = contentEl.createDiv({ cls: "ft-train-timer" });
			const initialMs = this.options.initialRemainingMs ?? this.options.durationMinutes * 60_000;
			timerEl.setText(formatTimer(initialMs));

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
		const hasMergeDown = !!this.options.isBranchEndpoint && !!this.options.onMergeDown;
		let selectedDirection: string = (this.options.defaultMergeDown && hasMergeDown)
			? "merge-down"
			: (this.options.defaultDirection ?? "next");
		let dropdownEl: HTMLSelectElement | null = null;
		const hasDirection = !!this.options.previousThoughtTitle;
		let mergeDownPending = selectedDirection === "merge-down";

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

		// ── Row 3: Title input (primary interaction) ──
		new Setting(contentEl)
			.setName(`Thought #${this.options.thoughtCount + 1}`)
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

		// ── Row 4: Direction row — Tab hint + dropdown ──
		if (hasDirection) {
			const dirRow = new Setting(contentEl);

			// Tab hint (before dropdown)
			const hint = dirRow.controlEl.createSpan({ cls: "ft-text-sm ft-text-muted" });
			hint.setText("Tab to cycle");
			hint.style.marginRight = "0.5rem";

			dirRow.addDropdown((dd) => {
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

		// ── Row 5: Action row — Back (outer left) | nav (Up/Next) + Pause/Complete/Add Thought ──
		const actionSetting = new Setting(contentEl);
		actionSetting.settingEl.style.width = "100%";
		if (actionSetting.infoEl) actionSetting.infoEl.style.display = "none";

		// Back button at the outermost left of the action row (same style as Next)
		if (this.options.onBack) {
			actionSetting.addButton((btn) => {
				btn.setButtonText("\u25C4 back").onClick(() => {
					this.navAction = "back";
					this.close();
				});
				btn.buttonEl.style.marginRight = "auto";
				btn.buttonEl.classList.add("ft-train-back-btn");
			});
		}

		// Navigation buttons (Up, Down, Next)
		if (this.options.onUp) {
			actionSetting.addButton((btn) =>
				btn.setButtonText("\u2191 up").onClick(() => {
					this.navAction = "up";
					this.close();
				})
			);
		}
		if (this.options.onDown) {
			actionSetting.addButton((btn) =>
				btn.setButtonText("\u2193 down").onClick(() => {
					this.navAction = "down";
					this.close();
				})
			);
		}
		if (this.options.onNext) {
			actionSetting.addButton((btn) =>
				btn.setButtonText("Next \u25BA").onClick(() => {
					this.navAction = "next";
					this.close();
				})
			);
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
					.setButtonText("Add thought")
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
			} else if (this.navAction === "down") {
				this.options.onDown?.();
			} else if (this.completed) {
				this.options.onComplete();
			} else {
				this.options.onCancel();
			}
		}
		this.contentEl.empty();
	}
}
