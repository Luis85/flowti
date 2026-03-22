/**
 * Helper utilities for CLI executor — types, process management, and I/O helpers.
 *
 * Extracted from cli-executor.ts to stay under max-lines.
 */

import { spawn, execSync, type ChildProcess } from "node:child_process";
import {
	existsSync, readFileSync, writeFileSync, mkdirSync,
	unlinkSync, statSync, openSync, readSync, closeSync,
} from "node:fs";
import { join } from "node:path";

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
		| "done"
		| "task-started"
		| "task-completed"
		| "permission-request"
		| "error";
	agent: string;
	/** Final assistant text (preferred). */
	text?: string;
	/** Some CLI builds stream `response` before normalizing to `text`. */
	response?: string;
	tool?: string;
	id?: string;
	status?: string;
}

export interface AgentProcess {
	readonly agentName: string;
	readonly running: boolean;
	/** Child process id while running; use for OS-level metrics. */
	getPid(): number | null;
	send(message: string, context?: string): void;
	/** Send a raw JSONL payload to the CLI subprocess stdin. */
	sendRaw(payload: Record<string, unknown>): void;
	onEvent(cb: (event: CliEvent) => void): () => void;
	replayFrom(offset: number): CliEvent[];
	stopGeneration(): void;
	grantPermission(tool: string, decision: string): void;
	kill(): void;
}

/** Whether this machine can spawn `agent:start` (Node on PATH + vault CLI bundle). */
export interface CliHostReadiness {
	readonly canSpawnAgents: boolean;
	readonly nodePath: string | null;
	readonly cliBinaryPath: string;
	readonly cliBinaryExists: boolean;
	readonly issues: readonly string[];
}

export interface ICliExecutor {
	startAgent(agentName: string): AgentProcess;
	assignTask(agentName: string, task: string): Promise<{ ok: boolean; taskId?: string }>;
	grantPermission(agentName: string, tool: string, decision: string): Promise<{ ok: boolean }>;
	listAgents(): Promise<{ name: string; domain?: string; status: string }[]>;
	wakeAgent(agentName: string): Promise<{ ok: boolean; state?: string }>;
	killAll(): void;
	dispose(): void;
	/** Optional: host checks for Agent World (Node + `.flowti/bin/main.mjs`). */
	getHostReadiness?(): CliHostReadiness;
}

/* ------------------------------------------------------------------ */
/*  Internal types                                                     */
/* ------------------------------------------------------------------ */

export interface TrackedProcess {
	child: ChildProcess;
	eventCallbacks: Set<(event: CliEvent) => void>;
	logWatcherClose: (() => void) | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function slugify(name: string): string {
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

export function agentsDir(vaultPath: string): string {
	return join(vaultPath, ".flowti", "var", "agents");
}

export function pidFilePath(vaultPath: string, slug: string): string {
	return join(agentsDir(vaultPath), `${slug}.pid`);
}

export function eventLogPath(vaultPath: string, slug: string): string {
	return join(agentsDir(vaultPath), `${slug}.events.jsonl`);
}

export function ensureDir(dirPath: string): void {
	if (!existsSync(dirPath)) {
		mkdirSync(dirPath, { recursive: true });
	}
}

export function isProcessAlive(pid: number): boolean {
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

export function treeKill(pid: number): boolean {
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

export function readPidFile(filePath: string): number | null {
	try {
		if (!existsSync(filePath)) return null;
		const raw = readFileSync(filePath, "utf-8").trim();
		const pid = parseInt(raw, 10);
		return isNaN(pid) ? null : pid;
	} catch {
		return null;
	}
}

export function writePidFile(filePath: string, pid: number): void {
	ensureDir(join(filePath, ".."));
	writeFileSync(filePath, String(pid), "utf-8");
}

export function removePidFile(filePath: string): void {
	try { unlinkSync(filePath); } catch { /* already gone */ }
}

/** Parse JSONL lines from a byte range of a file. */
export function readJsonlRange(filePath: string, fromOffset: number): { events: CliEvent[]; bytesRead: number } {
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

/**
 * Run a one-shot CLI command and parse the JSON response.
 * @param timeoutMs Max wait in ms; kills the child on expiry. Use `0` to disable.
 */
export async function runOneShotCommand(
	nodeBin: string,
	cliBin: string,
	args: string[],
	cwd: string,
	timeoutMs: number = 60_000,
): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const child = spawn(nodeBin, [cliBin, ...args], {
			cwd,
			stdio: ["ignore", "pipe", "pipe"],
			windowsHide: true,
		});

		let settled = false;
		let stdout = "";
		let stderr = "";

		const finish = (action: () => void): void => {
			if (settled) return;
			settled = true;
			if (timer) clearTimeout(timer);
			action();
		};

		const timer = timeoutMs > 0
			? setTimeout(() => {
				finish(() => {
					const pid = child.pid;
					if (pid != null) treeKill(pid);
					else child.kill();
					reject(new Error(`CLI command timed out after ${timeoutMs}ms`));
				});
			}, timeoutMs)
			: null;

		if (child.stdout) {
			child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
		}
		if (child.stderr) {
			child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
		}

		child.on("error", (err) => {
			finish(() => {
				reject(new Error(`Failed to execute CLI command: ${err.message}`));
			});
		});

		child.on("close", (code) => {
			finish(() => {
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
	});
}
