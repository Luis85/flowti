import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { InstallerService } from "../../../src/domain/installer/InstallerService";
import { UserCreationStep } from "../../../src/domain/installer/steps/UserCreationStep";
import { FolderScaffoldStep } from "../../../src/domain/installer/steps/FolderScaffoldStep";
import { DEFAULT_IBDE_FOLDERS } from "../../../src/domain/installer/folders";
import type {
	InstallerContext,
	InstallerState,
} from "../../../src/domain/installer/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { UUID } from "../../../src/utils/types";
import type { FlowtiUser } from "../../../src/domain/user/types";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

/**
 * Creates a mock typed storage that persists data in memory.
 */
function createMockStorage(initialState?: InstallerState): {
	storage: ITypedStorage<InstallerState>;
	getData: () => InstallerState | undefined;
} {
	let data: InstallerState | undefined = initialState;
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (state: InstallerState) => {
				data = state;
			}),
			safeLoad: vi.fn(async () => data),
			safeSave: vi.fn(async (state: InstallerState) => {
				data = state;
				return true;
			}),
		},
		getData: () => data,
	};
}

/**
 * Builds a fully wired InstallerService with real steps and mock deps.
 */
function buildInstaller(options: {
	storage: ITypedStorage<InstallerState>;
	eventBus: IEventBus;
	hasUser?: boolean;
	existingUser?: FlowtiUser;
	createFileFn?: ReturnType<typeof vi.fn>;
}) {
	const user: FlowtiUser = options.existingUser ?? {
		id: "u-001" as UUID,
		name: "Alice",
		createdAt: "2026-01-01T00:00:00.000Z",
	};

	const fileSystem: IFileSystemClient = {
		fileExists: vi.fn(),
		createFile: options.createFileFn ?? vi.fn(),
		readFile: vi.fn(),
		updateFile: vi.fn(),
		deleteFile: vi.fn(),
		moveFile: vi.fn(),
		renameFile: vi.fn(),
		getFrontmatter: vi.fn(),
		updateFrontmatter: vi.fn(),
		setFrontmatter: vi.fn(),
	} as IFileSystemClient;

	const userService = {
		load: vi.fn(),
		hasUser: vi.fn(() => options.hasUser ?? false),
		getUser: vi.fn(() => (options.hasUser ? user : null)),
		createUser: vi.fn(async (name: string) => ({ ...user, name })),
		updateUserName: vi.fn(),
	};

	const service = new InstallerService({
		storage: options.storage,
		eventBus: options.eventBus,
		fileSystem,
		userService,
	});

	service.registerStep(new UserCreationStep());
	service.registerStep(new FolderScaffoldStep());

	return { service, fileSystem, userService };
}

// ─────────────────────────────────────────────────────────────
// Journey: First Run
// ─────────────────────────────────────────────────────────────

describe("Journey: First Run", () => {
	let eventBus: IEventBus;
	let mock: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		eventBus = new EventBus();
		mock = createMockStorage();
	});

	it("should detect first run after loading empty storage", async () => {
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});

		await service.load();

		expect(service.isInstalled()).toBe(false);
	});

	it("should create user and scaffold folders on first run", async () => {
		const { service, userService, fileSystem } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();

		const context: InstallerContext = { userName: "Alice" };
		const success = await service.runAll(context);

		expect(success).toBe(true);
		expect(userService.createUser).toHaveBeenCalledWith("Alice");
		expect(context.user).toBeDefined();
		expect(context.user!.name).toBe("Alice");
		expect(fileSystem.createFile).toHaveBeenCalledTimes(DEFAULT_IBDE_FOLDERS.length);
		expect(context.createdFolders).toEqual([...DEFAULT_IBDE_FOLDERS]);
	});

	it("should persist installed state after successful first run", async () => {
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();

		await service.runAll({ userName: "Alice" });

		expect(service.isInstalled()).toBe(true);
		expect(service.getState().installedAt).toBeDefined();
		expect(service.getState().completedSteps["user-creation"]).toBeDefined();
		expect(service.getState().completedSteps["folder-scaffold"]).toBeDefined();

		// Verify persisted to storage
		const saved = mock.getData();
		expect(saved?.installed).toBe(true);
	});

	it("should emit the full event lifecycle during first run", async () => {
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();

		const events: string[] = [];
		eventBus.on("installer.started", () => { events.push("started"); });
		eventBus.on("installer.step.started", () => { events.push("step.started"); });
		eventBus.on("installer.step.completed", () => { events.push("step.completed"); });
		eventBus.on("installer.completed", () => { events.push("completed"); });

		await service.runAll({ userName: "Alice" });

		expect(events).toEqual([
			"started",
			"step.started",   // UserCreationStep
			"step.completed",
			"step.started",   // FolderScaffoldStep
			"step.completed",
			"completed",
		]);
	});

	it("should execute UserCreationStep before FolderScaffoldStep", async () => {
		const callOrder: string[] = [];
		const createFileFn = vi.fn(async () => {
			callOrder.push("folder");
		});

		const { service, userService } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		userService.createUser.mockImplementation(async (name: string) => {
			callOrder.push("user");
			return { id: "u-001" as UUID, name, createdAt: "2026-01-01T00:00:00.000Z" };
		});
		await service.load();

		await service.runAll({ userName: "Alice" });

		expect(callOrder[0]).toBe("user");
		expect(callOrder[1]).toBe("folder");
	});

	it.skip("should open the wizard modal when not installed (requires Obsidian Modal)", () => {
		// InstallerWizardModal.showIfNeeded() calls `new Modal(app)` which
		// depends on Obsidian's runtime. Verified manually:
		// Settings → Flowti → plugin loads → wizard appears on first run.
	});
});

