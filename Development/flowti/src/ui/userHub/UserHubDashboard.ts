/**
 * Dashboard component for the User Hub.
 *
 * Renders a welcome section, cross-hub summary cards (from HubRegistry),
 * and quick-action buttons for navigating to other hubs.
 */

import { setIcon } from "obsidian";
import type { IUserService } from "../../domain/user/types";
import type { HubRegistry } from "../../domain/hub/HubRegistry";
import type { IEventBus } from "../../infrastructure/events/types";
import { renderStatGrid, type StatCardItem } from "../shared/StatCard";

export interface UserHubDashboardDeps {
	userService: IUserService;
	hubRegistry: HubRegistry;
	eventBus: IEventBus;
}

export class UserHubDashboard {
	constructor(
		private container: HTMLElement,
		private deps: UserHubDashboardDeps,
	) {}

	render(): void {
		this.container.empty();

		this.renderWelcome();
		this.renderHubSummaries();
		this.renderQuickActions();
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

	private renderHubSummaries(): void {
		const providers = this.deps.hubRegistry
			.getAll()
			.filter((p) => p.getHubId() !== "user-hub");

		if (providers.length === 0) return;

		const section = this.container.createDiv();
		section.style.marginBottom = "1.5rem";
		section.createEl("h3", { text: "Your Hubs", cls: "ft-heading ft-heading-sm" });

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
		section.createEl("h3", { text: "Quick Actions", cls: "ft-heading ft-heading-sm" });
		section.style.marginBottom = "0.75rem";

		const grid = section.createDiv({ cls: "ft-flex ft-gap-2" });
		grid.style.flexWrap = "wrap";

		const eb = this.deps.eventBus;
		const actions: Array<{ icon: string; label: string; action: () => void }> = [
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
