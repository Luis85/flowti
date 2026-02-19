/**
 * Dashboard component for the User Hub.
 *
 * Renders a welcome section, cross-hub summary cards (from HubRegistry),
 * an always-visible inbox section, and quick-action buttons.
 */

import { setIcon } from "obsidian";
import type { IUserService } from "../../domain/user/types";
import type { HubRegistry } from "../../domain/hub/HubRegistry";
import type { IEventBus } from "../../infrastructure/events/types";
import type { InboxService } from "../../domain/inbox/InboxService";
import type { NudgeService } from "../../domain/nudge/NudgeService";
import type { SessionService } from "../../domain/session/SessionService";
import { computeRemainingMs, formatDuration } from "../../domain/session/helpers";
import { renderStatGrid, type StatCardItem } from "../shared/StatCard";
import { formatSourceEvent, formatTime, SESSION_TYPE_LABELS, type InboxItem } from "./types";

export interface UserHubDashboardDeps {
	userService: IUserService;
	hubRegistry: HubRegistry;
	eventBus: IEventBus;
	inboxService: InboxService;
	sessionService: SessionService;
	nudgeService?: NudgeService;
	navigateToTab: (tabId: string) => void;
	onInboxItemClick: (item: InboxItem) => void;
	openSessionWorkspace: (sessionId?: string, location?: "tab" | "sidebar") => void;
	onCreateSession?: () => void;
}

export class UserHubDashboard {
	constructor(
		private container: HTMLElement,
		private deps: UserHubDashboardDeps,
	) {}

	render(): void {
		this.container.empty();

		this.renderWelcome();
		this.renderNextNudge();
		this.renderActiveSession();
		this.renderQuickActions();
		this.renderHubSummaries();
		this.renderInboxSection();
	}

	/**
	 * Directly updates the dashboard session timer without a full re-render.
	 * Called by UserHubView on every session.timer.tick event.
	 */
	updateTimerDisplay(remainingMs: number): void {
		const el = this.container.querySelector(".ft-dashboard-session-timer");
		if (el) {
			el.textContent = formatDuration(remainingMs);
		}
	}

	private renderWelcome(): void {
		const section = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-mb-3" });
		section.style.borderBottom = "1px solid var(--background-modifier-border)";
		section.style.paddingBottom = "0.75rem";

		const icon = section.createSpan();
		setIcon(icon, "home");
		icon.addClass("ft-icon-muted");

		const user = this.deps.userService.getUser();
		const greeting = user ? `Welcome, ${user.name}` : "Welcome to Flowti";

		section.createEl("h2", { text: greeting, cls: "ft-heading" }).style.margin = "0";
	}

	private renderNextNudge(): void {
		const nudgeService = this.deps.nudgeService;
		if (!nudgeService) return;

		const configs = nudgeService.getConfigs().filter((c) => c.enabled && !nudgeService.isDismissedToday(c.id));
		if (configs.length === 0) return;

		// Find the next upcoming nudge by time (HH:MM string comparison works for 24h format)
		const now = new Date();
		const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
		const upcoming = configs.filter((c) => c.time > currentTime).sort((a, b) => a.time.localeCompare(b.time));
		const next = upcoming[0];
		if (!next) return;

		const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-next-nudge" });
		row.style.marginBottom = "0.75rem";
		row.style.padding = "0.35rem 0.75rem";
		row.style.borderRadius = "6px";
		row.style.backgroundColor = "var(--background-secondary)";

		const icon = row.createSpan();
		setIcon(icon, "bell");
		icon.style.opacity = "0.5";

		row.createSpan({ text: `Next: ${next.title}`, cls: "ft-text-sm" });
		row.createSpan({ text: next.time, cls: "ft-badge ft-badge-muted ft-text-sm" });

		const typeLabel = SESSION_TYPE_LABELS[next.sessionType] ?? next.sessionType;
		row.createSpan({ text: typeLabel, cls: "ft-text-sm ft-text-muted" });
	}

	private renderActiveSession(): void {
		const session = this.deps.sessionService.getActiveSession();
		if (!session) return;

		const isActive = session.status === "active";

		const section = this.container.createDiv({ cls: "ft-active-session" });
		section.style.marginBottom = "1rem";
		section.style.padding = "0.75rem";
		section.style.border = `1px solid ${isActive ? "var(--interactive-accent)" : "var(--background-modifier-border)"}`;
		section.style.borderRadius = "8px";
		section.style.backgroundColor = "var(--background-secondary)";
		section.style.cursor = "pointer";
		section.addEventListener("click", () => {
			this.deps.openSessionWorkspace(session.id);
		});

		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, isActive ? "timer" : "pause");

