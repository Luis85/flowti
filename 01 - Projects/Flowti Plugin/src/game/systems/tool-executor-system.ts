/**
 * tool-executor-system.ts — Command queue, approval gating, and result dispatch.
 *
 * Agents queue tools via queueTool(). Tools requiring approval fire an
 * approvalCallback and wait. Tools that are read-only auto-execute immediately.
 * grantApproval() unlocks a pending tool; denyApproval() removes it.
 *
 * Execution is delegated to a user-supplied async function (setExecutor).
 * Cooldowns prevent a tool being re-queued within its cooldownMs window.
 * Template variables ({project}, {path}, etc.) are substituted before execution.
 */

import type { AgentTool } from "../data/world-config.js";

// ── Public types ──────────────────────────────────────────────────────

export interface ToolResult {
	agentName: string;
	toolId: string;
	success: boolean;
	output: string;
}

// ── Internal queue entry ──────────────────────────────────────────────

type ApprovalState = "pending-approval" | "approved" | "executing";

interface QueueEntry {
	agentName: string;
	toolId: string;
	vars: Record<string, string>;
	approval: ApprovalState;
}

// ── ToolExecutor ──────────────────────────────────────────────────────

export class ToolExecutor {
	private readonly tools = new Map<string, AgentTool>();
	private readonly queue: QueueEntry[] = [];

	/** Cooldown tracking: "$agentName|$toolId" → remaining ms */
	private readonly cooldowns = new Map<string, number>();

	/** In-flight executions to avoid re-dispatching. */
	private readonly executing = new Set<string>();

	private approvalCallback: ((agentName: string, tool: AgentTool, vars: Record<string, string>) => void) | null = null;
	private resultCallbacks: Array<(result: ToolResult) => void> = [];
	private executor: ((command: string) => Promise<{ success: boolean; output: string }>) | null = null;

	// ── Setup ─────────────────────────────────────────────────────────

	registerTools(tools: readonly AgentTool[]): void {
		for (const tool of tools) {
			this.tools.set(tool.id, tool);
		}
	}

	onApprovalNeeded(cb: (agentName: string, tool: AgentTool, vars: Record<string, string>) => void): void {
		this.approvalCallback = cb;
	}

	onResult(cb: (result: ToolResult) => void): void {
		this.resultCallbacks.push(cb);
	}

	offResult(cb: (result: ToolResult) => void): void {
		const idx = this.resultCallbacks.indexOf(cb);
		if (idx >= 0) this.resultCallbacks.splice(idx, 1);
	}

	setExecutor(fn: (command: string) => Promise<{ success: boolean; output: string }>): void {
		this.executor = fn;
	}

	// ── Queue management ──────────────────────────────────────────────

	queueTool(agentName: string, toolId: string, vars: Record<string, string>): void {
		const tool = this.tools.get(toolId);
		if (!tool) return;

		// Check cooldown
		const cooldownKey = `${agentName}|${toolId}`;
		if (this.cooldowns.has(cooldownKey)) return;

		// Avoid duplicating an already-queued entry for the same agent+tool
		const alreadyQueued = this.queue.some((e) => e.agentName === agentName && e.toolId === toolId);
		if (alreadyQueued) return;

		if (tool.requiresApproval) {
			const entry: QueueEntry = { agentName, toolId, vars, approval: "pending-approval" };
			this.queue.push(entry);
			this.approvalCallback?.(agentName, tool, vars);
		} else {
			// Read-only / no approval needed — queue as approved
			this.queue.push({ agentName, toolId, vars, approval: "approved" });
		}
	}

	grantApproval(agentName: string, toolId: string): void {
		const entry = this.queue.find(
			(e) => e.agentName === agentName && e.toolId === toolId && e.approval === "pending-approval",
		);
		if (entry) {
			entry.approval = "approved";
		}
	}

	denyApproval(agentName: string, toolId: string): void {
		const idx = this.queue.findIndex(
			(e) => e.agentName === agentName && e.toolId === toolId && e.approval === "pending-approval",
		);
		if (idx !== -1) {
			this.queue.splice(idx, 1);
		}
	}

	// ── Update ────────────────────────────────────────────────────────

	update(deltaMs: number): void {
		// Drain cooldowns
		for (const [key, remaining] of this.cooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.cooldowns.delete(key);
			else this.cooldowns.set(key, updated);
		}

		if (!this.executor) return;

		// Process approved entries
		for (const entry of [...this.queue]) {
			if (entry.approval !== "approved") continue;

			const execKey = `${entry.agentName}|${entry.toolId}`;
			if (this.executing.has(execKey)) continue;

			const tool = this.tools.get(entry.toolId);
			if (!tool) {
				this.removeFromQueue(entry);
				continue;
			}

			// Remove from queue and mark as executing
			this.removeFromQueue(entry);
			this.executing.add(execKey);

			// Apply template variable substitution
			const command = substituteVars(tool.command, entry.vars);

			// Start cooldown immediately
			this.cooldowns.set(execKey, tool.cooldownMs);

			void this.execute(entry.agentName, entry.toolId, command, execKey);
		}
	}

	// ── Private helpers ───────────────────────────────────────────────

	private async execute(
		agentName: string,
		toolId: string,
		command: string,
		execKey: string,
	): Promise<void> {
		try {
			const result = await this.executor!(command);
			this.emitResult({ agentName, toolId, success: result.success, output: result.output });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.emitResult({ agentName, toolId, success: false, output: message });
		} finally {
			this.executing.delete(execKey);
		}
	}

	private removeFromQueue(entry: QueueEntry): void {
		const idx = this.queue.indexOf(entry);
		if (idx !== -1) this.queue.splice(idx, 1);
	}

	private emitResult(result: ToolResult): void {
		for (const cb of this.resultCallbacks) {
			cb(result);
		}
	}
}

// ── Template variable substitution ───────────────────────────────────

/**
 * Replace {key} placeholders in a command string with values from vars.
 * Unknown placeholders are left as-is.
 */
function substituteVars(command: string, vars: Record<string, string>): string {
	return command.replace(/\{(\w+)\}/g, (_match, key: string) => {
		return key in vars ? vars[key] : `{${key}}`;
	});
}
