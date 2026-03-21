/**
 * CLI-based agent executor — spawns and manages Flowti CLI agent processes.
 *
 * Each agent runs as `node .flowti/bin/main.mjs agent:start` with JSONL over
 * stdin/stdout. Tasks and permissions use one-shot CLI invocations.
 *
 * PID files: `.flowti/var/agents/<slug>.pid`
 * Event logs: `.flowti/var/agents/<slug>.events.jsonl`
 */

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type {
	CliEvent, AgentProcess as IAgentProcess, ICliExecutor, TrackedProcess, CliHostReadiness,
} from "./cli-executor-helpers";
import {
	slugify, findNodeBinary, agentsDir, pidFilePath, eventLogPath,
	ensureDir, isProcessAlive, treeKill, readPidFile, writePidFile,
	removePidFile, readJsonlRange, runOneShotCommand,
} from "./cli-executor-helpers";

// Re-export public API types and helpers that external consumers rely on
export type { CliEvent, ICliExecutor, TrackedProcess } from "./cli-executor-helpers";
export type { AgentProcess } from "./cli-executor-helpers";
export { findNodeBinary, resetNodeBinaryCache } from "./cli-executor-helpers";

/* ------------------------------------------------------------------ */
/*  AgentProcess implementation                                        */
/* ------------------------------------------------------------------ */

class AgentProcessImpl implements IAgentProcess {
	readonly agentName: string;
	private tracked: TrackedProcess;
	private vaultPath: string;
	private slug: string;

	constructor(agentName: string, tracked: TrackedProcess, vaultPath: string) {
		this.agentName = agentName;
		this.tracked = tracked;
		this.vaultPath = vaultPath;
		this.slug = slugify(agentName);
	}

	get running(): boolean {
		const child = this.tracked.child;
		return child.exitCode === null && !child.killed;
	}

	getPid(): number | null {
		const pid = this.tracked.child.pid;
		return typeof pid === "number" ? pid : null;
	}

	send(message: string, context?: string): void {
		const payload = context
			? { type: "message", text: message, context }
			: { type: "message", text: message };
		this.writeStdin(JSON.stringify(payload));
	}

	onEvent(cb: (event: CliEvent) => void): () => void {
		this.tracked.eventCallbacks.add(cb);
		return () => { this.tracked.eventCallbacks.delete(cb); };
	}

	replayFrom(offset: number): CliEvent[] {
		const logFile = eventLogPath(this.vaultPath, this.slug);
		const { events } = readJsonlRange(logFile, offset);
		return events;
	}

	stopGeneration(): void {
		this.writeStdin(JSON.stringify({ type: "stop-generation" }));
	}

	grantPermission(tool: string, decision: string): void {
		this.writeStdin(JSON.stringify({ type: "grant-permission", tool, decision }));
	}

	kill(): void {
		const child = this.tracked.child;
		if (child.pid && child.exitCode === null) {
			treeKill(child.pid);
		}
		const pidFile = pidFilePath(this.vaultPath, this.slug);
		removePidFile(pidFile);
		if (this.tracked.logWatcherClose) {
			this.tracked.logWatcherClose();
			this.tracked.logWatcherClose = null;
		}
	}

	private writeStdin(data: string): void {
		const stdin = this.tracked.child.stdin;
		if (stdin && !stdin.destroyed) {
			stdin.write(data + "\n");
		}
	}
}

/* ------------------------------------------------------------------ */
/*  CliExecutor implementation                                         */
/* ------------------------------------------------------------------ */

export class CliExecutor implements ICliExecutor {
	private vaultPath: string;
	private cliBin: string;
	private nodeBin: string | null;
	private processes = new Map<string, TrackedProcess>();

	constructor(vaultBasePath: string) {
		this.vaultPath = vaultBasePath;
		this.cliBin = join(vaultBasePath, ".flowti", "bin", "main.mjs");
		this.nodeBin = findNodeBinary();
	}

	/** True when Node is on PATH and the Flowti CLI bundle exists in the vault. */
	getHostReadiness(): CliHostReadiness {
		const issues: string[] = [];
		const nodePath = findNodeBinary();
		const cliBinaryExists = existsSync(this.cliBin);
		if (!nodePath) {
			issues.push(
				"Node.js was not found on PATH. Install Node and restart Obsidian (or your host app) so agent sessions can spawn.",
			);
		}
		if (!cliBinaryExists) {
			issues.push(
				`Flowti CLI bundle missing at ${this.cliBin}. Build or sync the CLI into this vault.`,
			);
		}
		return {
			canSpawnAgents: Boolean(nodePath && cliBinaryExists),
			nodePath,
			cliBinaryPath: this.cliBin,
			cliBinaryExists,
			issues,
		};
	}