// ─────────────────────────────────────────────────────────────
// Journey: Subsequent Launch (wizard does not appear)
// ─────────────────────────────────────────────────────────────

describe("Journey: Subsequent Launch", () => {
	it("should detect installation is complete after loading persisted state", async () => {
		const eventBus = new EventBus();
		const mock = createMockStorage({
			installed: true,
			installedAt: "2026-01-15T10:00:00.000Z",
			completedSteps: {
				"user-creation": { completedAt: "2026-01-15T10:00:00.000Z" },
				"folder-scaffold": { completedAt: "2026-01-15T10:00:00.000Z" },
			},
		});

		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();

		expect(service.isInstalled()).toBe(true);
	});

	it("should not run any steps when already installed", async () => {
		const eventBus = new EventBus();
		const mock = createMockStorage({
			installed: true,
			installedAt: "2026-01-15T10:00:00.000Z",
			completedSteps: {
				"user-creation": { completedAt: "2026-01-15T10:00:00.000Z" },
				"folder-scaffold": { completedAt: "2026-01-15T10:00:00.000Z" },
			},
		});

		const { service, userService, fileSystem } = buildInstaller({
			storage: mock.storage,
			eventBus,
			hasUser: true,
		});
		await service.load();

		// Simulate what main.ts does: only run if not installed
		if (!service.isInstalled()) {
			await service.runAll({ userName: "Alice" });
		}

		expect(userService.createUser).not.toHaveBeenCalled();
		expect(fileSystem.createFile).not.toHaveBeenCalled();
	});

	it.skip("should not open the wizard modal when already installed (requires Obsidian Modal)", () => {
		// InstallerWizardModal.showIfNeeded() checks isInstalled() and returns
		// early. Verified manually: reload plugin after install → no wizard.
	});
});

// ─────────────────────────────────────────────────────────────
// Journey: Restart from Settings
// ─────────────────────────────────────────────────────────────

describe("Journey: Restart from Settings", () => {
	let eventBus: IEventBus;
	let mock: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		eventBus = new EventBus();
		mock = createMockStorage();
	});

	it("should allow re-running after reset clears installed state", async () => {
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();
		await service.runAll({ userName: "Alice" });
		expect(service.isInstalled()).toBe(true);

		// Settings → "Restart setup" button calls reset()
		await service.reset();

		expect(service.isInstalled()).toBe(false);
		expect(service.getState().completedSteps).toEqual({});
	});

	it("should skip UserCreationStep when user already exists on re-run", async () => {
		const { service, userService } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();
		await service.runAll({ userName: "Alice" });

		// User now exists in the system
		userService.hasUser.mockReturnValue(true);
		userService.getUser.mockReturnValue({
			id: "u-001" as UUID,
			name: "Alice",
			createdAt: "2026-01-01T00:00:00.000Z",
		});
		userService.createUser.mockClear();

		await service.reset();

		const stepEvents: Array<{ id: string; status: string }> = [];
		eventBus.on("installer.step.completed", (e) => {
			stepEvents.push({ id: e.payload.id, status: e.payload.status });
		});

		const success = await service.runAll({ userName: "Alice" });

		expect(success).toBe(true);
		expect(userService.createUser).not.toHaveBeenCalled();
		expect(stepEvents.find((e) => e.id === "user-creation")?.status).toBe("skipped");
	});

	it("should skip existing folders on re-run (FolderScaffoldStep idempotent)", async () => {
		const createFileFn = vi.fn();
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();
		await service.runAll({ userName: "Alice" });

		// All folders now exist — createFile will throw "already exists"
		createFileFn.mockReset();
		createFileFn.mockImplementation(async () => {
			throw new Error("File already exists");
		});

		await service.reset();
		const context: InstallerContext = { userName: "Alice" };
		const success = await service.runAll(context);

		expect(success).toBe(true);
		// All folders still reported as created (idempotent)
		expect(context.createdFolders).toEqual([...DEFAULT_IBDE_FOLDERS]);
	});

	it("should persist the new installed state after successful re-run", async () => {
		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
		});
		await service.load();
		await service.runAll({ userName: "Alice" });

		await service.reset();
		expect(service.isInstalled()).toBe(false);
		expect(service.getState().installedAt).toBeUndefined();

		await service.runAll({ userName: "Alice" });

		expect(service.isInstalled()).toBe(true);
		expect(service.getState().installedAt).toBeDefined();

		// Verify persisted to storage
		const saved = mock.getData();
		expect(saved?.installed).toBe(true);
		expect(saved?.completedSteps["user-creation"]).toBeDefined();
		expect(saved?.completedSteps["folder-scaffold"]).toBeDefined();
	});

	it.skip("should open wizard modal after reset (requires Obsidian Modal)", () => {
		// The settings button calls:
		//   await installerService.reset();
		//   new InstallerWizardModal(app, installerService, eventBus).open();
		// Verified manually: Settings → Restart setup → wizard opens.
	});
});

