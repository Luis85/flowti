import { describe, it, expect, vi } from "vitest";
import { UserCreationStep } from "../../../../src/domain/installer/steps/UserCreationStep";
import type {
	InstallerContext,
	InstallerStepDeps,
} from "../../../../src/domain/installer/types";
import type { FlowtiUser } from "../../../../src/domain/user/types";
import type { UUID } from "../../../../src/utils/types";

function createMockDeps(hasUser = false): InstallerStepDeps {
	const existingUser: FlowtiUser = {
		id: "12345678-1234-4123-8123-123456789abc" as UUID,
		name: "Existing User",
		createdAt: "2026-01-01T00:00:00.000Z",
	};

	return {
		fileSystem: {
			fileExists: vi.fn(),
			createFile: vi.fn(),
			readFile: vi.fn(),
			updateFile: vi.fn(),
			deleteFile: vi.fn(),
			moveFile: vi.fn(),
			renameFile: vi.fn(),
			getFrontmatter: vi.fn(),
			updateFrontmatter: vi.fn(),
			setFrontmatter: vi.fn(),
		},
		eventBus: {
			on: vi.fn(() => vi.fn()),
			once: vi.fn(() => vi.fn()),
			emit: vi.fn(),
			clear: vi.fn(),
		} as never,
		userService: {
			load: vi.fn(),
			hasUser: vi.fn(() => hasUser),
			getUser: vi.fn(() => (hasUser ? existingUser : null)),
			createUser: vi.fn(async (name: string) => ({
				id: "new-uuid-1234-4123-8123-123456789abc" as UUID,
				name,
				createdAt: new Date().toISOString(),
			})),
			updateUserName: vi.fn(),
		},
	};
}

describe("UserCreationStep", () => {
	const step = new UserCreationStep();

	it("should have correct metadata", () => {
		expect(step.id).toBe("user-creation");
		expect(step.name).toBe("Create User Profile");
		expect(step.intro).toContain("user profile");
		expect(step.order).toBe(10);
	});

	it("should create a user via userService.createUser", async () => {
		const deps = createMockDeps(false);
		const context: InstallerContext = { userName: "Test User" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.userService.createUser).toHaveBeenCalledWith("Test User");
		expect(context.user).toBeDefined();
		expect(context.user!.name).toBe("Test User");
	});

	it("should skip if user already exists", async () => {
		const deps = createMockDeps(true);
		const context: InstallerContext = { userName: "Test User" };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("skipped");
		expect(result.message).toBe("User already exists");
		expect(deps.userService.createUser).not.toHaveBeenCalled();
		expect(context.user).toBeDefined();
		expect(context.user!.name).toBe("Existing User");
	});

	it("should fail if userName is missing", async () => {
		const deps = createMockDeps(false);
		const context: InstallerContext = {};

		const result = await step.execute(context, deps);

		expect(result.status).toBe("failed");
		expect(result.message).toBe("User name is required");
	});

	it("should fail if userName is empty whitespace", async () => {
		const deps = createMockDeps(false);
		const context: InstallerContext = { userName: "   " };

		const result = await step.execute(context, deps);

		expect(result.status).toBe("failed");
		expect(result.message).toBe("User name is required");
	});
});
