import { describe, it, expect, beforeEach, vi } from "vitest";
import { UserService } from "../../src/user/UserService";
import type { FlowtiUser } from "../../src/user/types";
import type { IStorageProvider, UUID } from "../../src/utils/types";

/**
 * Creates a mock storage provider for testing.
 */
function createMockStorage(initialData: Record<string, unknown> = {}): {
	storage: IStorageProvider;
	getData: () => Record<string, unknown>;
} {
	let data = { ...initialData };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (newData: unknown) => {
				data = newData as Record<string, unknown>;
			}),
		},
		getData: () => data,
	};
}

describe("UserService", () => {
	let userService: UserService;
	let storage: IStorageProvider;
	let getData: () => Record<string, unknown>;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		userService = new UserService(storage);
	});

	describe("initial state", () => {
		it("should have no user", () => {
			expect(userService.hasUser()).toBe(false);
			expect(userService.getUser()).toBeNull();
		});
	});

	describe("createUser", () => {
		it("should create a user with name, id, and createdAt", async () => {
			const user = await userService.createUser("Test User");

			expect(user.name).toBe("Test User");
			expect(user.id).toBeDefined();
			expect(user.createdAt).toBeDefined();
			expect(userService.hasUser()).toBe(true);
			expect(userService.getUser()).toEqual(user);
		});

		it("should trim whitespace from name", async () => {
			const user = await userService.createUser("  Test User  ");
			expect(user.name).toBe("Test User");
		});

		it("should reject empty name", async () => {
			await expect(userService.createUser("")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should reject whitespace-only name", async () => {
			await expect(userService.createUser("   ")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should persist to storage", async () => {
			await userService.createUser("Test User");

			expect(storage.save).toHaveBeenCalled();
			expect((getData().user as FlowtiUser).name).toBe("Test User");
		});
	});

	describe("updateUserName", () => {
		beforeEach(async () => {
			await userService.createUser("Original Name");
		});

		it("should update and persist the name", async () => {
			await userService.updateUserName("New Name");

			expect(userService.getUser()?.name).toBe("New Name");
			expect((getData().user as FlowtiUser).name).toBe("New Name");
		});

		it("should trim whitespace", async () => {
			await userService.updateUserName("  New Name  ");
			expect(userService.getUser()?.name).toBe("New Name");
		});

		it("should reject empty name", async () => {
			await expect(userService.updateUserName("")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should reject when no user exists", async () => {
			const freshService = new UserService(createMockStorage().storage);
			await expect(freshService.updateUserName("Name")).rejects.toThrow(
				"No user exists to update"
			);
		});
	});

	describe("load", () => {
		it("should load existing user from storage", async () => {
			const existingUser: FlowtiUser = {
				id: "12345678-1234-4123-8123-123456789abc" as UUID,
				name: "Existing User",
				createdAt: "2024-01-01T00:00:00.000Z",
			};
			const mock = createMockStorage({ user: existingUser });
			const service = new UserService(mock.storage);

			await service.load();

			expect(service.hasUser()).toBe(true);
			expect(service.getUser()).toEqual(existingUser);
		});

		it("should handle empty or null storage", async () => {
			await userService.load();
			expect(userService.hasUser()).toBe(false);

			const nullMock = createMockStorage();
			nullMock.storage.load = vi.fn(async () => null);
			const nullService = new UserService(nullMock.storage);
			await nullService.load();
			expect(nullService.hasUser()).toBe(false);
		});
	});
});
