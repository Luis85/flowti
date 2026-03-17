/**
 * Event types owned by the Hub domain.
 */
export interface HubEventMap {
	/** Emitted when a hub view is opened */
	"hub.opened": { hubId: string; hubType: "system" | "domain" | "user" };
	/** Emitted when a hub view is closed */
	"hub.closed": { hubId: string };
	/** Emitted when the active tab changes within a hub */
	"hub.tab.changed": { hubId: string; tabId: string; previousTabId: string };
	/** Command to navigate to a specific hub tab/entity (cross-hub navigation) */
	"hub.navigate": { hubId: string; tabId?: string; entityId?: string };
}
