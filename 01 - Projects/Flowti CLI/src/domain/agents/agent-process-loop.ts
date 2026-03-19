/**
 * agent-process-loop.ts — Persistent stdin/stdout JSONL loop for a single agent.
 *
 * Handles the lifecycle of an agent process that communicates via JSONL on
 * stdin (inbound commands) and stdout (outbound events). Used by the
 * serverless CLI architecture to run agents as long-lived child processes.
 */

import type { IFileSystem, IPaths, IClock } from "../../infrastructure/types.js";
import type { IWorkerManager } from "./worker-types.js";
import type { IWorldStateManager, AgentActionType } from "./world-state-types.js";
import type { AgentStreamEvent } from "./agent-stream.js";

// ── Deps ─────────────────────────────────────────────────────────────

/** Abstraction for stdin line reading — avoids direct `node:readline` import. */
export interface ILineReader {
	onLine(callback: (line: string) => void): void;
	close(): void;
}

/** Abstraction for stdout writing — avoids direct `process.stdout` usage. */
export interface ILineWriter {
	write(line: string): void;
}

export interface AgentProcessLoopDeps {
	readonly workerManager: IWorkerManager;
	readonly worldState: IWorldStateManager;
	readonly disk: IFileSystem;
	readonly paths: IPaths;
	readonly clock: IClock;
	readonly vaultRoot: string;
	readonly agentName: string;
	readonly pid: number;
	readonly lineReader: ILineReader;
	readonly lineWriter: ILineWriter;
	readonly exit: (code: number) => void;
}

// ── Handle ───────────────────────────────────────────────────────────

export interface AgentProcessLoopHandle {
	readonly agentName: string;
	start(): void;
	dispose(): void;
}

// ── Helpers ──────────────────────────────────────────────────────────

const MAX_EVENT_LOG_LINES = 1000;

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function agentsDir(deps: Pick<AgentProcessLoopDeps, "paths" | "vaultRoot">): string {
	return deps.paths.join(deps.vaultRoot, ".flowti", "var", "agents");
}

function pidFilePath(deps: Pick<AgentProcessLoopDeps, "paths" | "vaultRoot" | "agentName">): string {
	return deps.paths.join(agentsDir(deps), `${slugify(deps.agentName)}.pid`);
}

function eventLogPath(deps: Pick<AgentProcessLoopDeps, "paths" | "vaultRoot" | "agentName">): string {
	return deps.paths.join(agentsDir(deps), `${slugify(deps.agentName)}-events.jsonl`);
}

function prevEventLogPath(deps: Pick<AgentProcessLoopDeps, "paths" | "vaultRoot" | "agentName">): string {
	return deps.paths.join(agentsDir(deps), `${slugify(deps.agentName)}-events.prev.jsonl`);
}

function ensureDir(deps: Pick<AgentProcessLoopDeps, "disk" | "paths" | "vaultRoot">): void {
	const dir = agentsDir(deps);
	if (!deps.disk.existsSync(dir)) {
		deps.disk.mkdirSync(dir, { recursive: true });
	}
}

function countLines(deps: Pick<AgentProcessLoopDeps, "disk">, filePath: string): number {
	if (!deps.disk.existsSync(filePath)) return 0;
	const content = deps.disk.readFileSync(filePath, "utf-8");
	if (!content) return 0;
	return content.split("\n").filter((l) => l.length > 0).length;
}

function rotateEventLog(deps: AgentProcessLoopDeps): void {
	const logPath = eventLogPath(deps);
	if (countLines(deps, logPath) >= MAX_EVENT_LOG_LINES) {
		const prevPath = prevEventLogPath(deps);
		const content = deps.disk.readFileSync(logPath, "utf-8");
		deps.disk.writeFileSync(prevPath, content, "utf-8");
		deps.disk.writeFileSync(logPath, "", "utf-8");
	}
}

function mapStreamEventToType(event: AgentStreamEvent): string {
	switch (event.kind) {
		case "thinking": return "thinking";
		case "tool-start": return "using-tool";
		case "tool-end": return "tool-complete";
		case "text": return "response";
		case "error": return "error";
		case "done": return "done";
		default: return event.kind;
	}
}

function buildEventLine(deps: Pick<AgentProcessLoopDeps, "clock" | "agentName">, type: string, text: string): string {
	const payload = {
		ts: deps.clock.ms(),
		type,
		agent: deps.agentName,
		text,
	};
	return JSON.stringify(payload);
}

