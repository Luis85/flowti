import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProcessService } from "../../../src/domain/process/ProcessService";
import type { ProcessScanner } from "../../../src/domain/process/ProcessService";
import { EventBus } from "../../../src/infrastructure/events/EventBus";

// ── Helpers ─────────────────────────────────────────────────

function makeCanvasJson(nodes: unknown[], edges: unknown[] = []): string {
	return JSON.stringify({ nodes, edges });
}

function makeProcessCanvasContent(): string {
	return makeCanvasJson(
		[
			{ id: "s1", type: "text", text: "● Start", x: 0, y: 0, width: 100, height: 50 },
			{ id: "a1", type: "text", text: "■ Development", x: 200, y: 0, width: 100, height: 50 },
			{ id: "e1", type: "text", text: "⦿ Done", x: 400, y: 0, width: 100, height: 50 },
		],
		[
			{ fromNode: "s1", toNode: "a1" },
			{ fromNode: "a1", toNode: "e1" },
		],
	);
}

// ── Tests ───────────────────────────────────────────────────

describe("ProcessService", () => {
	let eventBus: EventBus;
	let service: ProcessService;

	beforeEach(() => {
		eventBus = new EventBus();
		service = new ProcessService(eventBus);
	});

	describe("scanProcesses", () => {
		it("returns empty when no scanner set", async () => {
			const result = await service.scanProcesses();
			expect(result).toEqual([]);
		});

		it("parses process canvas files", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev Lifecycle", filePath: "processes/dev.process.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);

			const result = await service.scanProcesses();
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Dev Lifecycle");
			expect(result[0].nodes).toHaveLength(3);
			expect(result[0].edges).toHaveLength(2);
		});

		it("emits process.canvas.synced for each parsed process", async () => {
			const listener = vi.fn();
			eventBus.on("process.canvas.synced", listener);

			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Process A", filePath: "a.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);
			await service.scanProcesses();

			expect(listener).toHaveBeenCalledOnce();
			expect(listener.mock.calls[0][0].payload.processName).toBe("Process A");
		});

		it("skips malformed canvas files", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Valid", filePath: "valid.canvas", content: makeProcessCanvasContent() },
				{ name: "Invalid", filePath: "invalid.canvas", content: "not json" },
			]);
			service.setScanner(scanner);

			const result = await service.scanProcesses();
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("Valid");
		});

		it("skips canvas with no process nodes", async () => {
			const noProcessContent = makeCanvasJson([
				{ id: "n1", type: "text", text: "Regular note", x: 0, y: 0, width: 100, height: 50 },
			]);
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Not Process", filePath: "nope.canvas", content: noProcessContent },
			]);
			service.setScanner(scanner);

			const result = await service.scanProcesses();
			expect(result).toEqual([]);
		});
	});

	describe("getProcesses / getProcess", () => {
		it("returns scanned processes", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);
			await service.scanProcesses();

			expect(service.getProcesses()).toHaveLength(1);
			expect(service.getProcess("Dev")).toBeDefined();
			expect(service.getProcess("Missing")).toBeUndefined();
		});
	});

	describe("validateProcess", () => {
		it("validates a process definition", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);
			await service.scanProcesses();

			const process = service.getProcess("Dev")!;
			const result = service.validateProcess(process);

			expect(result.valid).toBe(true);
			expect(result.errorCount).toBe(0);
		});

		it("caches validation results", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);
			await service.scanProcesses();

			const process = service.getProcess("Dev")!;
			const result1 = service.validateProcess(process);
			const result2 = service.validateProcess(process);

			expect(result1).toBe(result2); // Same object reference (cached)
		});

		it("clears cache on rescan", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);

			await service.scanProcesses();
			const process1 = service.getProcess("Dev")!;
			const result1 = service.validateProcess(process1);

			await service.scanProcesses();
			const process2 = service.getProcess("Dev")!;
			const result2 = service.validateProcess(process2);

			expect(result1).not.toBe(result2); // Different objects after cache clear
		});
	});

	describe("getValidationSummary", () => {
		it("returns summary counts", async () => {
			const scanner: ProcessScanner = vi.fn().mockResolvedValue([
				{ name: "Dev", filePath: "dev.canvas", content: makeProcessCanvasContent() },
			]);
			service.setScanner(scanner);
			await service.scanProcesses();

			const process = service.getProcess("Dev")!;
			const summary = service.getValidationSummary(process);

			expect(summary).toHaveProperty("errorCount");
			expect(summary).toHaveProperty("warningCount");
			expect(summary).toHaveProperty("infoCount");
			expect(summary).toHaveProperty("valid");
			expect(summary.valid).toBe(true);
		});
	});
});