// ─────────────────────────────────────────────────────────────
// Journey: Failure and Retry
// ─────────────────────────────────────────────────────────────

describe("Journey: Failure and Retry", () => {
	let eventBus: IEventBus;
	let mock: ReturnType<typeof createMockStorage>;

	beforeEach(() => {
		eventBus = new EventBus();
		mock = createMockStorage();
	});

	it("should fail when FolderScaffoldStep hits a permission error", async () => {
		const createFileFn = vi.fn(async (path: string) => {
			if (path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();

		const context: InstallerContext = { userName: "Alice" };
		const success = await service.runAll(context);

		expect(success).toBe(false);
		expect(service.isInstalled()).toBe(false);
	});

	it("should emit installer.failed with the correct step id on failure", async () => {
		const createFileFn = vi.fn(async (path: string) => {
			if (path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();

		const failHandler = vi.fn();
		eventBus.on("installer.failed", failHandler);

		await service.runAll({ userName: "Alice" });

		expect(failHandler).toHaveBeenCalledOnce();
		expect(failHandler).toHaveBeenCalledWith(
			expect.objectContaining({
				payload: expect.objectContaining({
					failedStepId: "folder-scaffold",
				}),
			}),
		);
	});

	it("should report partial createdFolders in context on failure", async () => {
		const createFileFn = vi.fn(async (path: string) => {
			if (path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();

		const context: InstallerContext = { userName: "Alice" };
		await service.runAll(context);

		// Folders before "01 - Projects" were created successfully
		expect(context.createdFolders).toBeDefined();
		expect(context.createdFolders!.length).toBeGreaterThan(0);
		expect(context.createdFolders).not.toContain("01 - Projects");
	});

	it("should succeed on retry after the error is resolved", async () => {
		let shouldFail = true;
		const createFileFn = vi.fn(async (path: string) => {
			if (shouldFail && path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const { service } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();

		// First attempt fails
		const firstResult = await service.runAll({ userName: "Alice" });
		expect(firstResult).toBe(false);

		// Fix the error condition (e.g. permission fixed)
		shouldFail = false;

		// Retry succeeds
		const retryResult = await service.runAll({ userName: "Alice" });
		expect(retryResult).toBe(true);
		expect(service.isInstalled()).toBe(true);
	});

	it("should skip already-completed UserCreationStep on retry", async () => {
		let shouldFail = true;
		const createFileFn = vi.fn(async (path: string) => {
			if (shouldFail && path.includes("01 - Projects")) {
				throw new Error("Permission denied");
			}
		});

		const { service, userService } = buildInstaller({
			storage: mock.storage,
			eventBus,
			createFileFn,
		});
		await service.load();

		// First attempt: user created, then folders fail
		await service.runAll({ userName: "Alice" });
		expect(userService.createUser).toHaveBeenCalledOnce();

		// On retry, user now exists
		userService.hasUser.mockReturnValue(true);
		userService.getUser.mockReturnValue({
			id: "u-001" as UUID,
			name: "Alice",
			createdAt: "2026-01-01T00:00:00.000Z",
		});
		userService.createUser.mockClear();
		shouldFail = false;

		const stepEvents: Array<{ id: string; status: string }> = [];
		eventBus.on("installer.step.completed", (e) => {
			stepEvents.push({ id: e.payload.id, status: e.payload.status });
		});

		const retryResult = await service.runAll({ userName: "Alice" });

		expect(retryResult).toBe(true);
		expect(userService.createUser).not.toHaveBeenCalled();
		expect(stepEvents.find((e) => e.id === "user-creation")?.status).toBe("skipped");
		expect(stepEvents.find((e) => e.id === "folder-scaffold")?.status).toBe("completed");
	});

	it.skip("should show failure page with retry button in the wizard (requires Obsidian Modal)", () => {
		// The wizard renders Page 4 with installSuccess=false and a "Retry"
		// button that calls runInstallation() again.
		// Verified manually: cause a step to fail → error page → click Retry.
	});
});
