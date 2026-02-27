import { describe, it, expect, beforeEach } from "vitest";
import type { ISecretStore } from "../../src/utils/SecretStore";

/** Creates a mock in-memory SecretStore for testing. */
export function createMockSecretStore(): ISecretStore {
	const store = new Map<string, string>();
	return {
		setSecret(id: string, value: string): void {
			store.set(id, value);
		},
		getSecret(id: string): string | null {
			return store.get(id) ?? null;
		},
		deleteSecret(id: string): void {
			store.delete(id);
		},
	};
}

describe("SecretStore (mock)", () => {
	let secretStore: ISecretStore;

	beforeEach(() => {
		secretStore = createMockSecretStore();
	});

	it("should store and retrieve a secret", () => {
		secretStore.setSecret("my-key", "my-secret-value");
		expect(secretStore.getSecret("my-key")).toBe("my-secret-value");
	});

	it("should return null for unknown keys", () => {
		expect(secretStore.getSecret("nonexistent")).toBeNull();
	});

	it("should delete a secret", () => {
		secretStore.setSecret("my-key", "value");
		secretStore.deleteSecret("my-key");
		expect(secretStore.getSecret("my-key")).toBeNull();
	});

	it("should overwrite existing secrets", () => {
		secretStore.setSecret("my-key", "old-value");
		secretStore.setSecret("my-key", "new-value");
		expect(secretStore.getSecret("my-key")).toBe("new-value");
	});

	it("should handle special characters in values", () => {
		const special = 'p@$$w0rd!#%"with-special';
		secretStore.setSecret("key", special);
		expect(secretStore.getSecret("key")).toBe(special);
	});

	it("should handle unicode values", () => {
		const unicode = "tökèn-wíth-ünïcödé";
		secretStore.setSecret("key", unicode);
		expect(secretStore.getSecret("key")).toBe(unicode);
	});
});
