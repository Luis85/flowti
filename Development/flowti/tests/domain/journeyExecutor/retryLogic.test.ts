// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JourneyExecutorService } from "../../../src/domain/journeyExecutor/JourneyExecutorService";
import type { ToolHost, ExecutableJourney, ExecutableStep } from "../../../src/domain/journeyExecutor/types";
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

function makeJourney(steps: Array<{ id: string; title: string; actions: JourneyAction[]; retry?: { maxRetries: number; delayMs: number; backoff?: "linear" | "exponential" } }>): ExecutableJourney {
	return {
		journey: "Test Journey",
		steps: steps.map((s): ExecutableStep => ({ id: s.id, title: s.title, description: "", actions: s.actions, retry: s.retry })),
	};
}

// ── Tests ───────────────────────────────────────────────────

describe("Journey Executor — Retry Logic", () => {
	let host: ToolHost;
	let eventBus: IEventBus;
	let tmService: TestManagementService;
	const noDelay = vi.fn().mockResolvedValue(undefined);

	beforeEach(() => {
		host = createMockToolHost();
		eventBus = createMockEventBus();
		tmService = createMockTestManagementService();
		noDelay.mockClear();
	});

	function createService() {
		return new JourneyExecutorService({
			eventBus, host, testManagementService: tmService,
			delayFn: noDelay,
		});
	}

	describe("per-step retry config", () => {
		it("retries a failing step up to maxRetries times", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount <= 2) throw new Error("transient");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Flaky Step", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 3, delayMs: 50 } },
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.passed).toBe(1);
			expect(result.failed).toBe(0);
			expect(result.steps[0].status).toBe("pass");
			expect(result.steps[0].retryAttempts).toBe(2); // Failed twice, passed on 3rd
		});

		it("fails after exhausting all retries", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("persistent failure");
			});

			const journey = makeJourney([
				{ id: "s1", title: "Always Fails", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 2, delayMs: 10 } },
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.failed).toBe(1);
			expect(result.steps[0].status).toBe("fail");
			expect(result.steps[0].error).toBe("persistent failure");
			// executeCommand called 3 times total (1 initial + 2 retries)
			expect(host.executeCommand).toHaveBeenCalledTimes(3);
		});

		it("does not retry when step passes on first attempt", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Good Step", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 3, delayMs: 10 } },
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.passed).toBe(1);
			expect(result.steps[0].retryAttempts).toBeUndefined();
			expect(noDelay).not.toHaveBeenCalled();
		});

		it("uses linear delay by default", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount <= 2) throw new Error("fail");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Retry", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 3, delayMs: 100 } },
			]);

			const service = createService();
			await service.run(journey);

			// Linear: both delays should be 100ms
			expect(noDelay).toHaveBeenCalledTimes(2);
			expect(noDelay).toHaveBeenNthCalledWith(1, 100);
			expect(noDelay).toHaveBeenNthCalledWith(2, 100);
		});

		it("uses exponential backoff when configured", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount <= 3) throw new Error("fail");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Exp Retry", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 3, delayMs: 50, backoff: "exponential" } },
			]);

			const service = createService();
			await service.run(journey);

			// Exponential: 50 * 2^0 = 50, 50 * 2^1 = 100, 50 * 2^2 = 200
			expect(noDelay).toHaveBeenCalledTimes(3);
			expect(noDelay).toHaveBeenNthCalledWith(1, 50);
			expect(noDelay).toHaveBeenNthCalledWith(2, 100);
			expect(noDelay).toHaveBeenNthCalledWith(3, 200);
		});
	});

	describe("global retryCount option", () => {
		it("applies global retry to steps without per-step config", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount === 1) throw new Error("first fail");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "No Retry Config", actions: [{ tool: "command", id: "test:cmd" }] },
			]);

			const service = createService();
			const result = await service.run(journey, { retryCount: 2, retryDelayMs: 10 });

			expect(result.passed).toBe(1);
			expect(result.steps[0].retryAttempts).toBe(1);
		});

		it("per-step config overrides global retryCount", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount <= 1) throw new Error("fail");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Step with own retry", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 5, delayMs: 10 } },
			]);

			const service = createService();
			// Global retryCount = 1, but per-step has maxRetries = 5
			const result = await service.run(journey, { retryCount: 1 });

			expect(result.passed).toBe(1);
			expect(result.steps[0].retryAttempts).toBe(1);
		});

		it("does not retry by default (retryCount = 0)", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("fail");
			});

			const journey = makeJourney([
				{ id: "s1", title: "No Retries", actions: [{ tool: "command", id: "test:cmd" }] },
			]);

			const service = createService();
			const result = await service.run(journey);

			expect(result.failed).toBe(1);
			expect(host.executeCommand).toHaveBeenCalledTimes(1);
			expect(result.steps[0].retryAttempts).toBeUndefined();
		});
	});

	describe("retry events", () => {
		it("emits step-retried event on each retry attempt", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				if (callCount <= 2) throw new Error("transient");
				return true;
			});

			const journey = makeJourney([
				{ id: "s1", title: "Retry Events", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 3, delayMs: 10 } },
			]);

			const service = createService();
			await service.run(journey);

			const calls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
			const retryEmits = calls.filter((c) => c[0] === "journey-executor.run.step-retried");

			expect(retryEmits).toHaveLength(2);
			expect(retryEmits[0][1]).toMatchObject({
				journeyName: "Test Journey",
				stepIndex: 0,
				stepId: "s1",
				attempt: 1,
				maxRetries: 3,
				error: "transient",
			});
			expect(retryEmits[1][1]).toMatchObject({
				attempt: 2,
			});
		});

		it("does not emit step-retried when no retries needed", async () => {
			const journey = makeJourney([
				{ id: "s1", title: "Good Step", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 2, delayMs: 10 } },
			]);

			const service = createService();
			await service.run(journey);

			const calls = (eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
			const retryEmits = calls.filter((c) => c[0] === "journey-executor.run.step-retried");
			expect(retryEmits).toHaveLength(0);
		});
	});

	describe("retry + cancellation", () => {
		it("does not retry after cancellation", async () => {
			let callCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				callCount++;
				throw new Error("fail");
			});

			const journey = makeJourney([
				{ id: "s1", title: "Cancel Mid-Retry", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 5, delayMs: 10 } },
			]);

			const service = createService();
			// Cancel after first delay
			noDelay.mockImplementationOnce(async () => { service.cancel(); });

			const result = await service.run(journey);

			// Should have tried initial + 1 retry, then cancelled
			expect(result.steps[0].status).toBe("fail");
			// Due to cancellation, fewer attempts than maxRetries
			expect(callCount).toBeLessThanOrEqual(3);
		});
	});

	describe("retry + continueOnFailure", () => {
		it("continues to next step after retry exhaustion with continueOnFailure=true", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>)
				.mockImplementationOnce(() => { throw new Error("fail1"); })
				.mockImplementationOnce(() => { throw new Error("fail2"); })
				.mockReturnValue(true);

			const journey = makeJourney([
				{ id: "s1", title: "Failing", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 1, delayMs: 10 } },
				{ id: "s2", title: "Passing", actions: [{ tool: "command", id: "test:cmd2" }] },
			]);

			const service = createService();
			const result = await service.run(journey, { continueOnFailure: true });

			expect(result.steps[0].status).toBe("fail");
			expect(result.steps[1].status).toBe("pass");
			expect(result.passed).toBe(1);
			expect(result.failed).toBe(1);
		});

		it("skips remaining steps after retry exhaustion with continueOnFailure=false", async () => {
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				throw new Error("fail");
			});

			const journey = makeJourney([
				{ id: "s1", title: "Failing", actions: [{ tool: "command", id: "test:cmd" }], retry: { maxRetries: 1, delayMs: 10 } },
				{ id: "s2", title: "Skipped", actions: [{ tool: "command", id: "test:cmd2" }] },
			]);

			const service = createService();
			const result = await service.run(journey, { continueOnFailure: false });

			expect(result.steps[0].status).toBe("fail");
			expect(result.steps[1].status).toBe("skip");
		});
	});

	describe("multiple actions in a step with retry", () => {
		it("re-executes all actions from the start on retry", async () => {
			const actionLog: string[] = [];
			(host.showNotice as ReturnType<typeof vi.fn>).mockImplementation((msg: string) => {
				actionLog.push(`notice:${msg}`);
			});
			let cmdCount = 0;
			(host.executeCommand as ReturnType<typeof vi.fn>).mockImplementation(() => {
				cmdCount++;
				actionLog.push(`cmd:${cmdCount}`);
				if (cmdCount === 1) throw new Error("first cmd fail");
				return true;
			});

			const journey = makeJourney([
				{
					id: "s1",
					title: "Multi-action",
					actions: [
						{ tool: "notice", message: "hello" },
						{ tool: "command", id: "test:cmd" },
					],
					retry: { maxRetries: 1, delayMs: 10 },
				},
			]);

			const service = createService();
			const result = await service.run(journey);

			// Attempt 1: notice + cmd(fail), Attempt 2: notice + cmd(pass)
			expect(actionLog).toEqual(["notice:hello", "cmd:1", "notice:hello", "cmd:2"]);
			expect(result.passed).toBe(1);
		});
	});
});
