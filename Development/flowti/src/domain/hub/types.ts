/**
 * Types for the Hub domain.
 *
 * HubDashboardProvider allows each hub to expose summary data
 * for cross-hub dashboards (e.g. User Hub) without requiring
 * the hub view to be open.
 */

/**
 * A single stat for display in a hub summary card.
 */
export interface HubStat {
	label: string;
	value: string;
	icon: string;
}

/**
 * Summary data exposed by each hub for cross-hub consumption.
 */
export interface HubSummary {
	/** Key stats (e.g. "42 events", "3 imports") */
	stats: HubStat[];
	/** Quick health indicator */
	healthLevel: "healthy" | "warning" | "error";
	/** Number of items needing attention (0 = all clear) */
	actionItemCount: number;
}

/**
 * Interface that each hub implements to provide dashboard data.
 * Providers are standalone objects (not views) so they work
 * even when the hub view isn't open.
 */
export interface HubDashboardProvider {
	/** Unique hub identifier (e.g. "event-catalog", "data-exchange") */
	getHubId(): string;
	/** Obsidian view type string for revealing the hub leaf */
	getViewType(): string;
	/** Display name shown in cross-hub dashboards */
	getDisplayName(): string;
	/** Lucide icon identifier */
	getIcon(): string;
	/** Compute current summary data */
	getSummary(): HubSummary;
}
