// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JourneyExecutorService } from "../../../src/domain/journeyExecutor/JourneyExecutorService";
import type { ToolHost, ExecutableJourney, ExecutableStep, ExecutionOptions } from "../../../src/domain/journeyExecutor/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { TestManagementService } from "../../../src/domain/testManagement/TestManagementService";
import type { JourneyAction } from "../../../src/domain/journeyBuilder/types";

// ── Mock factories ──────────────────────────────────────────

function createMockToolHost(): ToolHost {
	const el = document.createElement("div");
	el.textContent = "test";
	return {
		executeCommand: vi.fn().mockReturnValue(true),
		querySelector: vi.fn().mockReturnValue(el),
		querySelectorAll: vi.fn().mockReturnValue([el]),
		createFile: vi.fn().mockResolvedValue(undefined),
		deleteFile: vi.fn().mockResolvedValue(undefined),
		readFile: vi.fn().mockResolvedValue(""),
		moveFile: vi.fn().mockResolvedValue(undefined),
		copyFile: vi.fn().mockResolvedValue(undefined),
		openFile: vi.fn().mockResolvedValue(undefined),
		openUrl: vi.fn(),
		showNotice: vi.fn(),
		setTheme: vi.fn(),
		closeLeaves: vi.fn(),
		closeModals: vi.fn(),
		clickRibbon: vi.fn().mockReturnValue(true),
		scrollTo: vi.fn().mockReturnValue(true),
		getFrontmatter: vi.fn().mockReturnValue({}),
		updateFrontmatter: vi.fn().mockResolvedValue(undefined),
		getEventTrace: vi.fn().mockReturnValue([]),
		showSpinner: vi.fn(),
		hideSpinner: vi.fn(),
		writeRunLog: vi.fn().mockResolvedValue(undefined),
		seed: vi.fn().mockResolvedValue(undefined),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		on: vi.fn().mockReturnValue(() => {}),
	} as unknown as IEventBus;
}

function createMockTestManagementService(): TestManagementService {
	return {
		recordRunResult: vi.fn(),
	} as unknown as TestManagementService;
}

