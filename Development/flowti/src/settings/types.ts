import type { FlowtiSettings } from "./settings";

/**
 * Interface for the settings service.
 * Provides methods for loading, saving, and updating settings.
 */
export interface ISettingsService {
	/**
	 * Gets the current settings.
	 */
	getSettings(): FlowtiSettings;

	/**
	 * Loads settings from storage.
	 * Should be called during plugin initialization.
	 */
	load(): Promise<void>;

	/**
	 * Updates settings and persists them to storage.
	 * Emits "settings.changed" event after successful update.
	 * @param updates - Partial settings to merge with current settings
	 */
	updateSettings(updates: Partial<FlowtiSettings>): Promise<void>;

	/**
	 * Sets the debug mode.
	 * Convenience method for the most common setting change.
	 * @param enabled - Whether debug mode should be enabled
	 */
	setDebugMode(enabled: boolean): Promise<void>;
}
