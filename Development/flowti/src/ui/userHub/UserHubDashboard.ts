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
import type { TrainService } from "../../domain/train/TrainService";
import { computeRemainingMs, formatDuration } from "../../domain/session/helpers";
import type { FlowtiSettings } from "../../domain/settings/settings";
import { formatSourceEvent, formatTime, SESSION_TYPE_LABELS, type InboxItem } from "./types";
import { IdeaCaptureSection } from "./IdeaCaptureSection";

export interface UserHubDashboardDeps {
	userService: IUserService;
	hubRegistry: HubRegistry;
	eventBus: IEventBus;
	inboxService: InboxService;
	sessionService: SessionService;
	nudgeService?: NudgeService;
	trainService?: TrainService;
	navigateToTab: (tabId: string) => void;
	onInboxItemClick: (item: InboxItem) => void;
	openSessionWorkspace: (sessionId?: string, location?: "tab" | "sidebar") => void;
	onCreateSession?: () => void;
	onCaptureIdea?: (title: string) => void;
	getSettings: () => FlowtiSettings;
}

export class UserHubDashboard {
	constructor(
		private container: HTMLElement,
		private deps: UserHubDashboardDeps,
	) {}

	render(): void {
		this.container.empty();

		this.renderWelcome();

		// Check if the hub has real content beyond the static welcome
		const hasActiveSession = !!this.deps.sessionService.getActiveSession();
		const hasActiveTrain = !!this.deps.trainService?.getActiveTrain();
		const hasInboxItems = this.deps.inboxService.getItems().length > 0;
		const hasHubSummaries = this.deps.hubRegistry
			.getAll()
			.filter((p) => p.getHubId() !== "user-hub")
			.some((p) => p.getSummary().stats.length > 0);

		if (!hasActiveSession && !hasActiveTrain && !hasInboxItems && !hasHubSummaries) {
			this.renderEmptyState();
			this.renderNextNudge();
			this.renderToolbar();
			this.renderHubSummaries();
			this.renderInboxSection();
			return;
		}

		this.renderNextNudge();
		this.renderActiveSession();
		this.renderActiveTrain();
		this.renderToolbar();
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
		const trainEl = this.container.querySelector(".ft-dashboard-train-timer");
		if (trainEl) {
			trainEl.textContent = formatDuration(remainingMs);
		}
	}

	private renderWelcome(): void {
		const section = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-3 ft-dashboard-welcome" });

		const icon = section.createSpan();
		setIcon(icon, "home");
		icon.addClass("ft-icon-muted");

		const user = this.deps.userService.getUser();
		const greeting = user ? `Welcome, ${user.name}` : "Welcome to Flowti";

		section.createEl("h2", { text: greeting, cls: "ft-heading ft-m-0" });
	}

	private renderEmptyState(): void {
		const wrapper = this.container.createDiv({ cls: "ft-empty-state ft-dashboard-empty" });

		// Hero icon
		const iconEl = wrapper.createDiv({ cls: "ft-dashboard-empty-icon" });
		setIcon(iconEl, "user");

		// Heading
		wrapper.createDiv({ text: "Welcome to Your Hub", cls: "ft-dashboard-empty-heading" });

		// Subtitle
		wrapper.createDiv({
			text: "Your personal dashboard showing hub summaries, active sessions, and inbox notifications.",
			cls: "ft-text-sm ft-text-muted ft-dashboard-empty-subtitle",
		});

		// Action cards grid
		const grid = wrapper.createDiv({ cls: "ft-action-cards-grid" });

		// Card 1: Open Analytics Hub
		const card1 = grid.createDiv({ cls: "ft-stat-card ft-dashboard-action-card" });
		const title1 = card1.createDiv({ cls: "ft-dashboard-action-title" });
		const icon1 = title1.createSpan({ cls: "ft-dashboard-action-icon" });
		setIcon(icon1, "bar-chart-big");
		title1.createSpan({ text: "Open Analytics Hub" });
		card1.createDiv({ text: "Explore your dashboards and query data from CSV sources", cls: "ft-text-xs ft-text-muted" });
		card1.addEventListener("click", () => {
			void this.deps.eventBus.emit("ui.openAnalyticsHub", {});
		});

		// Card 2: Start a Session
		const card2 = grid.createDiv({ cls: "ft-stat-card ft-dashboard-action-card" });
		const title2 = card2.createDiv({ cls: "ft-dashboard-action-title" });
		const icon2 = title2.createSpan({ cls: "ft-dashboard-action-icon" });
		setIcon(icon2, "timer");
		title2.createSpan({ text: "Start a Session" });
		card2.createDiv({ text: "Begin a focused work session to capture notes and decisions", cls: "ft-text-xs ft-text-muted" });
		card2.addEventListener("click", () => {
			if (this.deps.onCreateSession) {
				this.deps.onCreateSession();
			} else {
				this.deps.navigateToTab("sessions");
			}
		});
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

		const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-next-nudge ft-dashboard-nudge-row" });

		const icon = row.createSpan();
		setIcon(icon, "bell");
		icon.addClass("ft-opacity-50");

		row.createSpan({ text: `Next: ${next.title}`, cls: "ft-text-sm" });
		row.createSpan({ text: next.time, cls: "ft-badge ft-badge-muted ft-text-sm" });

		const typeLabel = SESSION_TYPE_LABELS[next.sessionType] ?? next.sessionType;
		row.createSpan({ text: typeLabel, cls: "ft-text-sm ft-text-muted" });
	}

