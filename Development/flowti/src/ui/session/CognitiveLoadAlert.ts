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

		// Header row with icon + title + dismiss button
		const header = this.alertEl.createDiv({ cls: "ft-overload-header" });

		const title = header.createEl("strong", { cls: "ft-overload-title" });
		// eslint-disable-next-line obsidianmd/ui/sentence-case
		title.textContent = "\u26A0\uFE0F Cognitive overload";

		const dismissBtn = header.createEl("button", { cls: "ft-overload-dismiss" });
		dismissBtn.textContent = "\u00D7";
		dismissBtn.title = "Dismiss warning";
		dismissBtn.addEventListener("click", () => {
			this.dismissed = true;
			if (this.alertEl) {
				this.alertEl.remove();
				this.alertEl = null;
			}
		});

		// Reason list
		const list = this.alertEl.createEl("ul", { cls: "ft-overload-reasons" });
		for (const reason of result.reasons) {
			list.createEl("li", { text: reason });
		}

		// Suggestion
		const suggestion = this.alertEl.createEl("div", { cls: "ft-overload-suggestion" });
		suggestion.textContent = "Consider reducing scope, taking a break, or completing existing tasks.";
	}

	/** Resets dismissed state (e.g., when session state changes significantly). */
	resetDismissed(): void {
		this.dismissed = false;
	}
}
