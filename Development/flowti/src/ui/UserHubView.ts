/**
 * User Hub view — the personal cockpit.
 *
 * Extends BaseHubView with 2 tabs (Inbox, Activity) and a dashboard
 * that aggregates cross-hub summaries via HubRegistry.
 */

import type { WorkspaceLeaf } from "obsidian";
import { setIcon } from "obsidian";
import type { IUserService } from "../domain/user/types";
import type { HubRegistry } from "../domain/hub/HubRegistry";
import type { IEventBus } from "../infrastructure/events/types";
import { BaseHubView, type TabDef } from "./BaseHubView";
import { UserHubDashboard } from "./userHub/UserHubDashboard";
import { UserHubInbox } from "./userHub/UserHubInbox";
import { UserHubActivity } from "./userHub/UserHubActivity";
import type { UserTab, UserHubState, UserHubComponentDeps } from "./userHub/types";

export const VIEW_TYPE_USER_HUB = "flowti-user-hub";

export class UserHubView extends BaseHubView<UserTab> {
	private userService: IUserService;
	private hubRegistry: HubRegistry;

	// Components
	private dashboard!: UserHubDashboard;
	private inbox!: UserHubInbox;
	private activity!: UserHubActivity;

	// State
	private state: UserHubState = {
		inboxItems: [],
		activityLog: [],
		selectedInboxItem: null,
		selectedActivity: null,
	};

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		userService: IUserService,
		hubRegistry: HubRegistry,
	) {
		super(leaf, eventBus);
		this.userService = userService;
		this.hubRegistry = hubRegistry;
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
			{ id: "activity", label: "Activity", icon: "activity", searchPlaceholder: "Search activity..." },
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

	onTabRender(tabId: UserTab): void {
		switch (tabId) {
			case "inbox":
				this.inbox.renderMaster(this.filterText);
				this.inbox.renderDetail();
				break;
			case "activity":
				this.activity.renderMaster(this.filterText);
				this.activity.renderDetail();
				break;
		}
	}

	onHubOpen(): void {
		const deps = this.buildComponentDeps();

		this.dashboard = new UserHubDashboard(this.dashboardEl, {
			userService: this.userService,
			hubRegistry: this.hubRegistry,
			eventBus: this.eventBus,
		});

		this.inbox = new UserHubInbox(this.masterTreeEl, this.detailPanelEl, deps);
		this.activity = new UserHubActivity(this.masterTreeEl, this.detailPanelEl, deps);

		// Start activity capture (wildcard listener)
		this.addUnsubscribe(this.activity.startCapture());
	}

	onHubClose(): void {
		// Component cleanup handled by addUnsubscribe for activity capture
	}

	// ── Private ─────────────────────────────────────────────

	private buildComponentDeps(): UserHubComponentDeps {
		return {
			getState: () => this.state,
			setState: (partial) => {
				Object.assign(this.state, partial);
			},
			eventBus: this.eventBus,
			hubRegistry: this.hubRegistry,
			scheduleRender: () => this.scheduleRender(),
		};
	}
}
