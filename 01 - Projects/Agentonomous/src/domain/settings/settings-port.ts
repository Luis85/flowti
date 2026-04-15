import type { Result } from '../shared/result.js';
import type { Unsubscribe } from '../shared/unsubscribe.js';
import type { PluginSettings } from './plugin-settings.js';

export interface SettingsPort {
	load(): Promise<Result<PluginSettings, string>>;
	save(settings: PluginSettings): Promise<Result<void, string>>;
	subscribe(listener: (settings: PluginSettings) => void): Unsubscribe;
}
