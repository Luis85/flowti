import type { Unsubscribe } from './unsubscribe.js';

export interface FileExtensionPort {
	register(extensions: readonly string[], viewType: string): Unsubscribe;
}
