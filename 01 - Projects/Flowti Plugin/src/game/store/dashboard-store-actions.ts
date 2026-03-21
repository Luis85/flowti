/**
 * dashboard-store-actions.ts — Task execution and assignment helpers.
 *
 * Extracted from DashboardStore to reduce file size. These functions
 * operate on the store via its public API.
 */

import type { DashboardStore } from "./dashboard-store.js";
import type { AgentProcess, ICliExecutor } from "../../infrastructure/agents/cli-executor.js";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Saves agent task output to a markdown file in the vault.
 * Returns the vault-relative path on success, or null.
 */
export function saveTaskOutput(
	vaultBasePath: string | null,
	agentName: string,
	taskName: string,
	content: string,
): string | null {
	if (!vaultBasePath) return null;
	try {
		const slug = taskName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
		const date = new Date().toISOString().slice(0, 10);
		const agentSlug = agentName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
		const dir = join(vaultBasePath, "03 - Resources", "Agents", "output", agentSlug);
		const filename = `${slug}-${date}.md`;
		const filePath = join(dir, filename);

		if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
		writeFileSync(filePath, content, "utf-8");

		return `03 - Resources/Agents/output/${agentSlug}/${filename}`;
	} catch {
		return null;
	}
}

/**
 * Runs a tool command in a child process and feeds the result back to the agent.
 */
export function runToolCommand(
	agentName: string,
	task: { name: string; tool?: { command: string } },
	proc: AgentProcess,
	pushDebugEntry: (agentName: string, prompt: string, context?: string) => void,
): void {
	if (!task.tool) return;

	const args = task.tool.command.split(/\s+/);
	const cmd = args.shift()!;

	void import("node:child_process").then(({ execFile }) => {
		execFile(cmd, args, { timeout: 120_000 }, (error, stdout, stderr) => {
			const output = [`[Tool output for "${task.name}"]`, "", stdout];
			if (stderr) output.push("[stderr]", stderr);
			if (error) output.push(`[exit code: ${error.code ?? "unknown"}]`);

			proc.send(output.join("\n"));
			pushDebugEntry(agentName, output.join("\n"), "tool-output");
		});
	});
}

/**
 * Assigns a task to an agent via the CLI executor.
 */
export async function assignTaskViaExecutor(
	store: DashboardStore,
	cliExecutor: ICliExecutor | null,
	agentName: string,
	task: string,
): Promise<{ ok: boolean; error?: string }> {
	const tasks = store.assignedTasks.get(agentName) ?? [];
	tasks.push({ name: task, status: "pending", assignedAt: Date.now() });
	store.assignedTasks.set(agentName, tasks);

	store.pushDebugEntry(agentName, `[TASK] ${task}`);
	store.dispatchEvent(new CustomEvent("task-assigned", { detail: { agentName, task } }));

	if (!cliExecutor) {
		const idx = tasks.findIndex((t) => t.name === task && t.status === "pending");
		if (idx >= 0) tasks.splice(idx, 1);
		return { ok: false, error: "CLI executor not available" };
	}

	const result = await cliExecutor.assignTask(agentName, task);
	if (result.ok) {
		const entry = tasks.find((t) => t.name === task && t.status === "pending");
		if (entry) (entry as { status: string }).status = "in-progress";
		if (store.connectionStatus !== "connected") {
			store.setConnectionStatus("connected");
		}
	} else {
		const idx = tasks.findIndex((t) => t.name === task && t.status === "pending");
		if (idx >= 0) tasks.splice(idx, 1);
		console.warn(`[store] Task assignment failed for ${agentName}`);
	}
	return result;
}

export interface TaskSpec {
	name: string;
	phases: string[];
	input?: { type: "text"; prompt: string };
	tool?: { command: string };
}

/**
 * Builds the task prompt for LLM task execution.
 */
export function buildTaskPrompt(task: TaskSpec, userInput?: string): string {
	const inputLine = userInput ? `\nDirector's input: ${userInput}` : "";
	const toolInstruction = task.tool
		? `\nA tool has been dispatched: "${task.tool.command}". Its output will follow. Incorporate the results into your document.`
		: "";
	return `[Task Assignment]\nTask: ${task.name}${inputLine}${toolInstruction}\n\nProduce your output as a complete markdown document. Start with a heading. Be thorough but concise. Your entire response will be saved as a document in the vault.`;
}
