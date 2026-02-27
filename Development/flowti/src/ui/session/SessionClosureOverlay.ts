/**
 * Session Closure Ritual Overlay (FR-14).
 *
 * Full-view overlay rendered when session enters "reviewing" state.
 * Presents configurable closure questions from the resolved template.
 * Submit validates required fields; skip is always available.
 */

import { setIcon } from "obsidian";
import type { ClosureQuestion, ClosureResponse, ClosureTemplate, Session } from "../../domain/session/types";

export interface ClosureOverlayCallbacks {
	onSubmit: (response: ClosureResponse) => void;
	onSkip: () => void;
}

export class SessionClosureOverlay {
	private answers: Record<string, string> = {};

	constructor(
		private container: HTMLElement,
		private session: Session,
		private template: ClosureTemplate,
		private callbacks: ClosureOverlayCallbacks,
	) {}

	render(): void {
		const overlay = this.container.createDiv({ cls: "ft-closure-overlay" });

		// Header
		const header = overlay.createDiv({ cls: "ft-closure-header" });
		const iconEl = header.createDiv({ cls: "ft-closure-header-icon" });
		setIcon(iconEl, "clipboard-check");
		header.createEl("h3", { text: "Closure ritual" });
		header.createEl("p", {
			text: `Reflect on "${this.session.title}" before completing.`,
			cls: "ft-text-muted ft-closure-header-subtitle",
		});

		// Questions
		const form = overlay.createDiv({ cls: "ft-closure-form" });

		for (const q of this.template.questions) {
			this.renderQuestion(form, q);
		}

		// Actions
		const actions = overlay.createDiv({ cls: "ft-closure-actions" });

		const submitBtn = actions.createEl("button", { text: "Complete session", cls: "mod-cta ft-closure-submit-btn" });
		submitBtn.addEventListener("click", () => this.handleSubmit(form));

		const skipBtn = actions.createEl("button", { text: "Skip", cls: "ft-closure-skip" });
		skipBtn.addEventListener("click", () => this.callbacks.onSkip());
	}

	private renderQuestion(form: HTMLElement, q: ClosureQuestion): void {
		const group = form.createDiv({ cls: "ft-closure-question" });
		group.dataset.questionId = q.id;

		group.createEl("label", {
			text: q.question + (q.required ? " *" : ""),
			cls: "ft-closure-question-label",
		});

		if (q.type === "select" && q.options) {
			const selectEl = group.createEl("select", { cls: "ft-closure-select" });
			const placeholder = selectEl.createEl("option", { text: "Select..." });
			placeholder.value = "";
			for (const opt of q.options) {
				const optEl = selectEl.createEl("option", { text: opt });
				optEl.value = opt;
			}
			selectEl.addEventListener("change", () => {
				this.answers[q.id] = selectEl.value;
			});
		} else if (q.type === "rating") {
			const ratingRow = group.createDiv({ cls: "ft-closure-rating-row" });
			for (let i = 1; i <= 5; i++) {
				const btn = ratingRow.createEl("button", { text: String(i), cls: "ft-closure-rating-btn" });
				btn.addEventListener("click", () => {
					this.answers[q.id] = String(i);
					ratingRow.querySelectorAll("button").forEach((b) => {
						(b as HTMLElement).removeClass("ft-rating-selected");
					});
					btn.addClass("ft-rating-selected");
				});
			}
		} else {
			const textarea = group.createEl("textarea", { cls: "ft-closure-textarea" });
			textarea.placeholder = "Type your response...";
			textarea.addEventListener("input", () => {
				this.answers[q.id] = textarea.value;
			});
		}
	}

	private handleSubmit(form: HTMLElement): void {
		// Validate required fields
		const missing: string[] = [];
		for (const q of this.template.questions) {
			if (q.required && !this.answers[q.id]?.trim()) {
				missing.push(q.id);
			}
		}
		if (missing.length > 0) {
			// Highlight missing fields
			for (const id of missing) {
				const el = form.querySelector(`[data-question-id="${id}"]`);
				if (el) (el as HTMLElement).addClass("ft-closure-field-error");
			}
			return;
		}

		const response: ClosureResponse = {
			outcomeAchieved: (this.answers["outcome"] as ClosureResponse["outcomeAchieved"]) ?? "partial",
			whatWorked: this.answers["what-worked"] ?? "",
			whatDidnt: this.answers["what-didnt"] ?? "",
			nextAction: this.answers["next-action"] ?? "",
			answers: { ...this.answers },
		};

		this.callbacks.onSubmit(response);
	}
}
