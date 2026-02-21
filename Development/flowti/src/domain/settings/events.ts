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
	/** Command: toggle system events visibility */
	"settings.updateShowSystemEvents": { showSystemEvents: boolean };
	/** Command: update domain visibility in catalog */
	"settings.updateCatalogDomains": { domains: CatalogCategoryConfig[] };
	/** Command: update service visibility in catalog */
	"settings.updateCatalogServices": { services: CatalogCategoryConfig[] };
	/** Command: update inbox enabled source events */
	"settings.updateInboxEnabledSources": { sources: string[] };
	/** Command: update custom session type configurations */
	"settings.updateCustomSessionTypes": { types: Record<string, unknown> };
	/** Command: update custom output templates for sessions */
	"settings.updateCustomOutputTemplates": { templates: unknown[] };
	/** Command: update session activity filter folders */
	"settings.updateSessionActivityFilter": { filter: string[] };
	/** Command: update inbox watched folder configuration */
	"settings.updateInboxWatchedFolders": { folders: Array<{ path: string; recursive: boolean; isPrimary: boolean }> };
	/** Command: update inbox triage target folder path */
	"settings.updateInboxTriageTargetFolder": { folder: string };
	/** Command: update default train duration preference */
	"settings.updateDefaultTrainDuration": { value: number };
	/** Command: update train folder path */
	"settings.updateTrainFolder": { folder: string };
	/** Command: update train auto-open timeline preference */
	"settings.updateTrainAutoOpenTimeline": { enabled: boolean };
	/** Command: update maximum thoughts per train */
	"settings.updateTrainMaxThoughts": { max: number };
}
