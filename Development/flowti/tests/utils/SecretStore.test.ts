import { describe, it, expect, beforeEach } from "vitest";
import type { ISecretStore } from "../../src/utils/SecretStore";

/** Creates a mock in-memory SecretStore for testing. */
export function createMockSecretStore(available = true): ISecretStore {
	const store = new Map<string, string>();
	return {
		setSecret(id: string, value: string): void {
			if (available) store.set(id, value);
		},
		getSecret(id: string): string | null {
			if (!available) return null;
			return store.get(id) ?? null;
		},
		deleteSecret(id: string): void {
			store.delete(id);
		},
		isAvailable(): boolean {
			return available;
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

	it("should report availability", () => {
		expect(secretStore.isAvailable()).toBe(true);
	});

	describe("when unavailable", () => {
		beforeEach(() => {
			secretStore = createMockSecretStore(false);
		});

		it("should return null on getSecret", () => {
			secretStore.setSecret("key", "value");
			expect(secretStore.getSecret("key")).toBeNull();
		});

		it("should report unavailable", () => {
			expect(secretStore.isAvailable()).toBe(false);
		});
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
