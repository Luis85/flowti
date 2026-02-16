/**
 * Sessions tab component for the User Hub.
 *
 * Renders a master list of documentation sessions and a detail panel
 * with timer display, artifacts, and contextual lifecycle actions.
 * Follows the same pattern as UserHubInbox.
 */

import { setIcon } from "obsidian";
import { formatDuration, computeRemainingMs, computeElapsedMs } from "../../domain/session/helpers";
import type { Session, SessionArtifact } from "../../domain/session/types";
import {
	SESSION_STATUS_LABELS,
	SESSION_TYPE_LABELS,
	type UserHubComponentDeps,
} from "./types";

/** Maps session status to a Lucide icon name. */
const STATUS_ICONS: Record<string, string> = {
	prepared: "circle",
	active: "play",
	paused: "pause",
	completed: "check-circle",
	archived: "archive",
};

export class UserHubSessions {
	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {}

	renderMaster(filterText: string): void {
		this.masterEl.empty();

		const state = this.deps.getState();
		const sessions = state.sessions.filter((s) =>
			!filterText || s.title.toLowerCase().includes(filterText),
		);

		if (sessions.length === 0) {
			this.renderEmptyState();
			return;
		}

		// Header with count
		const header = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.padding = "0.25rem 0.5rem";
		header.style.borderBottom = "1px solid var(--background-modifier-border)";

		const count = header.createSpan({ cls: "ft-text-sm ft-text-muted" });
		const activeCount = sessions.filter((s) => s.status === "active").length;
		count.setText(
			`${sessions.length} session${sessions.length === 1 ? "" : "s"}${activeCount > 0 ? ` (${activeCount} active)` : ""}`,
		);

		const spacer = header.createDiv();
		spacer.style.flex = "1";

		const addBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(addBtn, "plus");
		addBtn.appendText(" New");
		addBtn.addEventListener("click", () => this.deps.openNewSessionModal());

		// Sort: active first, then paused, prepared, completed, archived
		const order: Record<string, number> = { active: 0, paused: 1, prepared: 2, completed: 3, archived: 4 };
		const sorted = [...sessions].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));

		for (const session of sorted) {
			const row = this.masterEl.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });

			if (state.selectedSession?.id === session.id) {
				row.addClass("ft-catalog-row-active");
				row.style.backgroundColor = "var(--background-modifier-hover)";
			}

			if (session.status === "active") {
				row.style.borderLeft = "3px solid var(--interactive-accent)";
			}

			// Status icon
			const icon = row.createSpan();
			setIcon(icon, STATUS_ICONS[session.status] ?? "circle");
			icon.style.opacity = "0.6";
			icon.style.marginRight = "0.5rem";

			// Title
			row.createSpan({ text: session.title });

			// Type badge
			row.createSpan({
				text: SESSION_TYPE_LABELS[session.type] ?? session.type,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			}).style.marginLeft = "0.5rem";

			// Duration / status badge
			const statusText = row.createSpan({
				text: SESSION_STATUS_LABELS[session.status] ?? session.status,
				cls: "ft-text-muted ft-text-sm",
			});
			statusText.style.marginLeft = "auto";

			row.addEventListener("click", () => {
				this.deps.setState({ selectedSession: session });
				this.deps.scheduleRender();
			});
		}
	}

	renderDetail(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const session = state.selectedSession;

		if (!session) {
			const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			empty.style.justifyContent = "center";
			empty.style.padding = "3rem";
			empty.style.color = "var(--text-muted)";
			const icon = empty.createSpan();
			setIcon(icon, "timer");
			empty.createSpan({ text: "Select a session to view details" });
			return;
		}

		this.renderSessionDetail(session);
	}

	/**
	 * Directly updates the timer display without a full re-render.
	 * Called by UserHubView on every session.timer.tick event.
	 */
	updateTimerDisplay(remainingMs: number): void {
		const el = this.detailEl.querySelector(".ft-session-timer");
		if (el) {
			el.textContent = formatDuration(remainingMs);
		}
	}

	// ── Private ─────────────────────────────────────────────

	private renderEmptyState(): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center" });
		empty.style.justifyContent = "center";
		empty.style.padding = "3rem";
		empty.style.color = "var(--text-muted)";

		const icon = empty.createDiv();
		setIcon(icon, "timer");
		icon.style.opacity = "0.4";
		icon.style.marginBottom = "0.75rem";
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: "No sessions yet", cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Time-boxed documentation sessions will appear here.",
			cls: "ft-text-muted ft-text-sm",
		}).style.marginTop = "0.25rem";

		const btn = empty.createEl("button", { cls: "ft-btn" });
		btn.style.marginTop = "1rem";
		setIcon(btn, "plus");
		btn.appendText(" New Session");
		btn.addEventListener("click", () => this.deps.openNewSessionModal());
	}

	private renderSessionDetail(session: Session): void {
		// Header
		const header = this.detailEl.createDiv({ cls: "ft-detail-section" });
		header.createEl("h3", { text: session.title, cls: "ft-heading" });

		const meta = header.createDiv({ cls: "ft-flex ft-gap-2 ft-text-sm ft-text-muted" });
		meta.createSpan({
			text: SESSION_STATUS_LABELS[session.status] ?? session.status,
			cls: "ft-badge ft-badge-muted",
		});
		meta.createSpan({
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge ft-badge-muted",
		});

		// Timer section (active or paused)
		if (session.status === "active" || session.status === "paused") {
			const timerSection = this.detailEl.createDiv({ cls: "ft-detail-section" });
			timerSection.style.textAlign = "center";
			timerSection.style.padding = "1rem";

			const timerLabel = timerSection.createDiv({ cls: "ft-text-sm ft-text-muted" });
			timerLabel.setText(session.status === "active" ? "Time Remaining" : "Paused");

			const remaining = computeRemainingMs(session);
			const timerDisplay = timerSection.createDiv({ cls: "ft-session-timer" });
			timerDisplay.style.fontSize = "2rem";
			timerDisplay.style.fontFamily = "var(--font-monospace)";
			timerDisplay.style.fontWeight = "600";
			timerDisplay.setText(formatDuration(remaining));
		}

		// Info section
		const info = this.detailEl.createDiv({ cls: "ft-detail-section" });
		info.createEl("h4", { text: "Info", cls: "ft-heading ft-heading-sm" });

		const infoGrid = info.createDiv();
		this.renderInfoRow(infoGrid, "Created", new Date(session.createdAt).toLocaleString());
		this.renderInfoRow(infoGrid, "Duration", `${session.durationMinutes} min`);
		this.renderInfoRow(infoGrid, "Elapsed", formatDuration(computeElapsedMs(session)));

		if (session.completedAt) {
			this.renderInfoRow(infoGrid, "Completed", new Date(session.completedAt).toLocaleString());
		}

		// Artifacts section
		if (session.artifacts.length > 0) {
			this.renderArtifacts(session.artifacts);
		}

		// Actions section
		this.renderActions(session);
	}

	private renderInfoRow(container: HTMLElement, label: string, value: string): void {
		const row = container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-sm" });
		row.style.padding = "0.15rem 0";
		row.createSpan({ text: label, cls: "ft-text-muted" }).style.minWidth = "5rem";
		row.createSpan({ text: value });
	}

	private renderArtifacts(artifacts: SessionArtifact[]): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.createEl("h4", { text: `Artifacts (${artifacts.length})`, cls: "ft-heading ft-heading-sm" });

		for (const artifact of artifacts.slice(0, 20)) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm" });
			row.style.padding = "0.15rem 0";

			const icon = row.createSpan();
			setIcon(icon, artifact.action === "created" ? "file-plus" : "file-edit");
			icon.style.opacity = "0.5";

			// Show just the filename
			const parts = artifact.path.split("/");
			row.createSpan({ text: parts[parts.length - 1] });

			row.createSpan({
				text: artifact.action,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			}).style.marginLeft = "0.25rem";
		}

		if (artifacts.length > 20) {
			section.createDiv({
				text: `+ ${artifacts.length - 20} more`,
				cls: "ft-text-sm ft-text-muted",
			}).style.padding = "0.25rem 0";
		}
	}

	private renderActions(session: Session): void {
		const actions = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-gap-2" });
		const eb = this.deps.eventBus;

		switch (session.status) {
			case "prepared":
				this.addActionButton(actions, "play", "Start", () => {
					void eb.emit("session.start", { sessionId: session.id });
				});
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;

			case "active":
				this.addActionButton(actions, "pause", "Pause", () => {
					void eb.emit("session.pause", { sessionId: session.id });
				});
				this.addActionButton(actions, "check-circle", "Complete", () => {
					void eb.emit("session.complete", { sessionId: session.id });
				});
				break;

			case "paused":
				this.addActionButton(actions, "play", "Resume", () => {
					void eb.emit("session.resume", { sessionId: session.id });
				});
				this.addActionButton(actions, "check-circle", "Complete", () => {
					void eb.emit("session.complete", { sessionId: session.id });
				});
				break;

			case "completed":
				this.addActionButton(actions, "archive", "Archive", () => {
					void eb.emit("session.archive", { sessionId: session.id });
				});
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;

			case "archived":
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;
		}
	}

	private addActionButton(container: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = container.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(btn, icon);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", onClick);
	}
}
