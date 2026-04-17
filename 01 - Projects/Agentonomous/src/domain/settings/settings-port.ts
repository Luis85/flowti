import type { Result } from '../shared/result.js';
import type { Unsubscribe } from '../shared/unsubscribe.js';

/**
 * Port for loading/saving plugin settings.
 *
 * The underlying store holds a single keyed blob (each top-level key is one
 * module's settings section).  Two API layers are exposed:
 *
 * - `loadSection` / `saveSection` — the section-scoped API.  Use this from
 *   UI code and settings tabs: a save of one section never touches any other
 *   section, and no load-merge-save boilerplate is required.
 * - `load` / `save` — the whole-blob API.  `save` REPLACES the entire blob;
 *   callers must merge themselves.  Intended for boot-time migration and
 *   infrastructure code that needs the full picture.
 */
export interface SettingsPort {
	load(): Promise<Result<unknown, string>>;
	save(settings: unknown): Promise<Result<void, string>>;
	loadSection(key: string): Promise<Result<unknown, string>>;
	saveSection(key: string, value: unknown): Promise<Result<void, string>>;
	subscribe(listener: (settings: unknown) => void | Promise<void>): Unsubscribe;
}
