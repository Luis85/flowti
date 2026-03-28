import type { ResultValue } from './result.js';

/**
 * Platform-agnostic file system abstraction.
 * Obsidian implementation: ObsidianVaultAdapter
 * Test implementation: MemfsVaultAdapter
 */
export interface VaultAdapter {
	readFile(path: string): Promise<ResultValue<string>>;
	writeFile(path: string, content: string): Promise<ResultValue<void>>;
	deleteFile(path: string): Promise<ResultValue<void>>;
	listFiles(directory: string): Promise<string[]>;
	exists(path: string): Promise<boolean>;
	onFileChange?(callback: (path: string) => void): () => void;
}

/**
 * Platform-agnostic notification service.
 * Obsidian implementation: wraps new Notice()
 * Test implementation: records calls for assertion
 */
export interface NotificationAdapter {
	show(message: string, timeout?: number): void;
	showError(message: string): void;
}

/**
 * Platform-agnostic command registration.
 * Obsidian implementation: wraps plugin.addCommand()
 * Test implementation: records registrations
 */
export interface CommandRegistry {
	register(id: string, name: string, callback: () => void): void;
}

/**
 * Platform-agnostic modal dialogs.
 * Obsidian implementation: wraps new Modal()
 * Test implementation: auto-confirms or returns preset values
 */
export interface ModalAdapter {
	confirm(title: string, message: string): Promise<boolean>;
	prompt(title: string, placeholder: string): Promise<string | null>;
}

/**
 * Aggregated platform services — the full set of platform capabilities.
 * Systems receive ISP subsets of this, not the full interface.
 */
export interface PlatformServices {
	vault: VaultAdapter;
	notifications: NotificationAdapter;
	commands: CommandRegistry;
	modals: ModalAdapter;
}