		header.createSpan({ text: session.title, cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		header.createSpan({
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});

		if (session.focusFile) {
			const focusBadge = header.createSpan({
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
			const focusIcon = focusBadge.createSpan();
			setIcon(focusIcon, "file");
			focusIcon.style.marginRight = "0.25rem";
			focusBadge.appendText(session.focusFile.split("/").pop() ?? session.focusFile);
		}

		if (session.goals.length > 0) {
			const completed = session.goals.filter((g) => g.completed).length;
			header.createSpan({
				text: `${completed}/${session.goals.length} goals`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		if (!isActive) {
			header.createSpan({
				text: "Paused",
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		const spacer = header.createDiv();
		spacer.style.flex = "1";

		const remaining = computeRemainingMs(session);
		const timerSpan = header.createSpan({
			text: formatDuration(remaining),
			cls: "ft-text-sm ft-dashboard-session-timer",
		});
		timerSpan.style.fontFamily = "var(--font-monospace)";

		// Action buttons — contextual based on status
		const actions = section.createDiv({ cls: "ft-flex ft-gap-2" });
		actions.style.marginTop = "0.5rem";
		actions.addEventListener("click", (e) => e.stopPropagation());
		const eb = this.deps.eventBus;

		if (isActive) {
			const pauseBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(pauseBtn, "pause");
			pauseBtn.appendText(" Pause");
			pauseBtn.addEventListener("click", () => {
				void eb.emit("session.pause", { sessionId: session.id });
			});
		} else {
			const resumeBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
			setIcon(resumeBtn, "play");
			resumeBtn.appendText(" Resume");
			resumeBtn.addEventListener("click", () => {
				void eb.emit("session.resume", { sessionId: session.id });
			});
		}

		const completeBtn = actions.createEl("button", { cls: "ft-btn ft-btn-sm" });
		setIcon(completeBtn, "check-circle");
		completeBtn.appendText(" Complete");
		completeBtn.addEventListener("click", () => {
			void eb.emit("session.complete", { sessionId: session.id });
		});
	}

	private getActivityIcon(action: string): string {
		switch (action) {
			case "created": return "file-plus";
			case "modified": return "file-edit";
			case "deleted": return "file-minus";
			case "renamed": return "file-symlink";
			case "opened": return "file-search";
			default: return "file";
		}
	}

	private renderInboxSection(): void {
		const items = this.deps.inboxService.getItems();
		const unreadCount = this.deps.inboxService.getUnreadCount();
		const maxVisible = 5;

		// Always-visible inbox section
		const section = this.container.createDiv({ cls: "ft-inbox-section" });
		section.style.marginBottom = "1.5rem";
		section.style.border = "1px solid var(--background-modifier-border)";
		section.style.borderRadius = "8px";
		section.style.overflow = "hidden";

		// Header
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		header.style.padding = "0.5rem 0.75rem";
		header.style.borderBottom = items.length > 0 ? "1px solid var(--background-modifier-border)" : "none";
		header.style.backgroundColor = "var(--background-secondary)";

		const headerIcon = header.createSpan();
		setIcon(headerIcon, "inbox");
		headerIcon.addClass("ft-icon-muted");

		header.createEl("h3", { text: "Inbox", cls: "ft-heading ft-heading-sm" }).style.margin = "0";

		if (unreadCount > 0) {
			header.createSpan({
				text: `${unreadCount} unread`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		// Spacer + clear all button (only when items exist)
		if (items.length > 0) {
			const spacer = header.createDiv();
			spacer.style.flex = "1";

			const clearBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm ft-text-muted" });
			setIcon(clearBtn, "trash-2");
			clearBtn.appendText(" Clear");
			clearBtn.addEventListener("click", () => {
				void this.deps.inboxService.clearAll();
			});
		}

		// Empty state
		if (items.length === 0) {
			const empty = section.createDiv({ cls: "ft-flex ft-flex-col ft-items-center" });
			empty.style.padding = "2rem";
			empty.style.color = "var(--text-muted)";

			const emptyIcon = empty.createDiv();
			setIcon(emptyIcon, "inbox");
			emptyIcon.style.opacity = "0.3";
			emptyIcon.style.marginBottom = "0.5rem";

			empty.createDiv({ text: "Your inbox is empty", cls: "ft-text-sm" });
			empty.createDiv({
				text: "Items from watchers, imports, and exports will appear here.",
				cls: "ft-text-sm ft-text-muted",
			}).style.marginTop = "0.25rem";
			return;
		}

		// Item rows
		const visible = items.slice(0, maxVisible);
		for (const item of visible) {
			const row = section.createDiv({ cls: "ft-catalog-row ft-cursor-pointer" });
			row.style.padding = "0.5rem 0.75rem";
			row.style.borderBottom = "1px solid var(--background-modifier-border)";

			if (!item.read) {
				row.style.fontWeight = "600";
				row.style.borderLeft = "3px solid var(--interactive-accent)";
			}

			const icon = row.createSpan();
			setIcon(icon, item.type === "action" ? "alert-circle" : "info");
			icon.style.opacity = "0.6";
			icon.style.marginRight = "0.5rem";

			row.createSpan({ text: item.title });

			const source = row.createSpan({
				text: formatSourceEvent(item.sourceEvent),
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
			source.style.marginLeft = "0.5rem";

			const time = row.createSpan({
				text: formatTime(item.timestamp),
				cls: "ft-text-muted ft-text-sm",
			});
			time.style.marginLeft = "auto";

			row.addEventListener("click", () => this.deps.onInboxItemClick(item));
		}

		// "View all" link when more items exist
		if (items.length > maxVisible) {
			const footer = section.createDiv({ cls: "ft-flex" });
			footer.style.justifyContent = "flex-end";
			footer.style.padding = "0.5rem 0.75rem";
			footer.style.backgroundColor = "var(--background-secondary)";

			const link = footer.createEl("span", {
				text: `View all (${items.length}) →`,
				cls: "ft-nav-link ft-text-sm",
			});
			link.addEventListener("click", () => this.deps.navigateToTab("inbox"));
		}
	}

	private renderHubSummaries(): void {
		const providers = this.deps.hubRegistry
			.getAll()
			.filter((p) => p.getHubId() !== "user-hub");

		if (providers.length === 0) return;

		const section = this.container.createDiv();
		section.style.marginBottom = "1.5rem";
		section.createEl("h3", { text: "Your Hubs", cls: "ft-heading ft-heading-sm" }).style.marginBottom = "0.5rem";

		// Collect stat cards from all providers, each clicking through to its hub
		const cards: StatCardItem[] = [];
		for (const provider of providers) {
			const summary = provider.getSummary();
			const hubId = provider.getHubId();

			for (const stat of summary.stats) {
				cards.push({
					icon: stat.icon,
					value: stat.value,
					label: `${provider.getDisplayName()} — ${stat.label}`,
					onClick: () => void this.deps.hubRegistry.openHub(hubId, stat.tabId),
				});
			}
		}

		renderStatGrid(section, cards, 3);
	}

	private renderQuickActions(): void {
		const section = this.container.createDiv();
		section.createEl("h3", { text: "Quick Actions", cls: "ft-heading ft-heading-sm" }).style.marginBottom = "0.5rem";
		section.style.marginBottom = "0.75rem";

		const grid = section.createDiv({ cls: "ft-flex ft-gap-2" });
		grid.style.flexWrap = "wrap";

		const eb = this.deps.eventBus;
		const nav = this.deps.navigateToTab;
		const actions: Array<{ icon: string; label: string; action: () => void }> = [
			...(this.deps.onCreateSession ? [{ icon: "plus-circle", label: "New Session", action: this.deps.onCreateSession }] : []),
			{ icon: "timer", label: "Sessions", action: () => nav("sessions") },
			{ icon: "inbox", label: "Inbox", action: () => nav("inbox") },
			{ icon: "settings", label: "Preferences", action: () => nav("preferences") },
			{ icon: "list", label: "Event Catalog", action: () => void eb.emit("ui.openEventCatalog", {}) },
			{ icon: "arrow-left-right", label: "Data Exchange", action: () => void eb.emit("ui.openDataExchangeHub", {}) },
			{ icon: "activity", label: "Activity Log", action: () => void eb.emit("ui.openEventLog", {}) },
			{ icon: "bell", label: "Watchers", action: () => void eb.emit("ui.openSubscriptionManager", {}) },
		];

		for (const act of actions) {
			const btn = grid.createEl("span", { cls: "ft-nav-link" });
			const iconEl = btn.createSpan();
			setIcon(iconEl, act.icon);
			btn.appendText(` ${act.label}`);
			btn.addEventListener("click", act.action);
		}
	}
}