	startAgent(agentName: string): IAgentProcess {
		const slug = slugify(agentName);
		const pidFile = pidFilePath(this.vaultPath, slug);

		// Kill any existing process for this agent
		const existingPid = readPidFile(pidFile);
		if (existingPid !== null) {
			if (isProcessAlive(existingPid)) {
				treeKill(existingPid);
			}
			removePidFile(pidFile);
		}

		// Clean up any tracked process
		const existing = this.processes.get(slug);
		if (existing) {
			if (existing.logWatcherClose) existing.logWatcherClose();
			this.processes.delete(slug);
		}

		if (!this.nodeBin) {
			throw new Error("Node.js not found on PATH. Install Node.js to run CLI agents.");
		}

		if (!existsSync(this.cliBin)) {
			throw new Error(`CLI binary not found at ${this.cliBin}. Run the Flowti CLI build first.`);
		}

		const child = spawn(this.nodeBin, [this.cliBin, "agent:start", `--agent=${agentName}`], {
			cwd: this.vaultPath,
			stdio: ["pipe", "pipe", "pipe"],
			windowsHide: true,
		});

		const tracked: TrackedProcess = {
			child,
			eventCallbacks: new Set(),
			logWatcherClose: null,
		};
		this.processes.set(slug, tracked);

		// Write PID file
		if (child.pid) {
			ensureDir(agentsDir(this.vaultPath));
			writePidFile(pidFile, child.pid);
		}

		const emitEvent = (event: CliEvent) => {
			for (const cb of tracked.eventCallbacks) {
				try { cb(event); } catch { /* subscriber error */ }
			}
		};

		// For spawned processes, stdout is the single source of truth.
		let stdoutPartial = "";
		if (child.stdout) {
			child.stdout.on("data", (chunk: Buffer) => {
				const text = stdoutPartial + chunk.toString();
				const lines = text.split("\n");
				stdoutPartial = lines.pop() ?? "";

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						emitEvent(JSON.parse(trimmed) as CliEvent);
					} catch {
						/* non-JSON output — ignore */
					}
				}
			});
		}

		// Clean up on process exit
		child.on("close", () => {
			removePidFile(pidFile);
			if (tracked.logWatcherClose) {
				tracked.logWatcherClose();
				tracked.logWatcherClose = null;
			}
		});

		return new AgentProcessImpl(agentName, tracked, this.vaultPath);
	}

	async assignTask(agentName: string, task: string): Promise<{ ok: boolean; taskId?: string }> {
		if (!this.nodeBin) return { ok: false };
		try {
			const result = await runOneShotCommand(
				this.nodeBin, this.cliBin,
				["agent:task", `--agent=${agentName}`, `--task=${task}`, "--format=json"],
				this.vaultPath,
			);
			const data = result as Record<string, unknown>;
			return {
				ok: true,
				taskId: typeof data.taskId === "string" ? data.taskId : undefined,
			};
		} catch {
			return { ok: false };
		}
	}

	async grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean }> {
		if (!this.nodeBin) return { ok: false };
		try {
			await runOneShotCommand(
				this.nodeBin, this.cliBin,
				["agent:permission", `--agent=${agentName}`, `--tool=${tool}`, `--decision=${decision}`, "--format=json"],
				this.vaultPath,
			);
			return { ok: true };
		} catch {
			return { ok: false };
		}
	}

	async listAgents(): Promise<{ name: string; domain?: string; status: string }[]> {
		if (!this.nodeBin) return [];
		try {
			const result = await runOneShotCommand(
				this.nodeBin, this.cliBin,
				["agent:list", "--format=json"],
				this.vaultPath,
			);
			if (Array.isArray(result)) {
				return result.map((item: Record<string, unknown>) => ({
					name: String(item.name ?? ""),
					domain: typeof item.domain === "string" ? item.domain : undefined,
					status: String(item.status ?? "unknown"),
				}));
			}
			return [];
		} catch {
			return [];
		}
	}

	async wakeAgent(agentName: string): Promise<{ ok: boolean; state?: string }> {
		if (!this.nodeBin) return { ok: false };
		try {
			const result = await runOneShotCommand(
				this.nodeBin, this.cliBin,
				["agent:wake", `--agent=${agentName}`, "--format=json"],
				this.vaultPath,
			);
			const data = result as Record<string, unknown>;
			return {
				ok: true,
				state: typeof data.state === "string" ? data.state : undefined,
			};
		} catch {
			return { ok: false };
		}
	}

	killAll(): void {
		const dir = agentsDir(this.vaultPath);
		// Kill tracked processes first
		for (const [slug, tracked] of this.processes) {
			const pid = tracked.child.pid;
			if (pid && tracked.child.exitCode === null) {
				treeKill(pid);
			}
			if (tracked.logWatcherClose) {
				tracked.logWatcherClose();
			}
			const pidFile = pidFilePath(this.vaultPath, slug);
			removePidFile(pidFile);
		}
		this.processes.clear();

		// Also kill any orphaned processes from PID files
		try {
			if (!existsSync(dir)) return;
			const files = readdirSync(dir).filter((f) => f.endsWith(".pid"));
			for (const file of files) {
				const filePath = join(dir, file);
				const pid = readPidFile(filePath);
				if (pid !== null) {
					treeKill(pid);
				}
				removePidFile(filePath);
			}
		} catch {
			/* directory may not exist */
		}
	}

	dispose(): void {
		this.killAll();
		this.processes.clear();
	}
}
