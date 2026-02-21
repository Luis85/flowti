/**
 * User Hub view — the personal cockpit.
 *
 * Extends BaseHubView with Inbox and Preferences tabs, plus a dashboard
 * that aggregates cross-hub summaries via HubRegistry.
 */

import type { WorkspaceLeaf } from "obsidian";
import { Notice, setIcon } from "obsidian";
import type { IUserService } from "../domain/user/types";
import type { HubRegistry } from "../domain/hub/HubRegistry";
import type { InboxService } from "../domain/inbox/InboxService";
import type { NudgeService } from "../domain/nudge/NudgeService";
import type { SessionService } from "../domain/session/SessionService";
import type { IEventBus } from "../infrastructure/events/types";
import type { FlowtiSettings } from "../domain/settings/settings";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { UserHubDashboard } from "./userHub/UserHubDashboard";
import { UserHubInbox } from "./userHub/UserHubInbox";
import { UserHubSessions } from "./userHub/UserHubSessions";
import { UserHubPreferences } from "./userHub/UserHubPreferences";
import type { UserHubState, UserHubComponentDeps, InboxItem, UserHubTab } from "./userHub/types";
import { NewSessionModal, SaveTemplateModal } from "./modals";
import { SESSION_TYPE_LABELS } from "./userHub/types";
import { SESSION_TYPES, type SessionType } from "../domain/session/types";
import { VIEW_TYPE_USER_HUB } from "../domain/hub/types";
import { VIEW_TYPE_SESSION_WORKSPACE } from "./SessionWorkspaceView";
export { VIEW_TYPE_USER_HUB };

export class UserHubView extends BaseHubView<UserHubTab> {
	private userService: IUserService;
	private hubRegistry: HubRegistry;
	private inboxService: InboxService;
	private sessionService: SessionService;
	private nudgeService: NudgeService;

	// Components
	private dashboard!: UserHubDashboard;
	private inbox!: UserHubInbox;
	private sessions!: UserHubSessions;
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
		initialEnabledSources: string[],
		initialSettings: FlowtiSettings,
	) {
		super(leaf, eventBus);
		this.userService = userService;
		this.hubRegistry = hubRegistry;
		this.inboxService = inboxService;
		this.sessionService = sessionService;
		this.nudgeService = nudgeService;
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
					sessionTypes: SESSION_TYPES,
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
				if (sessionId) {
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
			},
		});

		this.inbox = new UserHubInbox(this.masterTreeEl, this.detailPanelEl, deps);
		this.sessions = new UserHubSessions(this.masterTreeEl, this.detailPanelEl, deps);
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
					sessionTypes: SESSION_TYPES,
					templates: this.sessionService.getSavedTemplates(),
					prefill: initialFocusFile ? { title: "", type: SESSION_TYPES[0].type, durationMinutes: 25, focusFile: initialFocusFile } : undefined,
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
				if (sessionId) {
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
			},
			exportTemplateAsFile: (templateId: string) => {
				const exported = this.sessionService.exportTemplate(templateId);
				if (!exported) {
					new Notice("Template not found");
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
				new Notice("Template exported");
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
									new Notice(`Template "${tmpl.name}" imported`);
									this.scheduleRender();
								} else {
									new Notice("Import failed: invalid format or duplicate name");
								}
							});
						} catch {
							new Notice("Import failed: invalid JSON");
						}
					};
					reader.readAsText(file);
				});
				input.click();
			},
			getSettings: () => this.state.settings,
		};
	}
}
