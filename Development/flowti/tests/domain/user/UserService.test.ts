import { describe, it, expect, beforeEach, vi } from "vitest";
import { ValidationError } from "../../../src/infrastructure/errors/FlowtiError";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { UserService } from "../../../src/domain/user/UserService";
import type { FlowtiUser } from "../../../src/domain/user/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { UUID } from "../../../src/utils/types";
import { createMockStorage } from "../../mocks/storage";

describe("UserService", () => {
	let userService: UserService;
	let storage: ITypedStorage<FlowtiUser>;
	let eventBus: IEventBus;
	let getData: () => FlowtiUser | undefined;

	beforeEach(() => {
		const mock = createMockStorage<FlowtiUser>();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		userService = new UserService({ storage, eventBus });
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

		it("should reject empty name with ValidationError", async () => {
			await expect(userService.createUser("")).rejects.toThrow(ValidationError);
			await expect(userService.createUser("")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should reject whitespace-only name with ValidationError", async () => {
			await expect(userService.createUser("   ")).rejects.toThrow(ValidationError);
			await expect(userService.createUser("   ")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should persist to storage", async () => {
			await userService.createUser("Test User");

			expect(storage.save).toHaveBeenCalled();
			expect(getData()?.name).toBe("Test User");
		});
	});

	describe("updateUserName", () => {
		beforeEach(async () => {
			await userService.createUser("Original Name");
		});

		it("should update and persist the name", async () => {
			await userService.updateUserName("New Name");

			expect(userService.getUser()?.name).toBe("New Name");
			expect(getData()?.name).toBe("New Name");
		});

		it("should trim whitespace", async () => {
			await userService.updateUserName("  New Name  ");
			expect(userService.getUser()?.name).toBe("New Name");
		});

		it("should reject empty name with ValidationError", async () => {
			await expect(userService.updateUserName("")).rejects.toThrow(ValidationError);
			await expect(userService.updateUserName("")).rejects.toThrow(
				"User name cannot be empty"
			);
		});

		it("should reject when no user exists with ValidationError", async () => {
			const freshService = new UserService({ storage: createMockStorage<FlowtiUser>().storage });
			await expect(freshService.updateUserName("Name")).rejects.toThrow(ValidationError);
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
			const mock = createMockStorage<FlowtiUser>(existingUser);
			const service = new UserService({ storage: mock.storage });

			await service.load();

			expect(service.hasUser()).toBe(true);
			expect(service.getUser()).toEqual(existingUser);
		});

		it("should handle empty or null storage", async () => {
			await userService.load();
			expect(userService.hasUser()).toBe(false);

			const nullMock = createMockStorage<FlowtiUser>();
			nullMock.storage.load = vi.fn(async () => undefined);
			const nullService = new UserService({ storage: nullMock.storage });
			await nullService.load();
			expect(nullService.hasUser()).toBe(false);
		});
	});

	describe("event emission", () => {
		it("should emit user.created event when creating user", async () => {
			const handler = vi.fn();
			eventBus.on("user.created", handler);

			const user = await userService.createUser("Test User");

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "user.created",
					payload: { user },
				})
			);
		});

		it("should emit user.updated event when updating user name", async () => {
			await userService.createUser("Test User");
			const handler = vi.fn();
			eventBus.on("user.updated", handler);

			await userService.updateUserName("New Name");

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "user.updated",
					payload: { user: expect.objectContaining({ name: "New Name" }) },
				})
			);
		});

		it("should emit user.loaded event when loading existing user", async () => {
			const existingUser: FlowtiUser = {
				id: "12345678-1234-4123-8123-123456789abc" as UUID,
				name: "Existing User",
				createdAt: "2024-01-01T00:00:00.000Z",
			};
			const mock = createMockStorage<FlowtiUser>(existingUser);
			const service = new UserService({ storage: mock.storage, eventBus });

			const handler = vi.fn();
			eventBus.on("user.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "user.loaded",
					payload: { user: existingUser },
				})
			);
		});

		it("should not emit user.loaded event when no user in storage", async () => {
			const handler = vi.fn();
			eventBus.on("user.loaded", handler);

			await userService.load();

			expect(handler).not.toHaveBeenCalled();
		});

		it("should work without eventBus (optional dependency)", async () => {
			const serviceWithoutEvents = new UserService({ storage: createMockStorage<FlowtiUser>().storage });

			// Should not throw
			await serviceWithoutEvents.createUser("Test");
			await serviceWithoutEvents.updateUserName("Updated");

			expect(serviceWithoutEvents.getUser()?.name).toBe("Updated");
		});
	});

	describe("role", () => {
		it("should create a user with role when provided", async () => {
			const user = await userService.createUser("Test User", "supplier-manager");
			expect(user.role).toBe("supplier-manager");
			expect(user.name).toBe("Test User");
		});

		it("should create a user without role when not provided", async () => {
			const user = await userService.createUser("Test User");
			expect(user.role).toBeUndefined();
		});

		it("should persist user role to storage", async () => {
			await userService.createUser("Test User", "user");
			const saved = getData();
			expect(saved?.role).toBe("user");
		});

		it("should load existing user with role from storage", async () => {
			const existingUser: FlowtiUser = {
				id: "12345678-1234-4123-8123-123456789abc" as UUID,
				name: "Existing User",
				createdAt: "2024-01-01T00:00:00.000Z",
				role: "supplier-manager",
			};
			const mock = createMockStorage<FlowtiUser>(existingUser);
			const service = new UserService({ storage: mock.storage });
			await service.load();

			expect(service.getUser()?.role).toBe("supplier-manager");
		});

		it("should load existing user without role (backwards compatible)", async () => {
			const existingUser: FlowtiUser = {
				id: "12345678-1234-4123-8123-123456789abc" as UUID,
				name: "Existing User",
				createdAt: "2024-01-01T00:00:00.000Z",
			};
			const mock = createMockStorage<FlowtiUser>(existingUser);
			const service = new UserService({ storage: mock.storage });
			await service.load();

			expect(service.getUser()?.role).toBeUndefined();
		});
	});

	describe("persistence", () => {
		it("should persist user via typed storage", async () => {
			const mock = createMockStorage<FlowtiUser>();
			const service = new UserService({ storage: mock.storage, eventBus });

			await service.createUser("Test User");

			const saved = mock.getData();
			expect(saved).toBeDefined();
			expect(saved?.name).toBe("Test User");
		});

		it("should persist updated user name", async () => {
			const existingUser: FlowtiUser = {
				id: "12345678-1234-4123-8123-123456789abc" as UUID,
				name: "Original",
				createdAt: "2024-01-01T00:00:00.000Z",
			};
			const mock = createMockStorage<FlowtiUser>(existingUser);
			const service = new UserService({ storage: mock.storage, eventBus });
			await service.load();

			await service.updateUserName("Updated Name");

			const saved = mock.getData();
			expect(saved?.name).toBe("Updated Name");
			expect(saved?.id).toBe(existingUser.id);
		});
	});
});
