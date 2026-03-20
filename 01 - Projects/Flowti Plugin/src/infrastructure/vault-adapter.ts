/**
 * Shared vault adapter interface for reading files from the Obsidian vault.
 *
 * Decoupled from the Obsidian API so handlers can be tested with plain stubs.
 */

export interface VaultFileAdapter {
	list(path: string): Promise<{ files: string[]; folders: string[] }>;
	read(path: string): Promise<string>;
}
