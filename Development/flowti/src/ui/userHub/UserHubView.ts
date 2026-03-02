/**
 * User Hub view — the personal cockpit.
 *
 * Extends BaseHubView with Inbox and Preferences tabs, plus a dashboard
 * that aggregates cross-hub summaries via HubRegistry.
 */

import type { WorkspaceLeaf } from "obsidian";
import { setIcon } from "obsidian";
import type { IUserService } from "../../domain/user/types";
import type { HubRegistry } from "../../domain/hub/HubRegistry";
import type { InboxService } from "../../domain/inbox/InboxService";
import type { NudgeService } from "../../domain/nudge/NudgeService";
import type { SessionService } from "../../domain/session/SessionService";
import type { IEventBus } from "../../infrastructure/events/types";
import type { FlowtiSettings } from "../../domain/settings/settings";
import { BaseHubView, type TabDef } from "../BaseHubView";
import type { OnboardingService } from "../../domain/onboarding/OnboardingService";
import { UserHubDashboard } from "./UserHubDashboard";
import { UserHubInbox } from "./UserHubInbox";
import { UserHubSessions } from "./UserHubSessions";
import { UserHubCommands } from "./UserHubCommands";
import { UserHubPreferences } from "./UserHubPreferences";
import type { UserHubState, UserHubComponentDeps, InboxItem, UserHubTab } from "./types";
import { NewSessionModal, SaveTemplateModal } from "../modals";
import { SESSION_TYPE_LABELS } from "./types";
import { SESSION_TYPES, type SessionType } from "../../domain/session/types";
import { VIEW_TYPE_USER_HUB } from "../../domain/hub/types";
import { VIEW_TYPE_SESSION_WORKSPACE } from "../session/types";
import { VIEW_TYPE_TRAIN_MAIN, VIEW_TYPE_TRAIN_TIMELINE } from "../train/types";
import type { TrainService } from "../../domain/train/TrainService";
import type { ICommandRegistry } from "../../infrastructure/commands/types";
export { VIEW_TYPE_USER_HUB };

/** Session types available in NewSessionModal (excludes specialized types with their own creation flow). */
const MODAL_SESSION_TYPES = SESSION_TYPES.filter(
	(st) => st.type !== "train-of-thought" && st.type !== "canvas-session",
);

export class UserHubView extends BaseHubView<UserHubTab> {
	private userService: IUserService;
	private hubRegistry: HubRegistry;
	private inboxService: InboxService;
	private sessionService: SessionService;
	private nudgeService: NudgeService;
	private onboardingService: OnboardingService;
	private trainService: TrainService | null;
	private commandRegistry: ICommandRegistry | null;

	// Components
	private dashboard!: UserHubDashboard;
	private inbox!: UserHubInbox;
	private sessions!: UserHubSessions;
	private commands!: UserHubCommands;
	private preferences!: UserHubPreferences;

