/**
 * User Hub view — the personal cockpit.
 *
 * Extends BaseHubView with an Inbox tab and a dashboard
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
import type { UserHubState, UserHubComponentDeps, InboxItem } from "./userHub/types";

export const VIEW_TYPE_USER_HUB = "flowti-user-hub";

export class UserHubView extends BaseHubView<"inbox"> {
	private userService: IUserService;
	private hubRegistry: HubRegistry;
	private inboxService: InboxService;

	// Components
	private dashboard!: UserHubDashboard;
	private inbox!: UserHubInbox;

	// State
	private state: UserHubState = {
		inboxItems: [],
		selectedInboxItem: null,
	};

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		userService: IUserService,
		hubRegistry: HubRegistry,
		inboxService: InboxService,
	) {
		super(leaf, eventBus);
		this.userService = userService;
		this.hubRegistry = hubRegistry;
		this.inboxService = inboxService;
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

	onTabRender(tabId: "inbox"): void {
		if (tabId === "inbox") {
			this.state.inboxItems = this.inboxService.getItems();
			this.inbox.renderMaster(this.filterText);
			this.inbox.renderDetail();
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
			navigateToTab: (tabId) => this.navigateTo(tabId as "inbox"),
			onInboxItemClick: (item: InboxItem) => {
				this.state.selectedInboxItem = item;
				if (!item.read) {
					void this.inboxService.markRead(item.id);
				}
				this.navigateTo("inbox");
			},
		});

		this.inbox = new UserHubInbox(this.masterTreeEl, this.detailPanelEl, deps);

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
	}

	onHubClose(): void {
		// Cleanup handled by addUnsubscribe for inbox event listeners
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
			scheduleRender: () => this.scheduleRender(),
			navigateToEvent: (eventType) => {
				void this.hubRegistry.openHub("event-catalog", "events", eventType);
			},
		};
	}
}
