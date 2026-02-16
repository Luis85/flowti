/**
 * User Hub view — the personal cockpit.
 *
 * Extends BaseHubView with Inbox and Preferences tabs, plus a dashboard
 * that aggregates cross-hub summaries via HubRegistry.
 */

import type { WorkspaceLeaf } from "obsidian";
import { setIcon } from "obsidian";
import type { IUserService } from "../domain/user/types";
import type { HubRegistry } from "../domain/hub/HubRegistry";
import type { InboxService } from "../domain/inbox/InboxService";
import type { IEventBus } from "../infrastructure/events/types";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { UserHubDashboard } from "./userHub/UserHubDashboard";
import { UserHubInbox } from "./userHub/UserHubInbox";
import { UserHubPreferences } from "./userHub/UserHubPreferences";
import type { UserHubState, UserHubComponentDeps, InboxItem, UserHubTab } from "./userHub/types";

export const VIEW_TYPE_USER_HUB = "flowti-user-hub";

export class UserHubView extends BaseHubView<UserHubTab> {
	private userService: IUserService;
	private hubRegistry: HubRegistry;
	private inboxService: InboxService;

	// Components
	private dashboard!: UserHubDashboard;
	private inbox!: UserHubInbox;
	private preferences!: UserHubPreferences;

	// State
	private state: UserHubState = {
		inboxItems: [],
		selectedInboxItem: null,
		inboxEnabledSources: [],
	};

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		userService: IUserService,
		hubRegistry: HubRegistry,
		inboxService: InboxService,
		initialEnabledSources: string[],
	) {
		super(leaf, eventBus);
		this.userService = userService;
		this.hubRegistry = hubRegistry;
		this.inboxService = inboxService;
		this.state.inboxEnabledSources = initialEnabledSources;
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

		this.dashboard = new UserHubDashboard(this.dashboardEl, {
			userService: this.userService,
			hubRegistry: this.hubRegistry,
			eventBus: this.eventBus,
			inboxService: this.inboxService,
			navigateToTab: (tabId) => this.navigateTo(tabId as UserHubTab),
			onInboxItemClick: (item: InboxItem) => {
				this.state.selectedInboxItem = item;
				if (!item.read) {
					void this.inboxService.markRead(item.id);
				}
				this.navigateTo("inbox");
			},
		});

		this.inbox = new UserHubInbox(this.masterTreeEl, this.detailPanelEl, deps);
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

		// Sync inbox enabled sources from settings changes
		this.addUnsubscribe(
			this.eventBus.on("settings.changed", (event) => {
				this.state.inboxEnabledSources = event.payload.settings.inboxEnabledSources;
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

	private buildComponentDeps(): UserHubComponentDeps {
		return {
			getState: () => this.state,
			setState: (partial) => {
				Object.assign(this.state, partial);
			},
			eventBus: this.eventBus,
			inboxService: this.inboxService,
			userService: this.userService,
			scheduleRender: () => this.scheduleRender(),
			navigateToEvent: (eventType) => {
				void this.hubRegistry.openHub("event-catalog", "events", eventType);
			},
		};
	}
}