	// State
	private state!: UserHubState;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		userService: IUserService,
		hubRegistry: HubRegistry,
		inboxService: InboxService,
		sessionService: SessionService,
		nudgeService: NudgeService,
		onboardingService: OnboardingService,
		initialEnabledSources: string[],
		initialSettings: FlowtiSettings,
		trainService?: TrainService | null,
		commandRegistry?: ICommandRegistry | null,
	) {
		super(leaf, eventBus);
		this.userService = userService;
		this.hubRegistry = hubRegistry;
		this.inboxService = inboxService;
		this.sessionService = sessionService;
		this.nudgeService = nudgeService;
		this.onboardingService = onboardingService;
		this.trainService = trainService ?? null;
		this.commandRegistry = commandRegistry ?? null;
		this.state = {
			inboxItems: [],
			selectedInboxItem: null,
			inboxEnabledSources: initialEnabledSources,
			sessions: [],
			activeSession: null,
			selectedSession: null,
			settings: initialSettings,
			selectedPreferencesCategory: null,
		};
	}

	// ── Abstract implementations ────────────────────────────

	getViewType(): string {
		return VIEW_TYPE_USER_HUB;
	}

	getHubId(): string {
		return "user-hub";
	}

	getHubType(): "system" | "domain" | "user" {
		return "user";
	}

	getHubDisplayName(): string {
		return "User Hub";
	}

	getHubIcon(): string {
		return "home";
	}

	getTabDefinitions(): TabDef[] {
		return [
			{ id: "sessions", label: "Sessions", icon: "timer", searchPlaceholder: "Search sessions..." },
			{ id: "inbox", label: "Inbox", icon: "inbox", searchPlaceholder: "Search inbox..." },
			{ id: "commands", label: "Commands", icon: "terminal", searchPlaceholder: "Search commands..." },
			{ id: "preferences", label: "Preferences", icon: "settings", searchPlaceholder: "" },
		];
	}

	renderTopBarActions(bar: HTMLElement): void {
		const user = this.userService.getUser();
		if (user) {
			const userEl = bar.createSpan({ cls: "ft-flex ft-items-center ft-gap-1 ft-text-sm ft-text-muted" });
			const icon = userEl.createSpan();
			setIcon(icon, "user");
			userEl.appendText(user.name);
		}
	}

	onDashboardRender(): void {
		this.renderOnboardingCallout(this.dashboardEl, this.onboardingService, {
			id: "user-hub-welcome",
			icon: "home",
			title: "Welcome to your User Hub",
			description: "Your personal cockpit — capture ideas, browse commands, manage inbox notifications, run focus sessions, and monitor signal connections.",
			suggestion: "Capture your first idea below, or explore the Commands tab to discover all available actions.",
		});

		this.dashboard.render();
	}

	onTabRender(tabId: UserHubTab): void {
		if (tabId === "inbox") {
			this.state.inboxItems = this.inboxService.getItems();
			this.inbox.renderMaster(this.filterText);
			this.inbox.renderDetail();
		} else if (tabId === "sessions") {
			this.refreshSessionState();
			this.sessions.renderMaster(this.filterText);
			this.sessions.renderDetail();
		} else if (tabId === "commands") {
			this.commands.renderMaster(this.filterText);
			this.commands.renderDetail();
			// Mark catalogExplored milestone on first visit
			const ms = this.onboardingService.getMilestones();
			if (ms && !ms.catalogExplored) {
				void this.onboardingService.updateChecklist({ milestones: { catalogExplored: true } as never });
			}
		} else if (tabId === "preferences") {
			this.preferences.renderMaster();
			this.preferences.renderDetail();
		}
	}

	protected onTabChanged(): void {
		// Hide search bar on preferences tab (no filterable content)
		if (this.activePage === "preferences") {
			this.searchHeaderEl.classList.add("ft-hidden");
		} else {
			this.searchHeaderEl.classList.remove("ft-hidden");
		}
	}

	onHubOpen(): void {
		const deps = this.buildComponentDeps();

		// Initialize inbox state from service
		this.state.inboxItems = this.inboxService.getItems();

		// Initialize session state from service
		this.refreshSessionState();

		this.dashboard = new UserHubDashboard(this.dashboardEl, {
			userService: this.userService,
			hubRegistry: this.hubRegistry,
			eventBus: this.eventBus,
			inboxService: this.inboxService,
			sessionService: this.sessionService,
			nudgeService: this.nudgeService,
			trainService: this.trainService ?? undefined,
			navigateToTab: (tabId) => this.navigateTo(tabId as UserHubTab),
			onInboxItemClick: (item: InboxItem) => {
				this.state.selectedInboxItem = item;
				if (!item.read) {
					void this.inboxService.markRead(item.id);
				}
				this.navigateTo("inbox");
			},
			onCreateSession: () => {
				new NewSessionModal(this.app, {
					sessionTypes: MODAL_SESSION_TYPES,
					templates: this.sessionService.getSavedTemplates(),
					onSubmit: (title, type, durationMinutes, focusFile, goals, extra) => {
						void this.eventBus.emit("session.create", {
							type: type as SessionType,
							title,
							durationMinutes,
							focusFile: focusFile ?? undefined,
							goals: goals.length > 0 ? goals : undefined,
							...extra,
						});
					},
				}).open();
			},
			openSessionWorkspace: (sessionId?: string, location?: "tab" | "sidebar") => {
				this.openWorkspaceForSession(sessionId, location);
			},
			onCaptureIdea: (title: string) => {
				void this.eventBus.emit("ui.captureIdea", { title });
			},
			getSettings: () => this.state.settings,
		});

		this.inbox = new UserHubInbox(this.masterTreeEl, this.detailPanelEl, deps);
		this.sessions = new UserHubSessions(this.masterTreeEl, this.detailPanelEl, deps);
		this.commands = new UserHubCommands(this.masterTreeEl, this.detailPanelEl, deps);
		this.preferences = new UserHubPreferences(this.masterTreeEl, this.detailPanelEl, deps);

		// Re-render when inbox changes
		this.addUnsubscribe(
			this.eventBus.on("inbox.itemAdded", () => {
				this.state.inboxItems = this.inboxService.getItems();
				this.scheduleRender();
			}),
		);
		this.addUnsubscribe(
			this.eventBus.on("inbox.itemsChanged", () => {
				this.state.inboxItems = this.inboxService.getItems();
				// Keep selection if the item still exists (e.g. mark-read);
				// clear it only when the item was dismissed or cleared
				if (this.state.selectedInboxItem) {
					const fresh = this.state.inboxItems.find(
						(i) => i.id === this.state.selectedInboxItem!.id,
					);
					this.state.selectedInboxItem = fresh ?? null;
				}
				this.scheduleRender();
			}),
		);

		// Re-render when session state changes
		const sessionEvents = [
			"session.created", "session.started", "session.paused", "session.resumed",
			"session.completed", "session.archived", "session.deleted",
			"session.link.added", "session.link.removed", "session.notesFile.updated", "session.canvasFile.updated",
			"session.paths.updated",
		] as const;
		for (const eventType of sessionEvents) {
			this.addUnsubscribe(
				this.eventBus.on(eventType, () => {
					this.refreshSessionState();
					this.scheduleRender();
				}),
			);
		}

		// Timer tick: direct DOM update, no full re-render
		this.addUnsubscribe(
			this.eventBus.on("session.timer.tick", (event) => {
				this.sessions.updateTimerDisplay(event.payload.remainingMs);
				this.dashboard.updateTimerDisplay(event.payload.remainingMs);
			}),
		);

		// Timer completed: full re-render to update status
		this.addUnsubscribe(
			this.eventBus.on("session.timer.completed", () => {
				this.refreshSessionState();
				this.scheduleRender();
			}),
		);

		// Sync settings state from settings.changed events
		this.addUnsubscribe(
			this.eventBus.on("settings.changed", (event) => {
				this.state.inboxEnabledSources = event.payload.settings.inboxEnabledSources;
				this.state.settings = event.payload.settings;
				if (this.activePage === "preferences") {
					this.scheduleRender();
				}
			}),
		);

		// Re-render top bar when user name changes
		this.addUnsubscribe(
			this.eventBus.on("user.updated", () => {
				this.scheduleRender();
			}),
		);
	}

	onHubClose(): void {
		// Cleanup handled by addUnsubscribe for event listeners
	}

	// ── Private ─────────────────────────────────────────────

	private refreshSessionState(): void {
		this.state.sessions = this.sessionService.getSessions();
		this.state.activeSession = this.sessionService.getActiveSession();
		// Keep selection if still present; clear if deleted
		if (this.state.selectedSession) {
			const fresh = this.state.sessions.find(
				(s) => s.id === this.state.selectedSession!.id,
			);
			this.state.selectedSession = fresh ?? null;
		}
	}

	private buildComponentDeps(): UserHubComponentDeps {
		return {
			getState: () => this.state,
			setState: (partial) => {
				Object.assign(this.state, partial);
			},
			eventBus: this.eventBus,
			app: this.app,
			inboxService: this.inboxService,
			sessionService: this.sessionService,
			nudgeService: this.nudgeService,
			userService: this.userService,
			scheduleRender: () => this.scheduleRender(),
			navigateToEvent: (eventType) => {
				void this.hubRegistry.openHub("event-catalog", "events", eventType);
			},
			openNewSessionModal: (initialFocusFile?: string) => {
				new NewSessionModal(this.app, {
					sessionTypes: MODAL_SESSION_TYPES,
					templates: this.sessionService.getSavedTemplates(),
					prefill: initialFocusFile ? { title: "", type: MODAL_SESSION_TYPES[0].type, durationMinutes: 25, focusFile: initialFocusFile } : undefined,
					onSubmit: (title, type, durationMinutes, focusFile, goals, extra) => {
						void this.eventBus.emit("session.create", { type: type as SessionType, title, durationMinutes, focusFile: focusFile ?? undefined, goals: goals.length > 0 ? goals : undefined, ...extra });
					},
				}).open();
			},
			openFile: (filePath) => {
				void this.app.workspace.openLinkText(filePath, "");
			},
			openSaveTemplateModal: (session) => {
				new SaveTemplateModal(this.app, {
					sessionTitle: session.title,
					sessionType: SESSION_TYPE_LABELS[session.type] ?? session.type,
					sessionDuration: session.durationMinutes,
					onSubmit: (name) => {
						void this.sessionService.saveTemplateFromSession(session.id, name);
					},
				}).open();
			},
			openSessionWorkspace: (sessionId?: string, location?: "tab" | "sidebar") => {
				this.openWorkspaceForSession(sessionId, location);
			},
			exportTemplateAsFile: (templateId: string) => {
				const exported = this.sessionService.exportTemplate(templateId);
				if (!exported) {
					void this.eventBus.emit("notice.error", { message: "Template not found" });
					return;
				}
				const json = JSON.stringify(exported, null, 2);
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `${exported.template.name.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
				a.click();
				URL.revokeObjectURL(url);
				void this.eventBus.emit("notice.success", { message: "Template exported" });
			},
			importTemplateFromFile: () => {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json";
				input.addEventListener("change", () => {
					const file = input.files?.[0];
					if (!file) return;
					const reader = new FileReader();
					reader.onload = () => {
						try {
							const data: unknown = JSON.parse(reader.result as string);
							void this.sessionService.importTemplate(data).then((tmpl) => {
								if (tmpl) {
									void this.eventBus.emit("notice.success", { message: `Template "${tmpl.name}" imported` });
									this.scheduleRender();
								} else {
									void this.eventBus.emit("notice.error", { message: "Import failed: invalid format or duplicate name" });
								}
							});
						} catch {
							void this.eventBus.emit("notice.error", { message: "Import failed: invalid JSON" });
						}
					};
					reader.readAsText(file);
				});
				input.click();
			},
			getSettings: () => this.state.settings,
			trainService: this.trainService ?? undefined,
			commandRegistry: this.commandRegistry ?? undefined,
			hubRegistry: this.hubRegistry,
		};
	}

	/**
	 * Open the appropriate workspace for a session.
	 * Train-of-thought sessions with a TrainState open Train views;
	 * those without a TrainState fall back to Session Workspace.
	 */
	private openWorkspaceForSession(sessionId?: string, location?: "tab" | "sidebar"): void {
		if (sessionId) {
			const session = this.sessionService.getSessionById(sessionId);
			if (session?.type === "train-of-thought" && this.hasTrainForSession(sessionId)) {
				this.openTrainView(location);
				return;
			}
			this.sessionService.workspaceSessionId = sessionId;
		}
		if (location === "sidebar") {
			setTimeout(() => {
				const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_SESSION_WORKSPACE)
					.find((l) => l.getRoot() === this.app.workspace.rightSplit);
				const leaf = existing ?? this.app.workspace.getRightLeaf(false);
				if (leaf) {
					void leaf.setViewState({ type: VIEW_TYPE_SESSION_WORKSPACE, active: true, state: { sessionId } });
					void this.app.workspace.revealLeaf(leaf);
				}
			}, 0);
		} else {
			void this.app.workspace.getLeaf("tab").setViewState({
				type: VIEW_TYPE_SESSION_WORKSPACE,
				active: true,
				state: { sessionId },
			});
		}
	}

	/** Check if a TrainState exists for the given session. */
	private hasTrainForSession(sessionId: string): boolean {
		if (!this.trainService) return false;
		return this.trainService.getAllTrains().some((t) => t.sessionId === sessionId);
	}

	/** Open the Train Main View (tab) or Timeline Sidebar depending on location. */
	private openTrainView(location?: "tab" | "sidebar"): void {
		if (location === "sidebar") {
			const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_TIMELINE)
				.find((l) => l.getRoot() === this.app.workspace.rightSplit);
			const leaf = existing ?? this.app.workspace.getRightLeaf(false);
			if (leaf) {
				void leaf.setViewState({ type: VIEW_TYPE_TRAIN_TIMELINE, active: true });
				void this.app.workspace.revealLeaf(leaf);
			}
		} else {
			const existingLeaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_TRAIN_MAIN);
			if (existingLeaves.length > 0) {
				void this.app.workspace.revealLeaf(existingLeaves[0]);
			} else {
				void this.app.workspace.getLeaf("tab").setViewState({
					type: VIEW_TYPE_TRAIN_MAIN,
					active: true,
				});
			}
		}
	}
}
