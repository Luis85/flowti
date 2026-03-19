/**
 * CLI-based agent executor — spawns and manages CLI agent processes.
 *
 * Replaces HttpAgentService + server-launcher + api-client with direct
 * process management. Each agent runs as a `node .flowti/bin/main.mjs agent:start`
 * child process with JSONL communication over stdin/stdout.
 *
 * PID files live at `.flowti/var/agents/<slug>.pid`.
 * Event logs live at `.flowti/var/agents/<slug>.events.jsonl`.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import {
	existsSync, readFileSync, writeFileSync, mkdirSync,
	unlinkSync, readdirSync, statSync, openSync, readSync, closeSync,
} from "node:fs";
import { join } from "node:path";
import { tailJsonlFile } from "./file-watcher.js";

/* ------------------------------------------------------------------ */
/*  Public types                                                       */
/* ------------------------------------------------------------------ */

export interface CliEvent {
	ts: number;
	type:
		| "message-in"
		| "thinking"
		| "using-tool"
		| "tool-complete"
		| "response"
		| "task-started"
		| "task-completed"
		| "permission-request"
		| "error";
	agent: string;
	text?: string;
	tool?: string;
	id?: string;
	status?: string;
}

export interface AgentProcess {
	readonly agentName: string;
	readonly running: boolean;
	send(message: string, context?: string): void;
	onEvent(cb: (event: CliEvent) => void): () => void;
	replayFrom(offset: number): CliEvent[];
	stopGeneration(): void;
	grantPermission(tool: string, decision: string): void;
	kill(): void;
}

export interface ICliExecutor {
	startAgent(agentName: string): AgentProcess;
	assignTask(agentName: string, task: string): Promise<{ ok: boolean; taskId?: string }>;
	grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean }>;
	listAgents(): Promise<{ name: string; domain?: string; status: string }[]>;
	wakeAgent(agentName: string): Promise<{ ok: boolean; state?: string }>;
	killAll(): void;
	dispose(): void;
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

interface TrackedProcess {
	child: ChildProcess;
	eventCallbacks: Set<(event: CliEvent) => void>;
	logWatcherClose: (() => void) | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Resolve the system Node.js binary path. Cached after first lookup. */
let cachedNodeBin: string | null | undefined;
export function findNodeBinary(): string | null {
	if (cachedNodeBin !== undefined) return cachedNodeBin;
	try {
		const cmd = process.platform === "win32" ? "where node" : "which node";
		const result = execSync(cmd, { encoding: "utf-8", timeout: 5000, windowsHide: true }).trim();
		cachedNodeBin = result.split(/\r?\n/)[0] || null;
	} catch {
		cachedNodeBin = null;
	}
	return cachedNodeBin;
}

/** Reset the cached node binary (for testing). */
export function resetNodeBinaryCache(): void {
	cachedNodeBin = undefined;
}

function agentsDir(vaultPath: string): string {
	return join(vaultPath, ".flowti", "var", "agents");
}

function pidFilePath(vaultPath: string, slug: string): string {
	return join(agentsDir(vaultPath), `${slug}.pid`);
}

function eventLogPath(vaultPath: string, slug: string): string {
	return join(agentsDir(vaultPath), `${slug}.events.jsonl`);
}

function ensureDir(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

function isProcessAlive(pid: number): boolean {
	try {
		if (process.platform === "win32") {
			const out = execSync(`tasklist /FI "PID eq ${pid}" /NH`, {
				encoding: "utf-8", timeout: 5000, windowsHide: true,
			});
			return out.includes(String(pid));
		}
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function treeKill(pid: number): boolean {
	try {
		if (process.platform === "win32") {
			execSync(`taskkill /F /T /PID ${pid}`, { windowsHide: true, timeout: 5000 });
		} else {
			try { process.kill(-pid, "SIGTERM"); } catch { process.kill(pid, "SIGTERM"); }
		}
		return true;
	} catch {
		return false;
	}
}

function readPidFile(filePath: string): number | null {
	try {
		if (!existsSync(filePath)) return null;
		const raw = readFileSync(filePath, "utf-8").trim();
		const pid = parseInt(raw, 10);
		return isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

function writePidFile(filePath: string, pid: number): void {
	ensureDir(join(filePath, ".."));
	writeFileSync(filePath, String(pid), "utf-8");
}

function removePidFile(filePath: string): void {
	try { unlinkSync(filePath); } catch { /* already gone */ }
}

/** Parse JSONL lines from a byte range of a file. */
function readJsonlRange(filePath: string, fromOffset: number): { events: CliEvent[]; bytesRead: number } {
	const events: CliEvent[] = [];
	try {
		if (!existsSync(filePath)) return { events, bytesRead: 0 };
		const size = statSync(filePath).size;
		if (size <= fromOffset) return { events, bytesRead: 0 };

		const bytesToRead = size - fromOffset;
		const buffer = Buffer.alloc(bytesToRead);
		const fd = openSync(filePath, "r");
		try {
			readSync(fd, buffer, 0, bytesToRead, fromOffset);
		} finally {
			closeSync(fd);
		}

		const text = buffer.toString("utf-8");
		const lines = text.split("\n");
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			try {
				events.push(JSON.parse(trimmed) as CliEvent);
			} catch {
				/* malformed line — skip */
			}
		}
		return { events, bytesRead: bytesToRead };
	} catch {
		return { events, bytesRead: 0 };
	}
}

/** Run a one-shot CLI command and parse the JSON response. */
async function runOneShotCommand(
	nodeBin: string,
	cliBin: string,
	args: string[],
	cwd: string,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const child = spawn(nodeBin, [cliBin, ...args], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		let stdout = "";
		let stderr = "";

		if (child.stdout) {
			child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
		}
		if (child.stderr) {
			child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
		}

		child.on("error", (err) => {
			reject(new Error(`Failed to execute CLI command: ${err.message}`));
		});

		child.on("close", (code) => {
			if (code !== 0 && !stdout.trim()) {
				reject(new Error(`CLI exited with code ${code}: ${stderr.trim()}`));
				return;
			}
			try {
				const parsed: unknown = JSON.parse(stdout.trim());
				resolve(parsed);
			} catch {
				reject(new Error(`Failed to parse CLI output as JSON: ${stdout.slice(0, 200)}`));
			}
		});
	});
}

/* ------------------------------------------------------------------ */
/*  AgentProcess implementation                                        */
/* ------------------------------------------------------------------ */

class AgentProcessImpl implements AgentProcess {
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

	startAgent(agentName: string): AgentProcess {
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

		// Parse stdout line-by-line for JSONL events
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
						const event = JSON.parse(trimmed) as CliEvent;
						for (const cb of tracked.eventCallbacks) {
							try { cb(event); } catch { /* subscriber error */ }
						}
					} catch {
						/* non-JSON output — ignore */
					}
				}
			});
		}

		// Set up event log tailing via file watcher
		const logFile = eventLogPath(this.vaultPath, slug);
		try {
			const watcher = tailJsonlFile(logFile, (data) => {
				const event = data as CliEvent;
				for (const cb of tracked.eventCallbacks) {
					try { cb(event); } catch { /* subscriber error */ }
				}
			});
			tracked.logWatcherClose = () => watcher.close();
		} catch {
			/* file-watcher not available — stdout-only mode */
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
