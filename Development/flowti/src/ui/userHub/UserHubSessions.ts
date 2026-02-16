/**
 * Sessions tab component for the User Hub.
 *
 * Renders a master list of documentation sessions and a detail panel
 * with timer display, artifacts, and contextual lifecycle actions.
 * Follows the same pattern as UserHubInbox.
 */

import { setIcon } from "obsidian";
import { formatDuration, computeRemainingMs, computeElapsedMs, computeTimelineSummary, formatDurationHuman } from "../../domain/session/helpers";
import type { Session, SessionArtifact, SessionTemplate, SessionTimelineEntry } from "../../domain/session/types";
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
			row.style.marginBottom = "2px";

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
			const templates = this.deps.sessionService.getSavedTemplates();
			if (templates.length > 0) {
				this.renderTemplateList(templates);
			} else {
				const empty = this.detailEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
				empty.style.justifyContent = "center";
				empty.style.padding = "3rem";
				empty.style.color = "var(--text-muted)";
				const icon = empty.createSpan();
				setIcon(icon, "timer");
				empty.createSpan({ text: "Select a session to view details" });
			}
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

		// Actions — directly under header for easy access
		this.renderActions(session);

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

		// Time Breakdown section (for sessions with timeline data)
		if (session.timeline && session.timeline.length > 0) {
			this.renderTimeBreakdown(session);
		}

		// Info section
		const info = this.detailEl.createDiv({ cls: "ft-detail-section" });
		info.createEl("h4", { text: "Info", cls: "ft-heading ft-heading-sm" });

		const infoGrid = info.createDiv();
		this.renderInfoRow(infoGrid, "Created", new Date(session.createdAt).toLocaleString());
		this.renderInfoRow(infoGrid, "Duration", `${session.durationMinutes} min`);
		this.renderInfoRow(infoGrid, "Elapsed", formatDuration(computeElapsedMs(session)));

		if (session.focusFile) {
			const focusRow = infoGrid.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-sm" });
			focusRow.style.padding = "0.15rem 0";
			focusRow.createSpan({ text: "Focus", cls: "ft-text-muted" }).style.minWidth = "5rem";
			const focusIcon = focusRow.createSpan();
			setIcon(focusIcon, "file");
			focusIcon.style.opacity = "0.5";
			const link = focusRow.createEl("a", {
				text: session.focusFile.split("/").pop() ?? session.focusFile,
				cls: "ft-link",
			});
			link.title = session.focusFile;
			link.addEventListener("click", (e) => {
				e.preventDefault();
				this.deps.openFile(session.focusFile!);
			});
		}

		if (session.completedAt) {
			this.renderInfoRow(infoGrid, "Completed", new Date(session.completedAt).toLocaleString());
		}

		// Artifacts section
		if (session.artifacts.length > 0) {
			this.renderArtifacts(session.artifacts);
		}

		// Timeline section (last — full audit trail)
		if (session.timeline && session.timeline.length > 0) {
			this.renderTimeline(session.timeline);
		}
	}

	private renderTimeBreakdown(session: Session): void {
		const summary = computeTimelineSummary(session);
		const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-time-breakdown" });
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

	private renderTimeline(timeline: SessionTimelineEntry[]): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-session-timeline" });
		section.createEl("h4", {
			text: `Timeline (${timeline.length})`,
			cls: "ft-heading ft-heading-sm",
		});

		const TIMELINE_ICONS: Record<string, string> = {
			started: "play",
			paused: "pause",
			resumed: "play",
			completed: "check-circle",
		};

		const TIMELINE_LABELS: Record<string, string> = {
			started: "Started",
			paused: "Paused",
			resumed: "Resumed",
			completed: "Completed",
		};

		for (const entry of timeline) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-text-sm" });
			row.style.padding = "0.2rem 0";

			const dot = row.createDiv();
			dot.style.width = "8px";
			dot.style.height = "8px";
			dot.style.borderRadius = "50%";
			dot.style.backgroundColor = entry.action === "completed"
				? "var(--interactive-accent)"
				: "var(--text-muted)";
			dot.style.flexShrink = "0";

			const icon = row.createSpan();
			setIcon(icon, TIMELINE_ICONS[entry.action] ?? "circle");
			icon.style.opacity = "0.6";

			row.createSpan({ text: TIMELINE_LABELS[entry.action] ?? entry.action });

			const time = row.createSpan({
				text: new Date(entry.timestamp).toLocaleTimeString(undefined, {
					hour: "2-digit",
					minute: "2-digit",
					second: "2-digit",
				}),
				cls: "ft-text-muted",
			});
			time.style.marginLeft = "auto";
		}
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
		const state = this.deps.getState();

		switch (session.status) {
			case "prepared":
				// Only show Start when no other session is active
				if (!state.activeSession) {
					this.addActionButton(actions, "play", "Start", () => {
						void eb.emit("session.start", { sessionId: session.id });
					});
				}
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
				this.addActionButton(actions, "repeat", "Rerun", () => {
					void this.deps.sessionService.rerunSession(session.id).then((newSession) => {
						if (newSession) {
							this.deps.setState({ selectedSession: newSession });
							this.deps.scheduleRender();
						}
					});
				});
				this.addActionButton(actions, "bookmark", "Save as Template", () => {
					this.deps.openSaveTemplateModal(session);
				});
				this.addActionButton(actions, "archive", "Archive", () => {
					void eb.emit("session.archive", { sessionId: session.id });
				});
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;

			case "archived":
				this.addActionButton(actions, "repeat", "Rerun", () => {
					void this.deps.sessionService.rerunSession(session.id).then((newSession) => {
						if (newSession) {
							this.deps.setState({ selectedSession: newSession });
							this.deps.scheduleRender();
						}
					});
				});
				this.addActionButton(actions, "bookmark", "Save as Template", () => {
					this.deps.openSaveTemplateModal(session);
				});
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;
		}
	}

	private renderTemplateList(templates: SessionTemplate[]): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.style.padding = "1rem";
		section.createEl("h4", { text: "Saved Templates", cls: "ft-heading ft-heading-sm" });
		section.createDiv({
			text: "Click a template to start a new session",
			cls: "ft-text-sm ft-text-muted",
		}).style.marginBottom = "0.5rem";

		for (const tmpl of templates) {
			const row = section.createDiv({ cls: "ft-catalog-row ft-cursor-pointer ft-flex ft-items-center ft-gap-2 ft-text-sm" });
			row.style.padding = "0.35rem 0.5rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			const icon = row.createSpan();
			setIcon(icon, "bookmark");
			icon.style.opacity = "0.5";

			row.createSpan({ text: tmpl.name });

			row.createSpan({
				text: SESSION_TYPE_LABELS[tmpl.type] ?? tmpl.type,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});

			row.createSpan({
				text: `${tmpl.durationMinutes} min`,
				cls: "ft-text-muted",
			});

			const spacer = row.createDiv();
			spacer.style.flex = "1";

			const deleteBtn = row.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(deleteBtn, "trash-2");
			deleteBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				void this.deps.sessionService.deleteTemplate(tmpl.id).then(() => {
					this.deps.scheduleRender();
				});
			});

			row.addEventListener("click", () => {
				void this.deps.sessionService.createFromTemplate(tmpl.id).then(() => {
					this.deps.scheduleRender();
				});
			});
		}
	}

	private addActionButton(container: HTMLElement, icon: string, label: string, onClick: () => void): void {
		const btn = container.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(btn, icon);
		btn.appendText(` ${label}`);
		btn.addEventListener("click", onClick);
	}
}
