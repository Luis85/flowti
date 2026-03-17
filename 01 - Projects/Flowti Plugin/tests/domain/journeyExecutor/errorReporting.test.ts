// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JourneyExecutorService } from "../../../src/domain/journeyExecutor/JourneyExecutorService";
import { generateExecutionReport } from "../../../src/domain/journeyExecutor/executionReportGenerator";
import type { ToolHost, ExecutableJourney, ExecutableStep, ExecutionResult } from "../../../src/domain/journeyExecutor/types";
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
	return { recordRunResult: vi.fn() } as unknown as TestManagementService;
}

function makeJourney(steps: Array<{ id: string; title: string; actions: JourneyAction[] }>): ExecutableJourney {
	return {
		journey: "Error Test Journey",
		steps: steps.map((s): ExecutableStep => ({ ...s, description: "" })),
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("Enhanced Error Reporting", () => {
	let host: ToolHost;
	let eventBus: IEventBus;
	let tmService: TestManagementService;

	beforeEach(() => {
		host = createMockToolHost();
		eventBus = createMockEventBus();
		tmService = createMockTestManagementService();
	});

	function createService() {
		return new JourneyExecutorService({
			eventBus, host, testManagementService: tmService,
			delayFn: vi.fn().mockResolvedValue(undefined),
		});
	}

	describe("failedAction context", () => {
		it("captures tool name and action index on failure", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("cmd failed");
			});

			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [
					{ tool: "notice", message: "hi" },
					{ tool: "command", id: "test:cmd" },
				]},
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.steps[0].failedAction).toBeDefined();
			expect(result.steps[0].failedAction!.tool).toBe("command");
			expect(result.steps[0].failedAction!.actionIndex).toBe(1);
		});

		it("includes key params from the failing action", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("not found");
			});

			const journey = makeJourney([
				{ id: "s1", title: "Step 1", actions: [
					{ tool: "command", id: "flowti:open-hub" },
				]},
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.steps[0].failedAction!.params).toEqual({ id: "flowti:open-hub" });
		});

		it("does not set failedAction on passing steps", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "OK Step", actions: [{ tool: "command", id: "test:cmd" }] },
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.steps[0].failedAction).toBeUndefined();
		});

		it("captures first failing action index in a multi-action step", async () => {
			(host.querySelector as ReturnType<typeof vi.fn>).mockReturnValue(null);

			const journey = makeJourney([
				{ id: "s1", title: "Multi", actions: [
					{ tool: "command", id: "test:cmd" },
					{ tool: "click", selector: ".missing-el" },
					{ tool: "command", id: "test:cmd2" },
				]},
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.steps[0].failedAction!.tool).toBe("click");
			expect(result.steps[0].failedAction!.actionIndex).toBe(1);
			expect(result.steps[0].failedAction!.params).toEqual({ selector: ".missing-el" });
		});
	});

	describe("execution report with action context", () => {
		it("includes action context in error column", () => {
			const result: ExecutionResult = {
				journeyName: "Test",
				totalSteps: 1,
				passed: 0,
				failed: 1,
				skipped: 0,
				durationMs: 100,
				steps: [{
					stepIndex: 0,
					stepId: "s1",
					stepTitle: "Step 1",
					status: "fail",
					durationMs: 50,
					error: "Element not found",
					failedAction: { tool: "click", actionIndex: 2, params: { selector: ".btn" } },
				}],
			};

			const report = generateExecutionReport(result);
			expect(report.markdown).toContain("[click#2");
			expect(report.markdown).toContain("selector=.btn");
			expect(report.markdown).toContain("Element not found");
		});

		it("includes retry count in error column", () => {
			const result: ExecutionResult = {
				journeyName: "Test",
				totalSteps: 1,
				passed: 0,
				failed: 1,
				skipped: 0,
				durationMs: 100,
				steps: [{
					stepIndex: 0,
					stepId: "s1",
					stepTitle: "Step 1",
					status: "fail",
					durationMs: 50,
					error: "Timeout",
					retryAttempts: 3,
				}],
			};

			const report = generateExecutionReport(result);
			expect(report.markdown).toContain("3 retries");
		});

		it("renders clean error column when no action context", () => {
			const result: ExecutionResult = {
				journeyName: "Test",
				totalSteps: 1,
				passed: 1,
				failed: 0,
				skipped: 0,
				durationMs: 50,
				steps: [{
					stepIndex: 0,
					stepId: "s1",
					stepTitle: "Good Step",
					status: "pass",
					durationMs: 50,
				}],
			};

			const report = generateExecutionReport(result);
			// Error column should be empty for passing step
			expect(report.markdown).toContain("| 1 | ✓ pass |");
		});
	});
});
