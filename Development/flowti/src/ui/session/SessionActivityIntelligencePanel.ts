import type { SessionPanelDeps } from "./types";
import { computeActivityIntelligence, formatDurationHuman } from "../../domain/session/helpers";

/**
 * Compact activity intelligence stats row for the session workspace (FR-15).
 *
 * Renders a single-line summary: files | tasks | events | active time.
 * Visible for running, paused, completed, and archived sessions.
 */
export class SessionActivityIntelligencePanel {
	private statsEl: HTMLElement | null = null;
	private deps: SessionPanelDeps;

	constructor(private container: HTMLElement, deps: SessionPanelDeps) {
		this.deps = deps;
	}

	render(): void {
		const session = this.deps.getSession();
		const intel = computeActivityIntelligence(session);

		// Skip rendering if no activity at all
		if (intel.filesModified === 0 && intel.artifactsProduced === 0 && intel.tasksCompleted === 0 && intel.eventsEmitted === 0 && intel.activeTimeMs === 0) {
			return;
		}

		const section = this.container.createDiv({ cls: "ft-session-intelligence ft-section" });

		section.createEl("strong", { text: "Activity", cls: "ft-intelligence-label" });

		this.statsEl = section.createDiv({ cls: "ft-intelligence-stats" });
		this.renderStats(intel);
	}

	refreshStats(): void {
		if (!this.statsEl) return;
		const session = this.deps.getSession();
		const intel = computeActivityIntelligence(session);
		this.renderStats(intel);
	}

	private renderStats(intel: ReturnType<typeof computeActivityIntelligence>): void {
		if (!this.statsEl) return;
		this.statsEl.empty();

		const items: Array<{ label: string; value: string }> = [
			{ label: "Files", value: String(intel.filesModified) },
			{ label: "Artifacts", value: String(intel.artifactsProduced) },
			{ label: "Tasks", value: String(intel.tasksCompleted) },
			{ label: "Events", value: String(intel.eventsEmitted) },
			{ label: "Active", value: formatDurationHuman(intel.activeTimeMs) },
		];

		if (intel.pauseTimeMs > 0) {
			items.push({ label: "Paused", value: formatDurationHuman(intel.pauseTimeMs) });
		}

		for (const item of items) {
			const stat = this.statsEl.createEl("span", { cls: "ft-intelligence-stat" });
			stat.createEl("span", { text: item.label, cls: "ft-stat-label" });
			stat.createEl("span", { text: item.value, cls: "ft-stat-value" });
		}
	}
}