function makeJourney(steps: Array<{ id: string; title: string; actions: JourneyAction[] }>): ExecutableJourney {
	return {
		journey: "Test Journey",
		steps: steps.map((s): ExecutableStep => ({ ...s, description: "" })),
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("JourneyExecutorService", () => {
	let host: ToolHost;
	let eventBus: IEventBus;
	let tmService: TestManagementService;
	let service: JourneyExecutorService;

	beforeEach(() => {
		host = createMockToolHost();
		eventBus = createMockEventBus();
		tmService = createMockTestManagementService();
		service = new JourneyExecutorService({ eventBus, host, testManagementService: tmService });
	});

	describe("run", () => {
		it("executes all steps sequentially", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "test:cmd" }] },
				{ id: "s2", title: "Step 2", actions: [{ tool: "notice", message: "done" }] },
			]);
			const result = await service.run(journey);
			expect(result.totalSteps).toBe(2);
			expect(result.passed).toBe(2);
			expect(result.failed).toBe(0);
		});

		it("emits started event", async () => {
			const journey = makeJourney([{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] }]);
			await service.run(journey);
			expect(eventBus.emit).toHaveBeenCalledWith("journey-executor.run.started", {
				journeyName: "Test Journey",
				stepCount: 1,
				dryRun: false,
			});
		});

		it("emits step-completed for each step", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
				{ id: "s2", title: "Step 2", actions: [{ tool: "command", id: "y" }] },
			]);
			await service.run(journey);

			const stepCalls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls.filter(
				(c: unknown[]) => c[0] === "journey-executor.run.step-completed",
			);
			expect(stepCalls).toHaveLength(2);
			expect(stepCalls[0][1]).toMatchObject({ stepId: "s1", status: "pass" });
			expect(stepCalls[1][1]).toMatchObject({ stepId: "s2", status: "pass" });
		});

		it("emits completed event with correct counts", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
			]);
			await service.run(journey);
			expect(eventBus.emit).toHaveBeenCalledWith("journey-executor.run.completed", expect.objectContaining({
				journeyName: "Test Journey",
				totalSteps: 1,
				passed: 1,
				failed: 0,
				skipped: 0,
			}));
		});

		it("records result in TestManagementService", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
			]);
			await service.run(journey);
			expect(tmService.recordRunResult).toHaveBeenCalledWith("Test Journey", expect.objectContaining({
				totalSteps: 1,
				passed: 1,
				failed: 0,
			}));
		});

		it("handles action errors gracefully", async () => {
			(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null);
			const journey = makeJourney([
				{ id: "s1", title: "Failing step", actions: [{ tool: "click", selector: ".missing" }] },
				{ id: "s2", title: "Passing step", actions: [{ tool: "command", id: "x" }] },
			]);
			const result = await service.run(journey);
			expect(result.failed).toBe(1);
			expect(result.passed).toBe(1);
			expect(result.steps[0].error).toContain("Element not found");
		});

		it("continueOnFailure=false stops after first failure", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error("boom"); });
			const journey = makeJourney([
				{ id: "s1", title: "Fail", actions: [{ tool: "command", id: "bad" }] },
				{ id: "s2", title: "Skip", actions: [{ tool: "command", id: "ok" }] },
			]);
			const result = await service.run(journey, { continueOnFailure: false });
			expect(result.failed).toBe(1);
			expect(result.skipped).toBe(1);
			expect(result.passed).toBe(0);
		});

		it("variable interpolation works across steps", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Set var", actions: [{ tool: "eval", code: "return 'hello'", store: "greeting" }] },
				{ id: "s2", title: "Use var", actions: [{ tool: "notice", message: "{{greeting}}" }] },
			]);
			await service.run(journey);
			expect(host.showNotice).toHaveBeenCalledWith("hello", 4000);
		});

		it("dry-run mode emits events but skips side effects", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
			]);
			await service.run(journey, { dryRun: true });
			expect(eventBus.emit).toHaveBeenCalledWith("journey-executor.run.started", expect.objectContaining({ dryRun: true }));
			expect(host.executeCommand).not.toHaveBeenCalled();
		});

		it("empty journey completes immediately", async () => {
			const journey = makeJourney([]);
			const result = await service.run(journey);
			expect(result.totalSteps).toBe(0);
			expect(result.passed).toBe(0);
		});

		it("passes initial variables to actions", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Use var", actions: [{ tool: "command", id: "{{cmd}}" }] },
			]);
			await service.run(journey, { variables: { cmd: "flowti:test" } });
			expect(host.executeCommand).toHaveBeenCalledWith("flowti:test");
		});

		it("throws if already running", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Slow", actions: [{ tool: "wait", ms: 100 }] },
			]);
			const p = service.run(journey);
			await expect(service.run(journey)).rejects.toThrow("already running");
			await p;
		});

		it("confirmation rejected skips destructive action", async () => {
			const options: ExecutionOptions = {
				onConfirmDestructive: vi.fn().mockResolvedValue(false),
			};
			const journey = makeJourney([
				{ id: "s1", title: "Create", actions: [{ tool: "create-file", path: "x.md", content: "hi" }] },
			]);
			const result = await service.run(journey, options);
			expect(result.passed).toBe(1); // Step passes, action was just skipped
			expect(host.createFile).not.toHaveBeenCalled();
		});

		it("manual tool callback invoked", async () => {
			const onManual = vi.fn().mockResolvedValue("pass");
			const journey = makeJourney([
				{ id: "s1", title: "Manual", actions: [{ tool: "manual", instruction: "Check the UI" }] },
			]);
			await service.run(journey, { onManualInput: onManual });
			expect(onManual).toHaveBeenCalledWith("Check the UI");
		});
	});

	describe("cancel", () => {
		it("stops after current step and marks remaining as skipped", async () => {
			let stepCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				stepCount++;
				if (stepCount === 1) service.cancel();
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "a" }] },
				{ id: "s2", title: "Step 2", actions: [{ tool: "command", id: "b" }] },
				{ id: "s3", title: "Step 3", actions: [{ tool: "command", id: "c" }] },
			]);
			const result = await service.run(journey);
			expect(result.passed).toBe(1);
			expect(result.skipped).toBe(2);
		});

		it("emits run.failed with cancelled reason", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				service.cancel();
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "a" }] },
				{ id: "s2", title: "Step 2", actions: [{ tool: "command", id: "b" }] },
			]);
			await service.run(journey);
			expect(eventBus.emit).toHaveBeenCalledWith("journey-executor.run.failed", {
				journeyName: "Test Journey",
				reason: "cancelled",
			});
		});

		it("isRunning returns false after cancel completes", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				service.cancel();
				return true;
			});
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "a" }] },
				{ id: "s2", title: "Step 2", actions: [{ tool: "command", id: "b" }] },
			]);
			await service.run(journey);
			expect(service.isRunning()).toBe(false);
		});
	});

	describe("isRunning", () => {
		it("returns false when idle", () => {
			expect(service.isRunning()).toBe(false);
		});
	});

	describe("getExecutionState", () => {
		it("returns null when idle", () => {
			expect(service.getExecutionState()).toBeNull();
		});

		it("returns state after run", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
			]);
			await service.run(journey);
			const state = service.getExecutionState();
			expect(state).not.toBeNull();
			expect(state!.journeyName).toBe("Test Journey");
			expect(state!.stepResults).toHaveLength(1);
		});
	});

	describe("validateJourney", () => {
		it("returns valid for well-formed journey", () => {
			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [{ tool: "command", id: "x" }] },
			]);
			const result = service.validateJourney(journey);
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("returns errors for step with no title", () => {
			const journey = makeJourney([
				{ id: "s1", title: "", actions: [{ tool: "command", id: "x" }] },
			]);
			const result = service.validateJourney(journey);
			expect(result.valid).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});

		it("returns errors for step with no actions", () => {
			const journey = makeJourney([
				{ id: "s1", title: "Empty", actions: [] },
			]);
			const result = service.validateJourney(journey);
			expect(result.valid).toBe(false);
		});
	});
});
