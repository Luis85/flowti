/**
 * Timer display component for session detail view.
 *
 * Renders the countdown timer and time breakdown sections.
 * Provides `updateTimerDisplay()` for live tick updates without full re-render.
 */

import { formatDuration, computeRemainingMs, computeTimelineSummary, formatDurationHuman } from "../../domain/session/helpers";
import type { Session } from "../../domain/session/types";

export class SessionTimerDisplay {
	constructor(private containerEl: HTMLElement) {}

	/**
	 * Renders the timer countdown (active/paused only) and time breakdown
	 * (any session with timeline data). Appends elements to containerEl.
	 */
	render(session: Session): void {
		// Countdown timer — only for active/paused sessions
		if (session.status === "active" || session.status === "running" || session.status === "paused") {
			const timerSection = this.containerEl.createDiv({ cls: "ft-detail-section" });
			timerSection.style.padding = "1rem";

			const timerLabel = timerSection.createDiv({ cls: "ft-text-sm ft-text-muted" });
			timerLabel.setText(session.status === "paused" ? "Paused" : "Time Remaining");

			const remaining = computeRemainingMs(session);
			const timerDisplay = timerSection.createDiv({ cls: "ft-session-timer" });
			timerDisplay.style.fontSize = "2rem";
			timerDisplay.style.fontFamily = "var(--font-monospace)";
			timerDisplay.style.fontWeight = "600";
			timerDisplay.setText(formatDuration(remaining));
		}

		// Time breakdown — for any session with timeline data
		if (session.timeline && session.timeline.length > 0) {
			this.renderTimeBreakdown(session);
		}
	}

	/**
	 * Directly updates the timer display without a full re-render.
	 * Called on every session.timer.tick event.
	 */
	updateTimerDisplay(remainingMs: number): void {
		const el = this.containerEl.querySelector(".ft-session-timer");
		if (el) {
			el.textContent = formatDuration(remainingMs);
		}
	}

	private renderTimeBreakdown(session: Session): void {
		const summary = computeTimelineSummary(session);
		const section = this.containerEl.createDiv({ cls: "ft-detail-section ft-time-breakdown" });
		section.createEl("h4", { text: "Time Breakdown", cls: "ft-heading ft-heading-sm" });

		const grid = section.createDiv({ cls: "ft-flex ft-gap-2" });
		grid.style.flexWrap = "wrap";

		this.renderStatPill(grid, "Wall Clock", formatDurationHuman(summary.wallClockMs));
		this.renderStatPill(grid, "Active", formatDurationHuman(summary.activeTimeMs));
		this.renderStatPill(grid, "Paused", formatDurationHuman(summary.totalPauseMs));
		if (summary.pauseCount > 0) {
			this.renderStatPill(grid, "Pauses", String(summary.pauseCount));
		}
	}

	private renderStatPill(container: HTMLElement, label: string, value: string): void {
		const pill = container.createDiv({ cls: "ft-badge ft-badge-muted" });
		pill.style.padding = "0.25rem 0.5rem";
		pill.style.display = "flex";
		pill.style.flexDirection = "column";
		pill.style.alignItems = "center";
		pill.createDiv({ text: value, cls: "ft-text-sm" }).style.fontWeight = "600";
		pill.createDiv({ text: label, cls: "ft-text-sm ft-text-muted" });
	}
}
