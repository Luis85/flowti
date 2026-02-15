/**
 * Dashboard provider for the User Hub.
 *
 * Exposes the current user's name as a summary stat so other hubs
 * can display a User Hub card in their dashboards.
 */

import type { IUserService } from "../user/types";
import { VIEW_TYPE_USER_HUB } from "../../ui/UserHubView";
import type { HubDashboardProvider, HubSummary } from "./types";

export class UserHubProvider implements HubDashboardProvider {
	constructor(private userService: IUserService) {}

	getHubId(): string {
		return "user-hub";
	}

	getViewType(): string {
		return VIEW_TYPE_USER_HUB;
	}

	getDisplayName(): string {
		return "User Hub";
	}

	getIcon(): string {
		return "home";
	}

	getSummary(): HubSummary {
		const user = this.userService.getUser();
		return {
			stats: [
				{ label: "User", value: user?.name ?? "Not set", icon: "user" },
			],
			healthLevel: "healthy",
			actionItemCount: 0,
		};
	}
}