	private renderActiveSession(): void {
		const session = this.deps.sessionService.getActiveSession();
		if (!session) return;

		const isActive = session.status === "active" || session.status === "running";
		const isTrain = session.type === "train-of-thought";
		const train = isTrain && this.deps.trainService
			? this.deps.trainService.getAllTrains().find((t) => t.sessionId === session.id)
			: undefined;

		const section = this.container.createDiv({ cls: `ft-active-session ft-dashboard-session-callout ${isActive ? "ft-dashboard-session-callout-active" : "ft-dashboard-session-callout-inactive"}` });
		section.addEventListener("click", () => {
			this.deps.openSessionWorkspace(session.id);
		});

		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
		const icon = header.createSpan();
		setIcon(icon, isTrain ? "train-front" : (isActive ? "timer" : "pause"));

		header.createSpan({ text: session.title, cls: "ft-heading ft-heading-sm ft-m-0" });

		header.createSpan({
			text: SESSION_TYPE_LABELS[session.type] ?? session.type,
			cls: "ft-badge ft-badge-muted ft-text-sm",
		});

		if (session.focusFile && session.focusFile !== session.notesFile) {
			const focusBadge = header.createSpan({
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
			const focusIcon = focusBadge.createSpan({ cls: "ft-focus-icon-mr" });
			setIcon(focusIcon, "file");
			focusBadge.appendText(session.focusFile.split("/").pop() ?? session.focusFile);
		}

		if (session.goals.length > 0) {
			const completed = session.goals.filter((g) => g.completed).length;
			header.createSpan({
				text: `${completed}/${session.goals.length} goals`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		if (train) {
			header.createSpan({
				text: `${train.thoughts.length} thought${train.thoughts.length === 1 ? "" : "s"}`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		if (!isActive) {
			header.createSpan({
				text: "Paused",
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		header.createDiv({ cls: "ft-flex-1" });

		const remaining = computeRemainingMs(session);
		header.createSpan({
			text: formatDuration(remaining),
			cls: "ft-text-sm ft-dashboard-session-timer ft-font-mono",
		});

		// Action buttons — contextual based on status
		const actions = section.createDiv({ cls: "ft-flex ft-gap-2 ft-session-actions-mt" });
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

	private renderActiveTrain(): void {
		const train = this.deps.trainService?.getActiveTrain();
		if (!train) return;

		// If the train's session is already visible in the active session callout, skip
		const activeSession = this.deps.sessionService.getActiveSession();
		if (activeSession && activeSession.id === train.sessionId) return;

		const isTimeboxed = train.durationMinutes > 0;
		const trainSession = this.deps.sessionService.getSessionById(train.sessionId);

		if (isTimeboxed && trainSession) {
			// Full callout — same style as active session
			const section = this.container.createDiv({ cls: `ft-active-train ft-dashboard-train-callout ${train.status === "running" ? "ft-dashboard-train-callout-active" : "ft-dashboard-train-callout-inactive"}` });
			section.addEventListener("click", () => {
				void this.deps.eventBus.emit("ui.openTrainView", {});
			});

			const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2" });
			const icon = header.createSpan();
			setIcon(icon, "train-front");
			header.createSpan({ text: train.title, cls: "ft-heading ft-heading-sm ft-m-0" });

			header.createSpan({
				text: `${train.thoughts.length} thought${train.thoughts.length === 1 ? "" : "s"}`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});

			if (train.status === "paused") {
				header.createSpan({ text: "Paused", cls: "ft-badge ft-badge-muted ft-text-sm" });
			}

			header.createDiv({ cls: "ft-flex-1" });

			const remaining = computeRemainingMs(trainSession);
			header.createSpan({
				text: formatDuration(remaining),
				cls: "ft-text-sm ft-dashboard-train-timer ft-font-mono",
			});
		} else {
			// Subtle notice — same pattern as nudge row
			const row = this.container.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-active-train-notice ft-dashboard-train-notice" });
			row.addEventListener("click", () => {
				void this.deps.eventBus.emit("ui.openTrainView", {});
			});

			const icon = row.createSpan();
			setIcon(icon, "train-front");
			icon.addClass("ft-opacity-50");

			row.createSpan({ text: train.title, cls: "ft-text-sm" });

			row.createSpan({
				text: `${train.thoughts.length} thought${train.thoughts.length === 1 ? "" : "s"}`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});

			if (train.status === "paused") {
				row.createSpan({ text: "paused", cls: "ft-text-sm ft-text-muted" });
			} else {
				row.createSpan({ text: "running", cls: "ft-text-sm ft-text-muted" });
			}
		}
	}

	/** All available toolbar actions with their IDs, split by group. */
	private getToolbarActionDefs(): {
		tabs: Array<{ id: string; icon: string; label: string; action: () => void }>;
		actions: Array<{ id: string; icon: string; label: string; action: () => void }>;
	} {
		const eb = this.deps.eventBus;
		const nav = this.deps.navigateToTab;
		return {
			tabs: [
				{ id: "sessions", icon: "timer", label: "Sessions", action: () => nav("sessions") },
				{ id: "inbox", icon: "inbox", label: "Inbox", action: () => nav("inbox") },
				{ id: "commands", icon: "terminal", label: "Commands", action: () => nav("commands") },
				{ id: "preferences", icon: "settings", label: "Preferences", action: () => nav("preferences") },
			],
			actions: [
				...(this.deps.onCreateSession ? [{ id: "new-session", icon: "plus-circle", label: "New session", action: this.deps.onCreateSession }] : []),
				{ id: "watchers", icon: "bell", label: "Watchers", action: () => void eb.emit("ui.openSubscriptionManager", {}) },
			],
		};
	}

	private renderToolbar(): void {
		const settings = this.deps.getSettings();
		const { showQuickActions, toolbarHubs, toolbarActions } = settings.userHubConfig;

		const toolbar = this.container.createDiv({ cls: "ft-dashboard-toolbar" });

		// Group 1: Hub navigation buttons (filtered by toolbarHubs)
		const providers = this.deps.hubRegistry
			.getAll()
			.filter((p) => p.getHubId() !== "user-hub")
			.filter((p) => toolbarHubs.includes(p.getHubId()));

		if (providers.length > 0) {
			const hubsArea = toolbar.createDiv({ cls: "ft-flex ft-gap-1 ft-items-center ft-toolbar-hubs" });
			for (const provider of providers) {
				const hubId = provider.getHubId();
				const btn = hubsArea.createEl("span", { cls: "ft-quick-action-btn ft-toolbar-hub-btn" });
				btn.title = provider.getDisplayName();
				const iconEl = btn.createSpan();
				setIcon(iconEl, provider.getIcon());
				btn.createSpan({ text: provider.getDisplayName(), cls: "ft-quick-action-label" });
				btn.addEventListener("click", () => void this.deps.hubRegistry.openHub(hubId));
			}
		}

		if (showQuickActions) {
			const { tabs, actions } = this.getToolbarActionDefs();

			// Group 2: User Hub tabs (filtered by toolbarActions)
			const visibleTabs = tabs.filter((t) => toolbarActions.includes(t.id));
			if (visibleTabs.length > 0) {
				const tabsArea = toolbar.createDiv({ cls: "ft-flex ft-gap-1 ft-items-center ft-toolbar-tabs" });
				for (const tab of visibleTabs) {
					this.renderToolbarBtn(tabsArea, tab);
				}
			}

			// Group 3: Other actions (filtered by toolbarActions)
			const visibleActions = actions.filter((a) => toolbarActions.includes(a.id));
			if (visibleActions.length > 0) {
				const actionsArea = toolbar.createDiv({ cls: "ft-flex ft-gap-1 ft-items-center ft-toolbar-actions" });
				for (const act of visibleActions) {
					this.renderToolbarBtn(actionsArea, act);
				}
			}
		}

		toolbar.createDiv({ cls: "ft-flex-1" });

		// Right: compact idea capture
		if (this.deps.onCaptureIdea) {
			const captureArea = toolbar.createDiv();
			new IdeaCaptureSection(captureArea, {
				eventBus: this.deps.eventBus,
				inboxService: this.deps.inboxService,
				onCapture: this.deps.onCaptureIdea,
			}).renderCompact();
		}
	}

	private renderToolbarBtn(container: HTMLElement, def: { icon: string; label: string; action: () => void }): void {
		const btn = container.createEl("span", { cls: "ft-quick-action-btn" });
		btn.title = def.label;
		const iconEl = btn.createSpan();
		setIcon(iconEl, def.icon);
		btn.createSpan({ text: def.label, cls: "ft-quick-action-label" });
		btn.addEventListener("click", def.action);
	}

	private renderSeparator(): void {
		this.container.createDiv({ cls: "ft-dashboard-separator" });
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

		const section = this.container.createDiv({ cls: "ft-inbox-section ft-dashboard-inbox" });

		// Header — lightweight, no background
		const header = section.createDiv({ cls: "ft-flex ft-items-center ft-gap-2 ft-dashboard-inbox-header" });

		const headerIcon = header.createSpan();
		setIcon(headerIcon, "inbox");
		headerIcon.addClass("ft-icon-muted", "ft-icon-sm");

		header.createSpan({ text: "Inbox", cls: "ft-heading ft-heading-sm ft-m-0" });

		if (unreadCount > 0) {
			header.createSpan({
				text: `${unreadCount}`,
				cls: "ft-badge ft-badge-muted ft-text-sm",
			});
		}

		header.createDiv({ cls: "ft-flex-1" });

		if (items.length > 0) {
			const clearBtn = header.createEl("button", { cls: "ft-btn ft-btn-sm ft-text-muted" });
			setIcon(clearBtn, "trash-2");
			clearBtn.addEventListener("click", () => {
				void this.deps.inboxService.clearAll();
			});
		}

		// Empty state — minimal single line
		if (items.length === 0) {
			section.createDiv({ text: "No inbox items", cls: "ft-text-sm ft-text-muted ft-dashboard-inbox-empty" });
			return;
		}

		// Item rows — tabular grid layout
		const table = section.createDiv({ cls: "ft-dashboard-inbox-table" });
		const visible = items.slice(0, maxVisible);
		for (const item of visible) {
			const row = table.createDiv({ cls: `ft-dashboard-inbox-row ft-cursor-pointer${!item.read ? " ft-dashboard-inbox-unread" : ""}` });

			const titleCell = row.createDiv({ cls: "ft-dashboard-inbox-cell-title" });
			const icon = titleCell.createSpan({ cls: "ft-inbox-item-icon" });
			setIcon(icon, item.type === "action" ? "alert-circle" : "info");
			titleCell.createSpan({ text: item.title, cls: "ft-text-sm" });

			row.createDiv({
				text: formatSourceEvent(item.sourceEvent),
				cls: "ft-text-xs ft-text-muted ft-dashboard-inbox-cell-source",
			});

			row.createDiv({
				text: formatTime(item.timestamp),
				cls: "ft-text-muted ft-text-xs ft-dashboard-inbox-cell-time",
			});

			row.addEventListener("click", () => this.deps.onInboxItemClick(item));
		}

		// "View all" link
		if (items.length > maxVisible) {
			const footer = section.createDiv({ cls: "ft-flex ft-dashboard-inbox-footer" });

			const link = footer.createEl("span", {
				text: `View all (${items.length})`,
				cls: "ft-nav-link ft-text-sm",
			});
			link.addEventListener("click", () => this.deps.navigateToTab("inbox"));
		}
	}

	private renderHubSummaries(): void {
		const settings = this.deps.getSettings();
		const { visibleHubs } = settings.userHubConfig;

		const providers = this.deps.hubRegistry
			.getAll()
			.filter((p) => p.getHubId() !== "user-hub")
			.filter((p) => visibleHubs.includes(p.getHubId()));

		if (providers.length === 0) return;

		const section = this.container.createDiv({ cls: "ft-dashboard-hubs" });

		for (const provider of providers) {
			const summary = provider.getSummary();
			const hubId = provider.getHubId();

			const row = section.createDiv({ cls: "ft-dashboard-hub-row ft-cursor-pointer" });
			row.addEventListener("click", () => void this.deps.hubRegistry.openHub(hubId));

			const icon = row.createSpan({ cls: "ft-icon-muted" });
			setIcon(icon, provider.getIcon());

			row.createSpan({ text: provider.getDisplayName(), cls: "ft-text-sm" });

			// Inline stats
			for (const stat of summary.stats) {
				const pill = row.createSpan({ cls: "ft-dashboard-hub-stat" });
				pill.createSpan({ text: stat.value, cls: "ft-font-semibold" });
				pill.createSpan({ text: ` ${stat.label}`, cls: "ft-text-muted" });
			}
		}
	}

}
