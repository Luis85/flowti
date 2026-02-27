import type { SessionPanelDeps } from "./types";
import { detectCognitiveOverload } from "../../domain/session/helpers";

/**
 * Non-blocking warning banner for cognitive overload detection (FR-16).
 *
 * Renders when session state exceeds configured thresholds
 * (task count, binding count, duration, low energy + high load).
 * Dismissible per render cycle — dismissed state is not persisted.
 */
export class CognitiveLoadAlert {
	private alertEl: HTMLElement | null = null;
	private dismissed = false;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		this.refreshAlert();
	}

	refreshAlert(): void {
		// Remove previous alert if present
		if (this.alertEl) {
			this.alertEl.remove();
			this.alertEl = null;
		}

		if (this.dismissed) return;

		const session = this.deps.getSession();
		if (session.status !== "running" && session.status !== "paused") return;

		const result = detectCognitiveOverload(session);
		if (!result.overloaded) return;

		this.alertEl = this.container.createDiv({ cls: "ft-overload-alert" });
		this.alertEl.style.cssText =
			"background:var(--background-modifier-error);border:1px solid var(--background-modifier-error-hover);" +
			"border-radius:6px;padding:8px 12px;margin:6px 0;";

		// Header row with icon + title + dismiss button
		const header = this.alertEl.createDiv();
		header.style.cssText = "display:flex;align-items:center;justify-content:space-between;";

		const title = header.createEl("strong");
		title.style.cssText = "font-size:13px;";
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		title.textContent = "\u26A0\uFE0F Cognitive overload";

		const dismissBtn = header.createEl("button", { cls: "ft-overload-dismiss" });
		dismissBtn.textContent = "\u00D7";
		dismissBtn.style.cssText =
			"background:none;border:none;cursor:pointer;font-size:16px;color:var(--text-muted);padding:0 4px;";
		dismissBtn.title = "Dismiss warning";
		dismissBtn.addEventListener("click", () => {
			this.dismissed = true;
			if (this.alertEl) {
				this.alertEl.remove();
				this.alertEl = null;
			}
		});

		// Reason list
		const list = this.alertEl.createEl("ul");
		list.style.cssText = "margin:4px 0 0 0;padding-left:18px;font-size:12px;";
		for (const reason of result.reasons) {
			list.createEl("li", { text: reason });
		}

		// Suggestion
		const suggestion = this.alertEl.createEl("div");
		suggestion.style.cssText = "font-size:11px;color:var(--text-muted);margin-top:4px;";
		suggestion.textContent = "Consider reducing scope, taking a break, or completing existing tasks.";
	}

	/** Resets dismissed state (e.g., when session state changes significantly). */
	resetDismissed(): void {
		this.dismissed = false;
	}
}
