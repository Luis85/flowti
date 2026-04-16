import type { Plugin } from 'obsidian';
import type { FileExtensionPort } from '../../domain/shared/file-extension-port.js';
import type { Unsubscribe } from '../../domain/shared/unsubscribe.js';

/**
 * FileExtensionPort backed by Obsidian's plugin.registerExtensions().
 * Obsidian has no deregistration API for extensions — cleanup happens
 * on plugin unload. The returned Unsubscribe is a no-op intentionally.
 */
export class ObsidianFileExtensionAdapter implements FileExtensionPort {
	constructor(private readonly plugin: Plugin) {}

	register(extensions: readonly string[], viewType: string): Unsubscribe {
		this.plugin.registerExtensions(extensions as string[], viewType);
		// No deregistration API in Obsidian — plugin unload handles cleanup.
		return () => {};
	}
}
