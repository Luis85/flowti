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
		overlay.style.cssText = "padding:24px;max-width:600px;margin:0 auto;";

		// Header
		const header = overlay.createDiv({ cls: "ft-closure-header" });
		header.style.cssText = "text-align:center;margin-bottom:24px;";
		const iconEl = header.createDiv();
		iconEl.style.cssText = "margin-bottom:8px;";
		setIcon(iconEl, "clipboard-check");
		(iconEl.firstChild as HTMLElement)?.style.setProperty("width", "32px");
		(iconEl.firstChild as HTMLElement)?.style.setProperty("height", "32px");
		header.createEl("h3", { text: "Closure ritual" }).style.cssText = "margin:0 0 4px 0;";
		header.createEl("p", {
			text: `Reflect on "${this.session.title}" before completing.`,
			cls: "ft-text-muted",
		}).style.cssText = "color:var(--text-muted);margin:0;";

		// Questions
		const form = overlay.createDiv({ cls: "ft-closure-form" });
		form.style.cssText = "display:flex;flex-direction:column;gap:16px;";

		for (const q of this.template.questions) {
			this.renderQuestion(form, q);
		}

		// Actions
		const actions = overlay.createDiv({ cls: "ft-closure-actions" });
		actions.style.cssText = "display:flex;justify-content:center;gap:12px;margin-top:24px;";

		const submitBtn = actions.createEl("button", { text: "Complete session", cls: "mod-cta" });
		submitBtn.style.cssText = "padding:8px 24px;border-radius:6px;cursor:pointer;font-weight:600;";
		submitBtn.addEventListener("click", () => this.handleSubmit(form));

		const skipBtn = actions.createEl("button", { text: "Skip", cls: "ft-closure-skip" });
		skipBtn.style.cssText = "padding:8px 24px;border-radius:6px;cursor:pointer;color:var(--text-muted);background:none;border:1px solid var(--background-modifier-border);";
		skipBtn.addEventListener("click", () => this.callbacks.onSkip());
	}

	private renderQuestion(form: HTMLElement, q: ClosureQuestion): void {
		const group = form.createDiv({ cls: "ft-closure-question" });
		group.dataset.questionId = q.id;

		const label = group.createEl("label", {
			text: q.question + (q.required ? " *" : ""),
		});
		label.style.cssText = "display:block;font-weight:600;margin-bottom:4px;";

		if (q.type === "select" && q.options) {
			const selectEl = group.createEl("select");
			selectEl.style.cssText = "width:100%;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);";
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
			const ratingRow = group.createDiv();
			ratingRow.style.cssText = "display:flex;gap:4px;";
			for (let i = 1; i <= 5; i++) {
				const btn = ratingRow.createEl("button", { text: String(i) });
				btn.style.cssText = "width:32px;height:32px;border-radius:4px;cursor:pointer;border:1px solid var(--background-modifier-border);background:var(--background-primary);color:var(--text-normal);";
				btn.addEventListener("click", () => {
					this.answers[q.id] = String(i);
					ratingRow.querySelectorAll("button").forEach((b) => {
						(b as HTMLElement).style.background = "var(--background-primary)";
						(b as HTMLElement).style.fontWeight = "normal";
					});
					btn.style.background = "var(--interactive-accent)";
					btn.style.fontWeight = "bold";
				});
			}
		} else {
			const textarea = group.createEl("textarea");
			textarea.style.cssText = "width:100%;min-height:60px;padding:6px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);resize:vertical;box-sizing:border-box;";
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
				if (el) (el as HTMLElement).style.borderLeft = "3px solid var(--text-error)";
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
