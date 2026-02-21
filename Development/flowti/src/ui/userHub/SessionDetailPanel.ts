/**
 * Detail panel component for the Sessions tab in the User Hub.
 *
 * Renders the selected session's header, actions, info, artifacts,
 * links, and timeline. Delegates timer display to SessionTimerDisplay.
 */

import { setIcon } from "obsidian";
import { computeElapsedMs, formatDuration } from "../../domain/session/helpers";
import type { Session, SessionArtifact, SessionTemplate, SessionTimelineEntry } from "../../domain/session/types";
import type { TrainState } from "../../domain/train/types";
import { SessionTimerDisplay } from "./SessionTimerDisplay";
import {
	SESSION_STATUS_LABELS,
	SESSION_TYPE_LABELS,
	type UserHubComponentDeps,
} from "./types";

export class SessionDetailPanel {
	private timerDisplay: SessionTimerDisplay;

	constructor(
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {
		this.timerDisplay = new SessionTimerDisplay(detailEl);
	}

	/**
	 * Renders the detail panel for the selected session, or the empty/template state.
	 */
	render(): void {
		this.detailEl.empty();

		const state = this.deps.getState();
		const session = state.selectedSession;

		if (!session) {
			const templates = this.deps.sessionService.getSavedTemplates();
			if (templates.length > 0) {
				this.renderTemplateList(templates);
			} else {
				this.renderEmpty();
			}
			return;
		}

		this.renderSessionDetail(session);
	}

	/**
	 * Directly updates the timer display without a full re-render.
	 */
	updateTimerDisplay(remainingMs: number): void {
		this.timerDisplay.updateTimerDisplay(remainingMs);
	}

	// ── Private ─────────────────────────────────────────────

	private renderEmpty(): void {
		const empty = this.detailEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center ft-gap-2" });
		empty.style.justifyContent = "center";
		empty.style.padding = "3rem";
		empty.style.color = "var(--text-muted)";
		const row = empty.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = row.createSpan();
		setIcon(icon, "timer");
		row.createSpan({ text: "Select a session to view details" });
		const importBtn = empty.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(importBtn, "download");
		importBtn.appendText(" Import Template");
		importBtn.addEventListener("click", () => {
			this.deps.importTemplateFromFile();
		});
	}

	/** Returns the TrainState for a session, if available. */
	private getTrainForSession(session: Session): TrainState | undefined {
		if (!this.deps.trainService) return undefined;
		return this.deps.trainService.getAllTrains().find((t) => t.sessionId === session.id);
	}

	private renderSessionDetail(session: Session): void {
		const train = session.type === "train-of-thought" ? this.getTrainForSession(session) : undefined;

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

		// Train info section
		if (train) {
			this.renderTrainSection(train);
		}

		// Actions — directly under header for easy access
		this.renderActions(session, train);

		// Timer section (active or paused)
		this.timerDisplay.render(session);

		// Info section
		const info = this.detailEl.createDiv({ cls: "ft-detail-section" });
		info.createEl("h4", { text: "Info", cls: "ft-heading ft-heading-sm" });

		const infoGrid = info.createDiv();
		this.renderInfoRow(infoGrid, "Created", new Date(session.createdAt).toLocaleString());
		this.renderInfoRow(infoGrid, "Duration", `${session.durationMinutes} min`);
		this.renderInfoRow(infoGrid, "Elapsed", formatDuration(computeElapsedMs(session)));

		if (session.focusFile && session.focusFile !== session.notesFile) {
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

		// Links section
		if (session.links && session.links.length > 0) {
			this.renderLinks(session);
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

			// Clickable filename
			const parts = artifact.path.split("/");
			const link = row.createEl("a", { text: parts[parts.length - 1], cls: "ft-artifact-link" });
			link.title = artifact.path;
			link.style.cssText = "cursor:pointer;text-decoration:underline;color:var(--text-accent);";
			link.addEventListener("click", (e) => {
				e.preventDefault();
				this.deps.openFile(artifact.path);
			});

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

	private renderLinks(session: Session): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section" });
		section.createEl("h4", { text: `Links (${session.links.length})`, cls: "ft-heading ft-heading-sm" });

		for (const link of session.links) {
			const row = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm" });
			row.style.padding = "0.15rem 0";

			const icon = row.createSpan();
			setIcon(icon, "file-text");
			icon.style.opacity = "0.5";

			const parts = link.path.split("/");
			const linkEl = row.createEl("a", { text: parts[parts.length - 1], cls: "ft-link" });
			linkEl.title = link.path;
			linkEl.addEventListener("click", (e) => {
				e.preventDefault();
				this.deps.openFile(link.path);
			});
		}
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

	private renderTrainSection(train: TrainState): void {
		const section = this.detailEl.createDiv({ cls: "ft-detail-section ft-train-section" });
		section.createEl("h4", { text: "Train of Thought", cls: "ft-heading ft-heading-sm" });

		const grid = section.createDiv({ cls: "ft-flex ft-gap-3 ft-text-sm" });

		const thoughtCount = grid.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		const thoughtIcon = thoughtCount.createSpan();
		setIcon(thoughtIcon, "brain");
		thoughtIcon.style.opacity = "0.5";
		thoughtCount.createSpan({ text: `${train.thoughts.length} thought${train.thoughts.length === 1 ? "" : "s"}` });

		const branchCount = train.relations.filter((r) => r.direction === "branch").length;
		if (branchCount > 0) {
			const branchEl = grid.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
			const branchIcon = branchEl.createSpan();
			setIcon(branchIcon, "git-branch");
			branchIcon.style.opacity = "0.5";
			branchEl.createSpan({ text: `${branchCount} branch${branchCount === 1 ? "" : "es"}` });
		}

		const statusEl = grid.createDiv({ cls: "ft-flex ft-items-center ft-gap-1" });
		statusEl.createSpan({
			text: train.status,
			cls: "ft-badge ft-badge-muted",
		});

		// Clickable thought list (max 5)
		if (train.thoughts.length > 0) {
			const list = section.createDiv({ cls: "ft-train-thought-list" });
			list.style.marginTop = "0.5rem";
			const visible = train.thoughts.slice(0, 5);
			for (const thought of visible) {
				const row = list.createDiv({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm ft-cursor-pointer" });
				row.style.padding = "0.15rem 0";
				const icon = row.createSpan();
				setIcon(icon, "file-text");
				icon.style.opacity = "0.5";
				const link = row.createEl("a", {
					text: thought.title,
					cls: "ft-link",
				});
				link.title = thought.path;
				link.addEventListener("click", (e) => {
					e.preventDefault();
					this.deps.openFile(thought.path);
				});
			}
			if (train.thoughts.length > 5) {
				list.createDiv({
					text: `+ ${train.thoughts.length - 5} more`,
					cls: "ft-text-sm ft-text-muted",
				}).style.padding = "0.15rem 0";
			}
		}
	}

	private renderActions(session: Session, train?: TrainState): void {
		const actions = this.detailEl.createDiv({ cls: "ft-detail-section ft-flex ft-gap-2" });
		const eb = this.deps.eventBus;
		const state = this.deps.getState();
		const isTrain = !!train;
		const wsLabel = isTrain ? "Open Train" : "Workspace";
		const wsIcon = isTrain ? "train-front" : "layout";
		const sideLabel = isTrain ? "Timeline" : "Sidebar";
		const sideIcon = isTrain ? "git-branch" : "panel-right";

		switch (session.status) {
			case "prepared":
				this.addActionButton(actions, wsIcon, wsLabel, () => {
					this.deps.openSessionWorkspace(session.id);
				});
				this.addActionButton(actions, sideIcon, sideLabel, () => {
					this.deps.openSessionWorkspace(session.id, "sidebar");
				});
				// Only show Start when no other session is active
				if (!state.activeSession) {
					this.addActionButton(actions, "play", "Start", () => {
						void eb.emit("session.start", { sessionId: session.id });
						this.deps.openSessionWorkspace(session.id);
					});
				}
				this.addActionButton(actions, "bookmark", "Save as Template", () => {
					this.deps.openSaveTemplateModal(session);
				});
				this.addActionButton(actions, "trash-2", "Delete", () => {
					void eb.emit("session.delete", { sessionId: session.id });
				});
				break;

			case "active":
			case "running":
				this.addActionButton(actions, wsIcon, wsLabel, () => {
					this.deps.openSessionWorkspace(session.id);
				});
				this.addActionButton(actions, sideIcon, sideLabel, () => {
					this.deps.openSessionWorkspace(session.id, "sidebar");
				});
				this.addActionButton(actions, "pause", "Pause", () => {
					void eb.emit("session.pause", { sessionId: session.id });
				});
				this.addActionButton(actions, "check-circle", "Complete", () => {
					void eb.emit("session.complete", { sessionId: session.id });
				});
				this.addActionButton(actions, "bookmark", "Save as Template", () => {
					this.deps.openSaveTemplateModal(session);
				});
				break;

			case "paused":
				this.addActionButton(actions, wsIcon, wsLabel, () => {
					this.deps.openSessionWorkspace(session.id);
				});
				this.addActionButton(actions, sideIcon, sideLabel, () => {
					this.deps.openSessionWorkspace(session.id, "sidebar");
				});
				this.addActionButton(actions, "play", "Resume", () => {
					void eb.emit("session.resume", { sessionId: session.id });
				});
				this.addActionButton(actions, "check-circle", "Complete", () => {
					void eb.emit("session.complete", { sessionId: session.id });
				});
				this.addActionButton(actions, "bookmark", "Save as Template", () => {
					this.deps.openSaveTemplateModal(session);
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

		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.createEl("h4", { text: "Saved Templates", cls: "ft-heading ft-heading-sm" });
		header.style.marginBottom = "0";
		const headerSpacer = header.createDiv();
		headerSpacer.style.flex = "1";
		const importBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(importBtn, "download");
		importBtn.appendText(" Import");
		importBtn.addEventListener("click", () => {
			this.deps.importTemplateFromFile();
		});

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

			const exportBtn = row.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(exportBtn, "upload");
			exportBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.deps.exportTemplateAsFile(tmpl.id);
			});

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
