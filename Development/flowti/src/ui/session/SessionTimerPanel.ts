import type { SessionPanelDeps } from "./types";
import { formatDuration, computeRemainingMs } from "../../domain/session/helpers";

export class SessionTimerPanel {
	private timerEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const section = this.container.createDiv({ cls: "ft-session-workspace-timer ft-section" });
		section.style.cssText = "text-align:center;";

		this.timerEl = section.createDiv({ cls: "ft-timer-display" });
		this.timerEl.style.cssText = "font-size:36px;font-weight:700;font-family:var(--font-monospace);letter-spacing:2px;";
		this.timerEl.textContent = formatDuration(computeRemainingMs(session));

		if (session.status === "prepared") {
			const editRow = section.createDiv({ cls: "ft-duration-edit" });
			editRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:8px;margin-top:8px;";

			const input = editRow.createEl("input", { type: "number", cls: "ft-duration-input" });
			input.value = String(session.durationMinutes);
			input.min = "1";
			input.style.cssText = "width:60px;padding:4px 8px;text-align:center;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);font-family:var(--font-monospace);";

			editRow.createEl("span", { text: "minutes", cls: "ft-text-muted ft-text-sm" }).style.cssText = "color:var(--text-muted);font-size:12px;";

			input.addEventListener("change", () => {
				const value = parseInt(input.value, 10);
				if (value >= 1) {
					void this.deps.eventBus.emit("session.duration.update", {
						sessionId: session.id,
						durationMinutes: value,
					});
				}
			});
		} else {
			section.createDiv({ text: "Time Remaining", cls: "ft-text-muted ft-text-sm" }).style.cssText = "margin-top:4px;color:var(--text-muted);font-size:12px;";
		}
	}

	updateDisplay(remainingMs: number): void {
		if (this.timerEl) {
			this.timerEl.textContent = formatDuration(remainingMs);
		}
	}
}
