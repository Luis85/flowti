// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ExecutionProgressModal } from "../../../src/ui/journeyExecutor/ExecutionProgressModal";
import type { ExecutionProgressModalDeps } from "../../../src/ui/journeyExecutor/ExecutionProgressModal";
import type { JourneyExecutorService } from "../../../src/domain/journeyExecutor/JourneyExecutorService";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { ExecutableJourney, ExecutionResult } from "../../../src/domain/journeyExecutor/types";
import { App } from "obsidian";

// ── Helpers ──────────────────────────────────────────────

function makeJourney(name = "Test Journey", stepCount = 3): ExecutableJourney {
	return {
		journey: name,
		steps: Array.from({ length: stepCount }, (_, i) => ({
			id: `s${i + 1}`,
			title: `Step ${i + 1}`,
			description: `Desc ${i + 1}`,
			actions: [],
		})),
	};
}

function makeResult(overrides: Partial<ExecutionResult> = {}): ExecutionResult {
	return {
		journeyName: "Test Journey",
		totalSteps: 3,
		passed: 2,
		failed: 1,
		skipped: 0,
		durationMs: 1500,
		steps: [
			{ stepIndex: 0, stepId: "s1", stepTitle: "Step 1", status: "pass", durationMs: 400 },
			{ stepIndex: 1, stepId: "s2", stepTitle: "Step 2", status: "fail", durationMs: 600, error: "Assertion failed" },
			{ stepIndex: 2, stepId: "s3", stepTitle: "Step 3", status: "pass", durationMs: 500 },
		],
		...overrides,
	};
}

let eventHandlers: Map<string, Array<(event: { payload: unknown }) => void>>;

function createMockEventBus(): IEventBus {
	eventHandlers = new Map();
	return {
		on: vi.fn((event: string, handler: (event: { payload: unknown }) => void) => {
			if (!eventHandlers.has(event)) eventHandlers.set(event, []);
			eventHandlers.get(event)!.push(handler);
			return () => {};
		}),
		emit: vi.fn(),
	} as unknown as IEventBus;
}

function createMockExecutorService(result?: ExecutionResult): JourneyExecutorService {
	return {
		run: vi.fn(async () => result ?? makeResult()),
		cancel: vi.fn(),
		isRunning: vi.fn(() => false),
	} as unknown as JourneyExecutorService;
}

function createDeps(overrides: Partial<ExecutionProgressModalDeps> = {}): ExecutionProgressModalDeps {
	return {
		app: new App(),
		eventBus: createMockEventBus(),
		executorService: createMockExecutorService(),
		journey: makeJourney(),
		...overrides,
	};
}

function getButtons(el: HTMLElement): HTMLButtonElement[] {
	return Array.from(el.querySelectorAll("button"));
}

function findButton(el: HTMLElement, text: string): HTMLButtonElement | undefined {
	return getButtons(el).find((b) => b.textContent === text);
}

// ── Tests ────────────────────────────────────────────────

