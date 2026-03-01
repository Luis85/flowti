/**
 * CanvasSessionSidebar — Obsidian right-sidebar view that monitors
 * an active canvas session.
 *
 * Displays: session goal, template name, node stats,
 * timer (from SessionService), and an activity feed.
 */
import { ItemView, setIcon } from "obsidian";
import type { WorkspaceLeaf } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types";
import type { CanvasSessionMonitor } from "../../domain/canvas/session/CanvasSessionMonitor";

export const VIEW_TYPE_CANVAS_SESSION = "flowti-canvas-session";

export interface CanvasSessionSidebarDeps {
	eventBus: IEventBus;
	monitor: CanvasSessionMonitor;
}

export class CanvasSessionSidebar extends ItemView {
	private readonly eventBus: IEventBus;
	private readonly monitor: CanvasSessionMonitor;
	private readonly unsubscribes: (() => void)[] = [];
	private renderTimer: ReturnType<typeof setTimeout> | null = null;
	private elapsedMs = 0;
	private remainingMs = 0;
	private isPaused = false;

	constructor(leaf: WorkspaceLeaf, deps: CanvasSessionSidebarDeps) {
		super(leaf);
		this.eventBus = deps.eventBus;
		this.monitor = deps.monitor;
	}

	getViewType(): string {
		return VIEW_TYPE_CANVAS_SESSION;
	}

	getDisplayText(): string {
		return "Canvas session";
	}

	getIcon(): string {
		return "layout-template";
	}

	async onOpen(): Promise<void> {
		this.unsubscribes.push(
			this.eventBus.on("session.timer.tick", (e) => {
				const payload = e.payload as { sessionId: string; remainingMs: number; elapsedMs: number };
				if (payload.sessionId === this.monitor.getSessionId()) {
					this.elapsedMs = payload.elapsedMs;
					this.remainingMs = payload.remainingMs;
					this.scheduleRender();
				}
			}),
			this.eventBus.on("session.paused", () => {
				this.isPaused = true;
				this.scheduleRender();
			}),
			this.eventBus.on("session.resumed", () => {
				this.isPaused = false;
				this.scheduleRender();
			}),
			this.eventBus.on("canvas.session.activity", () => {
				this.scheduleRender();
			}),
			this.eventBus.on("canvas.session.completed", () => {
				this.scheduleRender();
			}),
		);
		this.render();
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes.length = 0;
		if (this.renderTimer) {
			clearTimeout(this.renderTimer);
			this.renderTimer = null;
		}
	}

	private scheduleRender(): void {
		if (this.renderTimer) return;
		this.renderTimer = setTimeout(() => {
			this.renderTimer = null;
			this.render();
		}, 100);
	}

	private render(): void {
		const el = this.contentEl;
		el.empty();
		el.addClass("ft-canvas-session-sidebar");

		const snapshot = this.monitor.getSnapshot();
		if (!snapshot) {
			el.createDiv({ cls: "ft-text-muted ft-p-md", text: "No active canvas session." });
			return;
		}

		// Goal section
		const goalSection = el.createDiv({ cls: "ft-canvas-session-section" });
		goalSection.createEl("h4", { text: "Goal" });
		goalSection.createDiv({ cls: "ft-canvas-session-goal", text: snapshot.goal || "(no goal set)" });

		// Template info
		if (snapshot.templateName) {
			const templateSection = el.createDiv({ cls: "ft-canvas-session-section" });
			templateSection.createEl("h4", { text: "Template" });
			templateSection.createDiv({ cls: "ft-canvas-session-template", text: snapshot.templateName });
		}

		// Timer
		const timerSection = el.createDiv({ cls: "ft-canvas-session-section" });
		timerSection.createEl("h4", { text: "Timer" });
		const timerRow = timerSection.createDiv({ cls: "ft-canvas-session-timer" });
		const timerIcon = timerRow.createSpan({ cls: "ft-icon-muted" });
		setIcon(timerIcon, this.isPaused ? "pause" : "play");
		timerRow.createSpan({ text: this.formatTime(this.elapsedMs) });
		if (this.remainingMs > 0) {
			timerRow.createSpan({ cls: "ft-text-muted", text: ` / ${this.formatTime(this.remainingMs)} remaining` });
		}

		// Stats
		const statsSection = el.createDiv({ cls: "ft-canvas-session-section" });
		statsSection.createEl("h4", { text: "Stats" });
		const statsGrid = statsSection.createDiv({ cls: "ft-canvas-session-stats" });
		this.renderStat(statsGrid, "plus-circle", "Nodes", snapshot.stats.nodesAdded);
		this.renderStat(statsGrid, "pencil", "Modified", snapshot.stats.nodesModified);
		this.renderStat(statsGrid, "link", "Edges", snapshot.stats.edgesAdded);

		// Phase progression
		if (snapshot.phases.length > 0) {
			const phaseSection = el.createDiv({ cls: "ft-canvas-session-section" });
			phaseSection.createEl("h4", { text: "Phases" });
			const phaseList = phaseSection.createDiv({ cls: "ft-canvas-session-phases" });
			for (let i = 0; i < snapshot.phases.length; i++) {
				const phase = snapshot.phases[i];
				const phaseEl = phaseList.createDiv({
					cls: `ft-canvas-session-phase${i === snapshot.activePhaseIndex ? " is-active" : ""}${phase.visited ? " is-visited" : ""}`,
				});
				const icon = phaseEl.createSpan({ cls: "ft-icon-sm" });
				setIcon(icon, i === snapshot.activePhaseIndex ? "circle-dot" : phase.visited ? "check-circle" : "circle");
				phaseEl.createSpan({ text: phase.label });
			}
		}

		// Activity feed
		const activitySection = el.createDiv({ cls: "ft-canvas-session-section" });
		activitySection.createEl("h4", { text: "Activity" });
		if (snapshot.activities.length === 0) {
			activitySection.createDiv({ cls: "ft-text-muted", text: "No activity yet." });
		} else {
			const feed = activitySection.createDiv({ cls: "ft-canvas-session-feed" });
			for (const activity of snapshot.activities.slice(0, 20)) {
				const item = feed.createDiv({ cls: "ft-canvas-session-feed-item" });
				const time = new Date(activity.timestamp);
				item.createSpan({ cls: "ft-text-muted ft-text-xs", text: `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}` });
				item.createSpan({ text: ` ${activity.detail}` });
			}
		}
	}

	private renderStat(container: HTMLElement, icon: string, label: string, value: number): void {
		const stat = container.createDiv({ cls: "ft-canvas-session-stat" });
		const iconEl = stat.createSpan({ cls: "ft-icon-sm" });
		setIcon(iconEl, icon);
		stat.createSpan({ text: `${value}` });
		stat.createSpan({ cls: "ft-text-muted ft-text-xs", text: ` ${label}` });
	}

	private formatTime(ms: number): string {
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, "0")}`;
	}
}
