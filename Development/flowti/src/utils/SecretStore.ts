/**
 * SecretStore — wraps Obsidian's SecretStorage API (since 1.11.4)
 * for storing sensitive values (PATs, tokens, API keys) outside of data.json.
 *
 * Obsidian handles encryption and platform-specific secure storage internally.
 * This thin wrapper provides a testable interface for dependency injection.
 */

import type { App } from "obsidian";

/** Interface for dependency injection and testing. */
export interface ISecretStore {
	setSecret(id: string, value: string): void;
	getSecret(id: string): string | null;
	deleteSecret(id: string): void;
	isAvailable(): boolean;
}

/**
 * Creates a SecretStore backed by Obsidian's native SecretStorage.
 * Returns a no-op store if SecretStorage is unavailable (older Obsidian versions).
 */
export function createSecretStore(app: App): ISecretStore {
	const storage = app.secretStorage;
	if (!storage || typeof storage.setSecret !== "function") {
		return createNoopSecretStore();
	}

	return {
		setSecret(id: string, value: string): void {
			storage.setSecret(id, value);
		},
		getSecret(id: string): string | null {
			return storage.getSecret(id);
		},
		deleteSecret(id: string): void {
			// Remove by setting empty — Obsidian SecretStorage doesn't expose a delete API
			storage.setSecret(id, "");
		},
		isAvailable(): boolean {
			return true;
		},
	};
}

/** No-op store for environments without SecretStorage (tests, older Obsidian). */
function createNoopSecretStore(): ISecretStore {
	return {
		setSecret(): void { /* no-op */ },
		getSecret(): string | null { return null; },
		deleteSecret(): void { /* no-op */ },
		isAvailable(): boolean { return false; },
	};
}
