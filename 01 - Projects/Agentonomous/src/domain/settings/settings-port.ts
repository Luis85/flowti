import type { Result } from '../shared/result.js';
import type { Unsubscribe } from '../shared/unsubscribe.js';

export interface SettingsPort {
	load(): Promise<Result<unknown, string>>;
	save(settings: unknown): Promise<Result<void, string>>;
	subscribe(listener: (settings: unknown) => void | Promise<void>): Unsubscribe;
}