describe("ExecutionProgressModal", () => {
	let deps: ExecutionProgressModalDeps;
	let modal: ExecutionProgressModal;

	beforeEach(() => {
		deps = createDeps();
		modal = new ExecutionProgressModal(deps);
	});

	describe("Phase 1: Options", () => {
		it("renders options phase with journey name", () => {
			modal.onOpen();
			const h3 = modal.contentEl.querySelector("h3");
			expect(h3?.textContent).toContain("Test Journey");
		});

		it("shows step count", () => {
			modal.onOpen();
			const muted = modal.contentEl.querySelector(".ft-text-muted");
			expect(muted?.textContent).toContain("3 steps");
		});

		it("renders dry-run toggle", () => {
			modal.onOpen();
			const names = Array.from(modal.contentEl.querySelectorAll(".setting-item-name"));
			expect(names.some((n) => n.textContent === "Dry run")).toBe(true);
		});

		it("renders continue on failure toggle", () => {
			modal.onOpen();
			const names = Array.from(modal.contentEl.querySelectorAll(".setting-item-name"));
			expect(names.some((n) => n.textContent === "Continue on failure")).toBe(true);
		});

		it("has Run and Cancel buttons", () => {
			modal.onOpen();
			const buttons = getButtons(modal.contentEl);
			expect(buttons.some((b) => b.textContent === "Run")).toBe(true);
			expect(buttons.some((b) => b.textContent === "Cancel")).toBe(true);
		});
	});

	describe("Phase 2: Progress", () => {
		it("Run button starts execution", async () => {
			modal.onOpen();
			const runBtn = findButton(modal.contentEl, "Run");
			runBtn?.click();
			await vi.waitFor(() => {
				expect(deps.executorService.run).toHaveBeenCalled();
			});
		});

		it("progress phase shows step count", async () => {
			const service = createMockExecutorService();
			let resolveRun!: (value: ExecutionResult) => void;
			(service.run as ReturnType<typeof vi.fn>).mockImplementation(
				() => new Promise<ExecutionResult>((r) => { resolveRun = r; }),
			);
			deps = createDeps({ executorService: service });
			modal = new ExecutionProgressModal(deps);
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();

			// Wait for progress phase to render
			await vi.waitFor(() => {
				const h3 = modal.contentEl.querySelector("h3");
				expect(h3?.textContent).toContain("Running:");
			});

			expect(modal.contentEl.textContent).toContain("Step 0 of 3");
			resolveRun(makeResult());
		});

		it("step results update on event", async () => {
			const service = createMockExecutorService();
			let resolveRun!: (value: ExecutionResult) => void;
			(service.run as ReturnType<typeof vi.fn>).mockImplementation(
				() => new Promise<ExecutionResult>((r) => { resolveRun = r; }),
			);
			deps = createDeps({ executorService: service });
			modal = new ExecutionProgressModal(deps);
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();

			await vi.waitFor(() => {
				expect(eventHandlers.has("journey-executor.run.step-completed")).toBe(true);
			});

			// Simulate step completion event
			const handlers = eventHandlers.get("journey-executor.run.step-completed")!;
			handlers.forEach((h) => h({
				payload: { stepIndex: 0, stepId: "s1", stepTitle: "Step 1", status: "pass", durationMs: 200 },
			}));

			expect(modal.contentEl.textContent).toContain("✓ Step 1");
			resolveRun(makeResult());
		});

		it("cancel button calls service.cancel()", async () => {
			const service = createMockExecutorService();
			let resolveRun!: (value: ExecutionResult) => void;
			(service.run as ReturnType<typeof vi.fn>).mockImplementation(
				() => new Promise<ExecutionResult>((r) => { resolveRun = r; }),
			);
			deps = createDeps({ executorService: service });
			modal = new ExecutionProgressModal(deps);
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();

			await vi.waitFor(() => {
				expect(modal.contentEl.querySelector("h3")?.textContent).toContain("Running:");
			});

			const cancelBtn = findButton(modal.contentEl, "Cancel");
			cancelBtn?.click();
			expect(service.cancel).toHaveBeenCalled();
			resolveRun(makeResult());
		});
	});

	describe("Phase 3: Summary", () => {
		it("summary phase shows final counts", async () => {
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();
			await vi.waitFor(() => {
				expect(modal.contentEl.textContent).toContain("Passed: 2");
			});
			expect(modal.contentEl.textContent).toContain("Failed: 1");
			expect(modal.contentEl.textContent).toContain("Skipped: 0");
		});

		it("shows failure details", async () => {
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();
			await vi.waitFor(() => {
				expect(modal.contentEl.textContent).toContain("Failures");
			});
			expect(modal.contentEl.textContent).toContain("Step 2");
			expect(modal.contentEl.textContent).toContain("Assertion failed");
		});

		it("has Generate report and Close buttons", async () => {
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();
			await vi.waitFor(() => {
				const buttons = getButtons(modal.contentEl);
				expect(buttons.some((b) => b.textContent === "Generate report")).toBe(true);
				expect(buttons.some((b) => b.textContent === "Close")).toBe(true);
			});
		});

		it("generate report button calls writeFile", async () => {
			const writeFile = vi.fn(async () => {});
			deps = createDeps({ writeFile });
			modal = new ExecutionProgressModal(deps);
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();
			await vi.waitFor(() => {
				expect(findButton(modal.contentEl, "Generate report")).toBeDefined();
			});
			findButton(modal.contentEl, "Generate report")?.click();
			await vi.waitFor(() => {
				expect(writeFile).toHaveBeenCalled();
			});
			const args = writeFile.mock.calls[0] as unknown as [string, string];
			expect(args[0]).toContain("docs/reports/executions/");
			expect(args[1]).toContain("Execution Report");
		});
	});

	describe("Canvas highlighting", () => {
		it("emits canvas sync on step completion", async () => {
			const service = createMockExecutorService();
			let resolveRun!: (value: ExecutionResult) => void;
			(service.run as ReturnType<typeof vi.fn>).mockImplementation(
				() => new Promise<ExecutionResult>((r) => { resolveRun = r; }),
			);
			deps = createDeps({ executorService: service, canvasPath: "test.canvas" });
			modal = new ExecutionProgressModal(deps);
			modal.onOpen();
			findButton(modal.contentEl, "Run")?.click();

			await vi.waitFor(() => {
				expect(eventHandlers.has("journey-executor.run.step-completed")).toBe(true);
			});

			const handlers = eventHandlers.get("journey-executor.run.step-completed")!;
			handlers.forEach((h) => h({
				payload: { stepIndex: 0, stepId: "s1", stepTitle: "Step 1", status: "pass", durationMs: 200 },
			}));

			expect(deps.eventBus.emit).toHaveBeenCalledWith(
				"journey-builder.canvas.sync-requested",
				expect.objectContaining({ canvasPath: "test.canvas" }),
			);
			resolveRun(makeResult());
		});
	});

	describe("cleanup", () => {
		it("unsubscribes on close", () => {
			modal.onOpen();
			modal.onClose();
			expect(modal.contentEl.innerHTML).toBe("");
		});
	});
});
