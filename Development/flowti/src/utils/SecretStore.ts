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
}

/**
 * Creates a SecretStore backed by Obsidian's native SecretStorage.
 * Requires Obsidian 1.11.4+.
 */
export function createSecretStore(app: App): ISecretStore {
	const storage = app.secretStorage;

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
	};
}
