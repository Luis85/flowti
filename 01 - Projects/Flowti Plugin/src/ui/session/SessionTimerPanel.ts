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

		this.timerEl = section.createDiv({ cls: "ft-timer-display" });
		this.timerEl.textContent = formatDuration(computeRemainingMs(session));

		if (session.status === "prepared") {
			const editRow = section.createDiv({ cls: "ft-duration-edit" });

			const input = editRow.createEl("input", { type: "number", cls: "ft-duration-input" });
			input.value = String(session.durationMinutes);
			input.min = "1";

			editRow.createEl("span", { text: "Minutes", cls: "ft-text-muted ft-text-sm ft-panel-count" });

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
			section.createDiv({ text: "Time Remaining", cls: "ft-text-muted ft-text-sm ft-timer-remaining-label" });
		}
	}

	updateDisplay(remainingMs: number): void {
		if (this.timerEl) {
			this.timerEl.textContent = formatDuration(remainingMs);
		}
	}
}
