/**
 * AppEventMap — all application events.
 *
 * Add new events here as the application grows.
 * Each domain can define its own EventMap interface and compose via `extends`.
 */
export interface AppEventMap {
	/** Emitted when the plugin has loaded. */
	"app.loaded": Record<string, never>;
	/** Emitted when the plugin is unloading. */
	"app.unloaded": Record<string, never>;
}
