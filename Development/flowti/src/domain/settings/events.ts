import type { FlowtiSettings, CatalogCategoryConfig } from "./settings";

/**
 * Event types owned by the Settings domain.
 */
export interface SettingsEventMap {
	/** Emitted when settings are changed */
	"settings.changed": { settings: FlowtiSettings };
	/** Emitted when settings are loaded from storage */
	"settings.loaded": { settings: FlowtiSettings };
	/** Command: update catalog category order/visibility */
	"settings.updateCatalogCategories": { categories: CatalogCategoryConfig[] };
	/** Command: update collapsed category state */
	"settings.updateCollapsedCategories": { collapsed: string[] };
}
