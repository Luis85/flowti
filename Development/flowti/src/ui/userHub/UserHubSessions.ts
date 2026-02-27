/**
 * Sessions tab component for the User Hub.
 *
 * Renders a master list of documentation sessions grouped by status.
 * Delegates detail rendering to SessionDetailPanel and timer display
 * to SessionTimerDisplay.
 */

import { setIcon } from "obsidian";
import type { Session } from "../../domain/session/types";
import { SessionDetailPanel } from "./SessionDetailPanel";
import {
	SESSION_STATUS_LABELS,
	SESSION_TYPE_LABELS,
	type UserHubComponentDeps,
} from "./types";

/** Maps session status to a Lucide icon name. */
const STATUS_ICONS: Record<string, string> = {
	prepared: "circle",
	active: "play",
	running: "play",
	paused: "pause",
	reviewing: "eye",
	completed: "check-circle",
	archived: "archive",
};

/** Ordered status categories for the master list. "running" is v2 canonical for "active". */
const STATUS_ORDER: string[] = ["running", "active", "paused", "prepared", "reviewing", "completed", "archived"];

export class UserHubSessions {
	private collapsedCategories = new Set<string>(["completed", "archived"]);
	private detailPanel: SessionDetailPanel;

	constructor(
		private masterEl: HTMLElement,
		private detailEl: HTMLElement,
		private deps: UserHubComponentDeps,
	) {
		this.detailPanel = new SessionDetailPanel(detailEl, deps);
	}

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
		const header = this.masterEl.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-session-list-header" });

		const count = header.createSpan({ cls: "ft-text-sm ft-text-muted" });
		const activeCount = sessions.filter((s) => s.status === "active" || s.status === "running").length;
		count.setText(
			`${sessions.length} session${sessions.length === 1 ? "" : "s"}${activeCount > 0 ? ` (${activeCount} active)` : ""}`,
		);

		header.createDiv({ cls: "ft-flex-1" });

		const addBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(addBtn, "plus");
		addBtn.appendText(" New");
		addBtn.addEventListener("click", () => this.deps.openNewSessionModal());

		// Group by status and render collapsible categories
		for (const status of STATUS_ORDER) {
			const group = sessions.filter((s) => s.status === status);
			if (group.length === 0) continue;

			const isCollapsed = this.collapsedCategories.has(status);

			const categoryEl = this.masterEl.createDiv({ cls: "ft-session-category" });

			// Category header
			const categoryHeader = categoryEl.createDiv({ cls: "ft-session-category-header ft-cursor-pointer ft-session-category-header-style" });

			const chevron = categoryHeader.createSpan({ cls: "ft-category-chevron" });
			setIcon(chevron, isCollapsed ? "chevron-right" : "chevron-down");
			chevron.addClass("ft-opacity-half");

			const statusIcon = categoryHeader.createSpan();
			setIcon(statusIcon, STATUS_ICONS[status] ?? "circle");
			statusIcon.addClass("ft-opacity-half");

			categoryHeader.createSpan({
				text: `${SESSION_STATUS_LABELS[status] ?? status} (${group.length})`,
			});

			// Collapsible content
			const contentEl = categoryEl.createDiv({ cls: `ft-session-category-content${isCollapsed ? " ft-session-category-collapsed" : ""}` });

			categoryHeader.addEventListener("click", () => {
				if (this.collapsedCategories.has(status)) {
					this.collapsedCategories.delete(status);
				} else {
					this.collapsedCategories.add(status);
				}
				this.deps.scheduleRender();
			});

			for (const session of group) {
				this.renderSessionRow(contentEl, session, state);
			}
		}
	}

	renderDetail(): void {
		this.detailPanel.render();
	}

	/**
	 * Directly updates the timer display without a full re-render.
	 * Called by UserHubView on every session.timer.tick event.
	 */
	updateTimerDisplay(remainingMs: number): void {
		this.detailPanel.updateTimerDisplay(remainingMs);
	}

	// ── Private ─────────────────────────────────────────────

	private renderSessionRow(container: HTMLElement, session: Session, state: { selectedSession: Session | null }): void {
		const isActive = session.status === "active" || session.status === "running";
		const isSelected = state.selectedSession?.id === session.id;
		const row = container.createDiv({ cls: `ft-catalog-row ft-cursor-pointer ft-session-row-mb${isSelected ? " ft-catalog-row-active ft-session-row-selected" : ""}${isActive ? " ft-session-row-active-border" : ""}` });

		// Status icon — use train icon for train-of-thought sessions
		const isTrain = session.type === "train-of-thought";
		const icon = row.createSpan({ cls: "ft-session-row-icon" });
		setIcon(icon, isTrain ? "train-front" : (STATUS_ICONS[session.status] ?? "circle"));

		// Title
		row.createSpan({ text: session.title });

		// Thought count badge for train sessions
		if (isTrain && this.deps.trainService) {
			const train = this.deps.trainService.getAllTrains().find((t) => t.sessionId === session.id);
			if (train && train.thoughts.length > 0) {
				row.createSpan({
					text: `${train.thoughts.length} thought${train.thoughts.length === 1 ? "" : "s"}`,
					cls: "ft-badge ft-badge-muted ft-text-sm ft-train-thought-badge ft-thought-badge-ml",
				});
			}
		}

		// Date hint — always shown to disambiguate same-titled sessions
		const created = new Date(session.createdAt);
		row.createSpan({
			text: `${created.getMonth() + 1}/${created.getDate()} ${String(created.getHours()).padStart(2, "0")}:${String(created.getMinutes()).padStart(2, "0")}`,
			cls: "ft-text-muted ft-text-sm ft-session-date-hint",
		});

		// Type badge
		row.createSpan({
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge ft-badge-muted ft-text-sm ft-session-type-badge-ml",
		});

		row.addEventListener("click", () => {
			const current = this.deps.getState().selectedSession;
			this.deps.setState({ selectedSession: current?.id === session.id ? null : session });
			this.deps.scheduleRender();
		});
	}

	private renderEmptyState(): void {
		const empty = this.masterEl.createDiv({ cls: "ft-flex ft-flex-col ft-items-center ft-session-empty" });

		const icon = empty.createDiv({ cls: "ft-session-empty-icon" });
		setIcon(icon, "timer");
		icon.querySelector("svg")?.setAttribute("width", "48");
		icon.querySelector("svg")?.setAttribute("height", "48");

		empty.createDiv({ text: "No sessions yet", cls: "ft-heading ft-heading-sm" });
		empty.createDiv({
			text: "Time-boxed documentation sessions will appear here.",
			cls: "ft-text-muted ft-text-sm ft-session-empty-hint",
		});

		const btn = empty.createEl("button", { cls: "ft-btn ft-session-empty-btn" });
		setIcon(btn, "plus");
		btn.appendText(" New Session");
		btn.addEventListener("click", () => this.deps.openNewSessionModal());
	}
}
