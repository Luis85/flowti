import type { IEventBus } from "../../infrastructure/events/types";
import type { IStorageProvider } from "../../utils/types";
import { PathMutex } from "../../utils/mutex";
import {
	DEFAULT_SETTINGS,
	FlowtiSettings,
	FlowtiSettingsSchema,
} from "./settings";
import type { ISettingsService } from "./types";

/**
 * Configuration options for the SettingsService.
 */
export interface SettingsServiceOptions {
	storage: IStorageProvider;
	eventBus?: IEventBus;
}

/**
 * Service for managing plugin settings.
 * Handles loading, saving, and updating settings with validation.
 * Emits events on settings changes for other components to react.
 *
 * @example Basic usage
 * ```typescript
 * const settingsService = new SettingsService({ storage, eventBus });
 * await settingsService.load();
 *
 * // Update settings
 * await settingsService.updateSettings({ debugMode: true });
 *
 * // Get current settings
 * const settings = settingsService.getSettings();
 * ```
 */
export class SettingsService implements ISettingsService {
	private settings: FlowtiSettings = DEFAULT_SETTINGS;
	private storage: IStorageProvider;
	private eventBus?: IEventBus;
	private unsubscribes: (() => void)[] = [];
	private readonly saveMutex = new PathMutex();

	/**
	 * Creates a new SettingsService instance.
	 * @param options - Configuration options including storage and optional event bus
	 */
	constructor(options: SettingsServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;

		if (this.eventBus) {
			this.unsubscribes.push(
				this.eventBus.on("settings.updateCatalogCategories", (event) => {
					void this.updateSettings({ catalogCategories: event.payload.categories });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateCollapsedCategories", (event) => {
					void this.updateSettings({ collapsedCategories: event.payload.collapsed });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateShowSystemEvents", (event) => {
					void this.updateSettings({ showSystemEvents: event.payload.showSystemEvents });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateCatalogDomains", (event) => {
					void this.updateSettings({ catalogDomains: event.payload.domains });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateCatalogServices", (event) => {
					void this.updateSettings({ catalogServices: event.payload.services });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateInboxEnabledSources", (event) => {
					void this.updateSettings({ inboxEnabledSources: event.payload.sources });
				})
			);
			this.unsubscribes.push(
				this.eventBus.on("settings.updateCustomSessionTypes", (event) => {
					void this.updateSettings({ customSessionTypes: event.payload.types as FlowtiSettings["customSessionTypes"] });
				})
			);
		}
	}

	/**
	 * Gets the current settings.
	 * @returns The current settings object
	 */
	getSettings(): FlowtiSettings {
		return { ...this.settings };
	}

	/**
	 * Loads settings from storage with validation.
	 * Emits "settings.loaded" event if event bus is available.
	 * Falls back to defaults if stored settings are invalid.
	 */
	async load(): Promise<void> {
		let data: unknown;
		try {
			data = await this.storage.load();
		} catch (err) {
			console.error("[Flowti] Failed to load settings:", err);
			data = null;
		}

		const result = FlowtiSettingsSchema.safeParse(data);

		if (result.success) {
			this.settings = result.data;
		} else {
			// Use defaults if validation fails
			this.settings = DEFAULT_SETTINGS;
		}

		// Migration: eventDocsBasePath → docsRootPath
		const raw = data as Record<string, unknown> | null;
		if (raw && typeof raw.eventDocsBasePath === "string" && !raw.docsRootPath) {
			let migrated = raw.eventDocsBasePath.replace(/\/+$/, "");
			if (migrated.endsWith("/Events")) {
				migrated = migrated.slice(0, -"/Events".length);
			}
			this.settings = { ...this.settings, docsRootPath: migrated };
			await this.saveSettings();
		}

		await this.eventBus?.emit("settings.loaded", { settings: this.settings });
	}

	/**
	 * Updates settings and persists them to storage.
	 * Merges updates with current settings and validates the result.
	 * Emits "settings.changed" event after successful update.
	 * @param updates - Partial settings to merge with current settings
	 */
	async updateSettings(updates: Partial<FlowtiSettings>): Promise<void> {
		const newSettings = { ...this.settings, ...updates };
		const result = FlowtiSettingsSchema.safeParse(newSettings);

		if (result.success) {
			this.settings = result.data;
			await this.saveSettings();
			await this.eventBus?.emit("settings.changed", { settings: this.settings });
		}
	}

	/**
	 * Sets the debug mode.
	 * Convenience method for the most common setting change.
	 * @param enabled - Whether debug mode should be enabled
	 */
	async setDebugMode(enabled: boolean): Promise<void> {
		await this.updateSettings({ debugMode: enabled });
	}

	/**
	 * Cleans up event listeners.
	 */
	dispose(): void {
		for (const unsub of this.unsubscribes) {
			unsub();
		}
		this.unsubscribes = [];
	}

	/**
	 * Persists the current settings to storage.
	 * Preserves other data in storage (like user data).
	 */
	private async saveSettings(): Promise<void> {
		await this.saveMutex.withLock("settings", async () => {
			try {
				const existingData = ((await this.storage.load()) as object) || {};
				await this.storage.save({
					...existingData,
					...this.settings,
				});
			} catch (err) {
				console.error("[Flowti] Failed to save settings:", err);
			}
		});
	}
}
