import { describe, it, expect, vi, beforeEach } from "vitest";
import { ToolExecutor } from "../../../src/game/systems/tool-executor-system.js";
import type { ToolResult } from "../../../src/game/systems/tool-executor-system.js";
import type { AgentTool } from "../../../src/game/data/world-config.js";

// ── Helpers ────────────────────────────────────────────────────────────

function makeTool(overrides: Partial<AgentTool> = {}): AgentTool {
	return {
		id: "run-tests",
		label: "Run Tests",
		command: "npm test",
		domains: ["engineering"],
		triggers: [],
		cooldownMs: 5_000,
		requiresApproval: false,
		...overrides,
	};
}

function makeSuccessExecutor() {
	return vi.fn().mockResolvedValue({ success: true, output: "All tests passed" });
}

// ── ToolExecutor ───────────────────────────────────────────────────────

describe("ToolExecutor", () => {
	let executor: ToolExecutor;
	let results: ToolResult[];

	beforeEach(() => {
		executor = new ToolExecutor();
		results = [];
		executor.onResult((r) => results.push(r));
	});

	// ── registerTools ─────────────────────────────────────────────────

	describe("registerTools()", () => {
		it("registers tools without throwing", () => {
			expect(() => executor.registerTools([makeTool()])).not.toThrow();
		});

		it("registers multiple tools", () => {
			const tools = [
				makeTool({ id: "tool-a" }),
				makeTool({ id: "tool-b" }),
			];
			expect(() => executor.registerTools(tools)).not.toThrow();
		});
	});

	// ── Approval-required tools ───────────────────────────────────────

	describe("approval-required tool", () => {
		it("fires approvalCallback instead of executing", async () => {
			const tool = makeTool({ requiresApproval: true });
			executor.registerTools([tool]);

			const approvalCb = vi.fn();
			executor.onApprovalNeeded(approvalCb);

			const execFn = makeSuccessExecutor();
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			// Wait a tick to ensure async tasks resolve
			await Promise.resolve();

			expect(approvalCb).toHaveBeenCalledWith("Alice", tool, {});
			expect(execFn).not.toHaveBeenCalled();
			expect(results).toHaveLength(0);
		});

		it("executes after approval is granted", async () => {
			const tool = makeTool({ requiresApproval: true });
			executor.registerTools([tool]);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Alice", "run-tests", {});
			executor.grantApproval("Alice", "run-tests");
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results).toHaveLength(1);
			expect(results[0].agentName).toBe("Alice");
			expect(results[0].toolId).toBe("run-tests");
			expect(results[0].success).toBe(true);
		});

		it("removes tool from queue on denial", async () => {
			const tool = makeTool({ requiresApproval: true });
			executor.registerTools([tool]);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Alice", "run-tests", {});
			executor.denyApproval("Alice", "run-tests");
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results).toHaveLength(0);
		});
	});

	// ── Auto-execute read-only tools ──────────────────────────────────

	describe("read-only tool (requiresApproval: false)", () => {
		it("auto-executes without requiring approval", async () => {
			const tool = makeTool({ requiresApproval: false });
			executor.registerTools([tool]);

			const approvalCb = vi.fn();
			executor.onApprovalNeeded(approvalCb);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(approvalCb).not.toHaveBeenCalled();
			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(true);
		});

		it("emits result with correct agentName and toolId", async () => {
			executor.registerTools([makeTool({ id: "lint", requiresApproval: false })]);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Bob", "lint", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results[0].agentName).toBe("Bob");
			expect(results[0].toolId).toBe("lint");
		});
	});

	// ── Cooldown ──────────────────────────────────────────────────────

	describe("cooldown", () => {
		it("blocks re-queue within cooldown period", async () => {
			executor.registerTools([makeTool({ cooldownMs: 5_000, requiresApproval: false })]);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			// Try to queue again before cooldown expires
			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			// Only one result — second queue was blocked
			expect(results).toHaveLength(1);
		});

		it("allows re-queue after cooldown expires", async () => {
			executor.registerTools([makeTool({ cooldownMs: 1_000, requiresApproval: false })]);
			executor.setExecutor(makeSuccessExecutor());

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			// Advance past cooldown
			executor.update(2_000);

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results).toHaveLength(2);
		});
	});

	// ── Template variable substitution ────────────────────────────────

	describe("template variable substitution", () => {
		it("substitutes {project} in command", async () => {
			const execFn = vi.fn().mockResolvedValue({ success: true, output: "" });
			executor.registerTools([makeTool({ command: "flowti build --project={project}", requiresApproval: false })]);
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", { project: "Flowti CLI" });
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(execFn).toHaveBeenCalledWith("flowti build --project=Flowti CLI");
		});

		it("substitutes multiple placeholders", async () => {
			const execFn = vi.fn().mockResolvedValue({ success: true, output: "" });
			executor.registerTools([makeTool({
				command: "cp {source} {dest}",
				requiresApproval: false,
			})]);
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", { source: "a.ts", dest: "b.ts" });
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(execFn).toHaveBeenCalledWith("cp a.ts b.ts");
		});

		it("leaves unknown placeholders as-is", async () => {
			const execFn = vi.fn().mockResolvedValue({ success: true, output: "" });
			executor.registerTools([makeTool({ command: "echo {unknown}", requiresApproval: false })]);
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(execFn).toHaveBeenCalledWith("echo {unknown}");
		});
	});

	// ── Executor errors ───────────────────────────────────────────────

	describe("executor error handling", () => {
		it("emits failed result when executor rejects", async () => {
			const execFn = vi.fn().mockRejectedValue(new Error("command failed"));
			executor.registerTools([makeTool({ requiresApproval: false })]);
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results).toHaveLength(1);
			expect(results[0].success).toBe(false);
			expect(results[0].output).toContain("command failed");
		});

		it("emits failed result with output from executor", async () => {
			const execFn = vi.fn().mockResolvedValue({ success: false, output: "lint error" });
			executor.registerTools([makeTool({ requiresApproval: false })]);
			executor.setExecutor(execFn);

			executor.queueTool("Alice", "run-tests", {});
			executor.update(100);

			await new Promise((r) => setTimeout(r, 10));

			expect(results[0].success).toBe(false);
			expect(results[0].output).toBe("lint error");
		});
	});

	// ── No executor set ───────────────────────────────────────────────

	describe("no executor set", () => {
		it("does not throw when update is called with no executor", () => {
			executor.registerTools([makeTool({ requiresApproval: false })]);
			executor.queueTool("Alice", "run-tests", {});
			expect(() => executor.update(100)).not.toThrow();
		});
	});

	// ── Unknown tool ──────────────────────────────────────────────────

	describe("unknown tool", () => {
		it("ignores queue for unregistered tool id", () => {
			executor.setExecutor(makeSuccessExecutor());
			executor.queueTool("Alice", "nonexistent-tool", {});
			executor.update(100);
			expect(results).toHaveLength(0);
		});
	});

	// ── grantApproval / denyApproval edge cases ───────────────────────

	describe("grantApproval() / denyApproval() edge cases", () => {
		it("grantApproval on unknown agent does not throw", () => {
			expect(() => executor.grantApproval("nobody", "run-tests")).not.toThrow();
		});

		it("denyApproval on unknown agent does not throw", () => {
			expect(() => executor.denyApproval("nobody", "run-tests")).not.toThrow();
		});
	});
});
