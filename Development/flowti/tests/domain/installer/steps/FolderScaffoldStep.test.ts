import { describe, it, expect, vi } from "vitest";
import { FolderScaffoldStep } from "../../../../src/domain/installer/steps/FolderScaffoldStep";
import { DEFAULT_IBDE_FOLDERS } from "../../../../src/domain/installer/folders";
import type {
	InstallerContext,
	InstallerStepDeps,
} from "../../../../src/domain/installer/types";

function createMockDeps(): InstallerStepDeps {
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
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(),
			updateUserName: vi.fn(),
		},
	};
}

describe("FolderScaffoldStep", () => {
	const step = new FolderScaffoldStep();

	it("should have correct metadata", () => {
		expect(step.id).toBe("folder-scaffold");
		expect(step.name).toBe("Create Folder Structure");
		expect(step.intro).toContain("PARA");
		expect(step.order).toBe(20);
	});

	it("should create a file in each folder from DEFAULT_IBDE_FOLDERS", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(DEFAULT_IBDE_FOLDERS.length);

		for (const folder of DEFAULT_IBDE_FOLDERS) {
			expect(deps.fileSystem.createFile).toHaveBeenCalledWith(
				`${folder}/.gitkeep`,
				"",
				{ createFolders: true },
			);
		}
	});

	it("should use createFolders: true option", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		await step.execute(context, deps);

		const calls = vi.mocked(deps.fileSystem.createFile).mock.calls;
		for (const call of calls) {
			expect(call[2]).toEqual({ createFolders: true });
		}
	});

	it("should skip existing files via fileExists check (idempotent)", async () => {
		const deps = createMockDeps();
		let fileExistsCallCount = 0;
		vi.mocked(deps.fileSystem.fileExists).mockImplementation(async () => {
			fileExistsCallCount++;
			// First folder already exists
			return fileExistsCallCount === 1;
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(context.createdFolders).toHaveLength(DEFAULT_IBDE_FOLDERS.length);
		// First folder skipped (exists), rest created
		expect(deps.fileSystem.createFile).toHaveBeenCalledTimes(DEFAULT_IBDE_FOLDERS.length - 1);
	});

	it("should continue when createFile throws (folder already exists)", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.fileSystem.fileExists).mockResolvedValue(false);
		vi.mocked(deps.fileSystem.createFile).mockImplementation(async (path: string) => {
			if (path.includes("00 - Connectivity")) {
				throw new Error("File already exists");
			}
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(context.createdFolders).toHaveLength(DEFAULT_IBDE_FOLDERS.length);
	});

	it("should include all folders in createdFolders even when some throw", async () => {
		const deps = createMockDeps();
		vi.mocked(deps.fileSystem.createFile).mockImplementation(async (path: string) => {
			if (path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(context.createdFolders).toEqual([...DEFAULT_IBDE_FOLDERS]);
	});

	it("should set context.createdFolders with all created folder paths", async () => {
		const deps = createMockDeps();
		const context: InstallerContext = {};

		await step.execute(context, deps);

		expect(context.createdFolders).toEqual([...DEFAULT_IBDE_FOLDERS]);
	});

	it("should count all folders even when multiple createFile calls throw", async () => {
		const deps = createMockDeps();
		let callCount = 0;
		vi.mocked(deps.fileSystem.createFile).mockImplementation(async () => {
			callCount++;
			if (callCount === 3) {
				throw new Error("Disk full");
			}
		});

		const context: InstallerContext = {};
		const result = await step.execute(context, deps);

		expect(result.status).toBe("completed");
		expect(context.createdFolders).toHaveLength(DEFAULT_IBDE_FOLDERS.length);
	});
});
