import { describe, it, expect, beforeEach, vi } from "vitest";
import { ValidationError } from "../../../src/infrastructure/errors/FlowtiError";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { InstallerService } from "../../../src/domain/installer/InstallerService";
import type {
	IInstallerStep,
	InstallerContext,
	InstallerStepDeps,
	InstallerStepResult,
} from "../../../src/domain/installer/types";
import type { IStorageProvider } from "../../../src/utils/types";

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

/**
 * Creates a mock installer step for testing.
 */
function createMockStep(
	id: string,
	order: number,
	result: InstallerStepResult = { status: "completed" },
): IInstallerStep {
	return {
		id,
		name: `Step ${id}`,
		description: `Description for ${id}`,
		intro: `Intro for ${id}`,
		order,
		execute: vi.fn(async () => result),
	};
}

/**
 * Creates mock step dependencies for testing.
 */
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
		eventBus: new EventBus(),
		userService: {
			load: vi.fn(),
			hasUser: vi.fn(() => false),
			getUser: vi.fn(() => null),
			createUser: vi.fn(),
			updateUserName: vi.fn(),
		},
	};
}

describe("InstallerService", () => {
	let service: InstallerService;
	let storage: IStorageProvider;
	let eventBus: IEventBus;
	let getData: () => Record<string, unknown>;
	let mockDeps: InstallerStepDeps;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		mockDeps = createMockDeps();
		service = new InstallerService({
			storage,
			eventBus,
			fileSystem: mockDeps.fileSystem,
			userService: mockDeps.userService,
		});
	});

	describe("initial state", () => {
		it("should not be installed by default", () => {
			expect(service.isInstalled()).toBe(false);
		});

		it("should have empty completed steps", () => {
			expect(service.getState().completedSteps).toEqual({});
		});

		it("should have no steps registered", () => {
			expect(service.getSteps()).toEqual([]);
		});
	});

	describe("load", () => {
		it("should load installer state from storage", async () => {
			const mock = createMockStorage({
				installer: {
					installed: true,
					installedAt: "2026-01-01T00:00:00.000Z",
					completedSteps: {
						"step-a": { completedAt: "2026-01-01T00:00:00.000Z" },
					},
				},
			});
			const svc = new InstallerService({ storage: mock.storage, eventBus });

			await svc.load();

			expect(svc.isInstalled()).toBe(true);
			expect(svc.getState().installedAt).toBe("2026-01-01T00:00:00.000Z");
			expect(svc.getState().completedSteps["step-a"]).toBeDefined();
		});

		it("should handle empty storage gracefully", async () => {
			await service.load();

			expect(service.isInstalled()).toBe(false);
			expect(service.getState().completedSteps).toEqual({});
		});

		it("should handle null storage gracefully", async () => {
			const mock = createMockStorage();
			mock.storage.load = vi.fn(async () => null);
			const svc = new InstallerService({ storage: mock.storage, eventBus });

			await svc.load();

			expect(svc.isInstalled()).toBe(false);
		});

		it("should emit installer.loaded event", async () => {
			const handler = vi.fn();
			eventBus.on("installer.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.loaded",
					payload: { state: service.getState() },
				}),
			);
		});
	});

	describe("registerStep", () => {
		it("should register a step", () => {
			const step = createMockStep("test-step", 10);
			service.registerStep(step);

			expect(service.getSteps()).toHaveLength(1);
			expect(service.getSteps()[0].id).toBe("test-step");
		});

		it("should reject duplicate step ids", () => {
			service.registerStep(createMockStep("test-step", 10));

			expect(() => service.registerStep(createMockStep("test-step", 20))).toThrow(
				ValidationError,
			);
			expect(() => service.registerStep(createMockStep("test-step", 20))).toThrow(
				'Installer step "test-step" is already registered',
			);
		});

		it("should return steps sorted by order", () => {
			service.registerStep(createMockStep("third", 30));
			service.registerStep(createMockStep("first", 10));
			service.registerStep(createMockStep("second", 20));

			const steps = service.getSteps();
			expect(steps[0].id).toBe("first");
			expect(steps[1].id).toBe("second");
			expect(steps[2].id).toBe("third");
		});
	});

	describe("runAll", () => {
		it("should execute all steps in order", async () => {
			const callOrder: string[] = [];
			const stepA: IInstallerStep = {
				id: "a",
				name: "Step A",
				description: "A",
				intro: "Intro A",
				order: 10,
				execute: vi.fn(async (): Promise<InstallerStepResult> => {
					callOrder.push("a");
					return { status: "completed" };
				}),
			};
			const stepB: IInstallerStep = {
				id: "b",
				name: "Step B",
				description: "B",
				intro: "Intro B",
				order: 20,
				execute: vi.fn(async (): Promise<InstallerStepResult> => {
					callOrder.push("b");
					return { status: "completed" };
				}),
			};

			service.registerStep(stepB);
			service.registerStep(stepA);

			const result = await service.runAll({});

			expect(result).toBe(true);
			expect(callOrder).toEqual(["a", "b"]);
		});

		it("should emit installer.started before execution", async () => {
			service.registerStep(createMockStep("step-1", 10));
			service.registerStep(createMockStep("step-2", 20));

			const handler = vi.fn();
			eventBus.on("installer.started", handler);

			await service.runAll({});

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.started",
					payload: { stepCount: 2 },
				}),
			);
		});

		it("should emit installer.step.started for each step", async () => {
			service.registerStep(createMockStep("step-1", 10));

			const handler = vi.fn();
			eventBus.on("installer.step.started", handler);

			await service.runAll({});

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.step.started",
					payload: { stepId: "step-1", stepName: "Step step-1" },
				}),
			);
		});

		it("should emit installer.step.completed for each step", async () => {
			service.registerStep(createMockStep("step-1", 10));

			const handler = vi.fn();
			eventBus.on("installer.step.completed", handler);

			await service.runAll({});

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.step.completed",
					payload: expect.objectContaining({
						id: "step-1",
						status: "completed",
					}),
				}),
			);
		});

		it("should emit installer.completed on success", async () => {
			service.registerStep(createMockStep("step-1", 10));

			const handler = vi.fn();
			eventBus.on("installer.completed", handler);

			await service.runAll({});

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.completed",
					payload: {
						state: expect.objectContaining({ installed: true }),
					},
				}),
			);
		});

		it("should halt and emit installer.failed if a step fails", async () => {
			const step1 = createMockStep("step-1", 10, {
				status: "failed",
				message: "Something went wrong",
			});
			const step2 = createMockStep("step-2", 20);

			service.registerStep(step1);
			service.registerStep(step2);

			const failHandler = vi.fn();
			eventBus.on("installer.failed", failHandler);

			const result = await service.runAll({});

			expect(result).toBe(false);
			expect(step2.execute).not.toHaveBeenCalled();
			expect(failHandler).toHaveBeenCalledOnce();
			expect(failHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "installer.failed",
					payload: {
						failedStepId: "step-1",
						error: "Something went wrong",
					},
				}),
			);
		});

		it("should handle skipped steps without failing", async () => {
			service.registerStep(
				createMockStep("skipped", 10, { status: "skipped", message: "Already done" }),
			);
			service.registerStep(createMockStep("normal", 20));

			const result = await service.runAll({});

			expect(result).toBe(true);
			expect(service.getState().completedSteps["skipped"]).toBeDefined();
			expect(service.getState().completedSteps["normal"]).toBeDefined();
		});

		it("should persist state after successful completion", async () => {
			service.registerStep(createMockStep("step-1", 10));

			await service.runAll({});

			expect(storage.save).toHaveBeenCalled();
			const savedData = getData();
			expect(savedData.installer).toBeDefined();

			const installerState = savedData.installer as Record<string, unknown>;
			expect(installerState.installed).toBe(true);
			expect(installerState.installedAt).toBeDefined();
		});

		it("should set installed=true and installedAt after success", async () => {
			service.registerStep(createMockStep("step-1", 10));

			await service.runAll({});

			expect(service.isInstalled()).toBe(true);
			expect(service.getState().installedAt).toBeDefined();
		});

		it("should pass context through steps (data accumulation)", async () => {
			const step1: IInstallerStep = {
				id: "step-1",
				name: "Step 1",
				description: "First",
				intro: "Intro 1",
				order: 10,
				execute: vi.fn(async (ctx: InstallerContext) => {
					ctx.userName = "Test";
					return { status: "completed" as const };
				}),
			};
			const step2: IInstallerStep = {
				id: "step-2",
				name: "Step 2",
				description: "Second",
				intro: "Intro 2",
				order: 20,
				execute: vi.fn(async (ctx: InstallerContext) => {
					expect(ctx.userName).toBe("Test");
					return { status: "completed" as const };
				}),
			};

			service.registerStep(step1);
			service.registerStep(step2);

			const context: InstallerContext = {};
			await service.runAll(context);

			expect(context.userName).toBe("Test");
		});

		it("should work without eventBus (optional dependency)", async () => {
			const svc = new InstallerService({
				storage,
				fileSystem: mockDeps.fileSystem,
				userService: mockDeps.userService,
			});
			svc.registerStep(createMockStep("step-1", 10));

			const result = await svc.runAll({});

			expect(result).toBe(true);
			expect(svc.isInstalled()).toBe(true);
		});

		it("should not persist state on failure", async () => {
			service.registerStep(createMockStep("fail", 10, { status: "failed" }));

			await service.runAll({});

			expect(service.isInstalled()).toBe(false);
			// save should not have been called (only called on success)
			expect(storage.save).not.toHaveBeenCalled();
		});
	});

	describe("reset", () => {
		it("should reset isInstalled to false and clear completedSteps", async () => {
			service.registerStep(createMockStep("step-1", 10));
			await service.runAll({});
			expect(service.isInstalled()).toBe(true);

			await service.reset();

			expect(service.isInstalled()).toBe(false);
			expect(service.getState().completedSteps).toEqual({});
			expect(service.getState().installedAt).toBeUndefined();
		});

		it("should persist the reset to storage", async () => {
			service.registerStep(createMockStep("step-1", 10));
			await service.runAll({});
			vi.mocked(storage.save).mockClear();

			await service.reset();

			expect(storage.save).toHaveBeenCalledOnce();
			const savedData = getData();
			const installerState = savedData.installer as Record<string, unknown>;
			expect(installerState.installed).toBe(false);
		});

		it("should allow runAll to succeed again after reset", async () => {
			service.registerStep(createMockStep("step-1", 10));
			await service.runAll({});
			expect(service.isInstalled()).toBe(true);

			await service.reset();
			const result = await service.runAll({});

			expect(result).toBe(true);
			expect(service.isInstalled()).toBe(true);
		});
	});

	describe("shared storage", () => {
		it("should preserve other data when saving installer state", async () => {
			const mock = createMockStorage({ debugMode: true, user: { name: "Test" } });
			const svc = new InstallerService({
				storage: mock.storage,
				eventBus,
				fileSystem: mockDeps.fileSystem,
				userService: mockDeps.userService,
			});
			svc.registerStep(createMockStep("step-1", 10));

			await svc.runAll({});

			const savedData = mock.getData();
			expect(savedData.debugMode).toBe(true);
			expect(savedData.user).toEqual({ name: "Test" });
			expect(savedData.installer).toBeDefined();
		});
	});
});