function extractText(event: AgentStreamEvent): string {
	if ("text" in event) return event.text;
	if ("message" in event) return (event as { message: string }).message;
	if (event.kind === "tool-start") return event.name;
	if (event.kind === "tool-end") return event.id;
	return "";
}

function writeEvent(deps: AgentProcessLoopDeps, type: string, text: string): void {
	const line = buildEventLine(deps, type, text);
	deps.lineWriter.write(line + "\n");
	appendToEventLog(deps, line);
}

function appendToEventLog(deps: AgentProcessLoopDeps, line: string): void {
	const logPath = eventLogPath(deps);
	if (deps.disk.existsSync(logPath)) {
		const existing = deps.disk.readFileSync(logPath, "utf-8");
		deps.disk.writeFileSync(logPath, existing + line + "\n", "utf-8");
	} else {
		deps.disk.writeFileSync(logPath, line + "\n", "utf-8");
	}
}

// ── Stdin message types ──────────────────────────────────────────────

interface MessageInput {
	readonly type: "message";
	readonly text: string;
	readonly context?: string;
}

interface StopGenerationInput {
	readonly type: "stop-generation";
}

interface GrantPermissionInput {
	readonly type: "grant-permission";
	readonly tool: string;
	readonly decision: "granted" | "denied";
}

interface KillInput {
	readonly type: "kill";
}

type StdinMessage = MessageInput | StopGenerationInput | GrantPermissionInput | KillInput;

function parseStdinMessage(line: string): StdinMessage | null {
	try {
		const parsed = JSON.parse(line) as Record<string, unknown>;
		if (typeof parsed.type !== "string") return null;
		return parsed as unknown as StdinMessage;
	} catch {
		return null;
	}
}

// ── Dispatch ─────────────────────────────────────────────────────────

function handleMessage(deps: AgentProcessLoopDeps, msg: MessageInput): void {
	const contextPrefix = msg.context ? `${msg.context}\n\n` : "";
	const fullText = contextPrefix + msg.text;
	deps.workerManager.send(deps.agentName, fullText, {
		onEvent(event: AgentStreamEvent) {
			const type = mapStreamEventToType(event);
			const text = extractText(event);
			writeEvent(deps, type, text);
		},
		onResponse(response) {
			writeEvent(deps, "response", response.message);
		},
	});
}

function handleStopGeneration(deps: AgentProcessLoopDeps): void {
	deps.workerManager.stop(deps.agentName);
}

function handleGrantPermission(deps: AgentProcessLoopDeps, msg: GrantPermissionInput): void {
	const actionType: AgentActionType = msg.decision === "granted" ? "permission-granted" : "permission-denied";
	deps.worldState.emitAction({
		id: `perm-${deps.clock.ms()}`,
		agentName: deps.agentName,
		timestamp: deps.clock.iso(),
		type: actionType,
		data: { tool: msg.tool },
	});
}

function dispatch(deps: AgentProcessLoopDeps, disposeFn: () => void, msg: StdinMessage): void {
	switch (msg.type) {
		case "message":
			handleMessage(deps, msg);
			break;
		case "stop-generation":
			handleStopGeneration(deps);
			break;
		case "grant-permission":
			handleGrantPermission(deps, msg as GrantPermissionInput);
			break;
		case "kill":
			disposeFn();
			deps.exit(0);
			break;
	}
}

// ── Factory ──────────────────────────────────────────────────────────

export function createAgentProcessLoop(deps: AgentProcessLoopDeps): AgentProcessLoopHandle {
	let disposed = false;

	function writePidFile(): void {
		deps.disk.writeFileSync(pidFilePath(deps), String(deps.pid), "utf-8");
	}

	function removePidFile(): void {
		const path = pidFilePath(deps);
		if (deps.disk.existsSync(path)) {
			deps.disk.unlinkSync(path);
		}
	}

	function dispose(): void {
		if (disposed) return;
		disposed = true;
		removePidFile();
		deps.lineReader.close();
	}

	return {
		agentName: deps.agentName,

		start(): void {
			ensureDir(deps);
			writePidFile();
			rotateEventLog(deps);

			deps.lineReader.onLine((line: string) => {
				if (disposed) return;
				const trimmed = line.trim();
				if (!trimmed) return;
				const msg = parseStdinMessage(trimmed);
				if (!msg) return;
				dispatch(deps, dispose, msg);
			});
		},

		dispose,
	};
}
