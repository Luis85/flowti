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
import { textFromWorkerResponsePayload } from "../../lib/worker-response-text.js";

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
	readonly dispatcher?: import("../tasks/task-dispatcher.js").TaskDispatcher;
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

function buildEventLine(deps: Pick<AgentProcessLoopDeps, "clock" | "agentName">, type: string, text: string, extra?: Record<string, string>): string {
	const payload: Record<string, unknown> = {
		ts: deps.clock.ms(),
		type,
		agent: deps.agentName,
		text,
		...extra,
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

/** Extract tool metadata for richer event logging. */
function extractToolMeta(event: AgentStreamEvent): Record<string, string> | undefined {
	if (event.kind === "tool-start") return { tool: event.name, id: event.id };
	if (event.kind === "tool-end") return { tool: event.id, id: event.id };
	return undefined;
}

/** Extract a human-readable summary from tool input JSON. */
function summarizeToolInput(toolName: string, json: string): string | null {
	try {
		const input = JSON.parse(json) as Record<string, unknown>;
		switch (toolName) {
			case "Read": return `Reading ${input.file_path ?? input.path ?? "file"}`;
			case "Write": return `Writing ${input.file_path ?? input.path ?? "file"}`;
			case "Edit": return `Editing ${input.file_path ?? input.path ?? "file"}`;
			case "Bash": return `Running: ${String(input.command ?? "").slice(0, 60)}`;
			case "Glob": return `Searching for ${input.pattern ?? "files"}`;
			case "Grep": return `Searching for "${input.pattern ?? ""}"`;
			case "Agent": return `Spawning agent: ${input.description ?? "task"}`;
			case "WebSearch": return `Searching: ${input.query ?? "web"}`;
			case "WebFetch": return `Fetching: ${String(input.url ?? "").slice(0, 60)}`;
			default: {
				const keys = Object.keys(input).slice(0, 2);
				if (keys.length > 0) {
					const firstVal = String(input[keys[0]] ?? "").slice(0, 50);
					return firstVal ? `Using ${toolName}: ${firstVal}` : `Using ${toolName}`;
				}
				return `Using ${toolName}`;
			}
		}
	} catch {
		return null;
	}
}

function writeEvent(deps: AgentProcessLoopDeps, type: string, text: string, extra?: Record<string, string>): void {
	const line = buildEventLine(deps, type, text, extra);
	deps.lineWriter.write(line + "\n");
	appendToEventLog(deps, line);
}

/**
 * Append a line to the event log.
 * NOTE: Uses read-then-write pattern (O(n²) for long sessions).
 * Should migrate to appendFileSync when IFileSystem supports it.
 */
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

interface AgentSelectedInput {
	readonly type: "agent-selected";
}

interface AgentDeselectedInput {
	readonly type: "agent-deselected";
}

interface BtActionInput {
	readonly type: "bt-action";
	readonly action: string;
	readonly data: {
		readonly goal?: string;
		readonly goalType?: string;
		readonly context?: string;
		readonly task?: string;
	};
}

type StdinMessage = MessageInput | StopGenerationInput | GrantPermissionInput | KillInput | AgentSelectedInput | AgentDeselectedInput | BtActionInput;

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
	let lastToolName = "";
	let lastToolEmitted = false;
	deps.workerManager.send(deps.agentName, fullText, {
		onEvent(event: AgentStreamEvent) {
			// Skip streaming text chunks — onResponse will emit the complete response
			if (event.kind === "text") return;
			const type = mapStreamEventToType(event);
			const text = extractText(event);
			const meta = extractToolMeta(event);
			if (event.kind === "tool-start") {
				lastToolName = event.name;
				lastToolEmitted = false;
				return; // Don't emit — tool-input will emit with richer context
			}
			// For tool-input, write a single enriched summary for this tool use
			if (event.kind === "tool-input") {
				if (!lastToolEmitted) {
					const summary = summarizeToolInput(lastToolName, event.json);
					if (summary) {
						writeEvent(deps, "using-tool", summary, { tool: lastToolName });
						lastToolEmitted = true;
					}
				}
				return;
			}
			// Emit a fallback using-tool if tool-input never produced a summary
			if (event.kind === "tool-end" && !lastToolEmitted) {
				writeEvent(deps, "using-tool", lastToolName, { tool: lastToolName });
			}
			writeEvent(deps, type, text, meta);
		},
		onResponse(response) {
			writeEvent(deps, "response", textFromWorkerResponsePayload(response));
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

function handleAgentSelected(deps: AgentProcessLoopDeps): void {
	deps.workerManager.prime(deps.agentName);
}

function handleAgentDeselected(deps: AgentProcessLoopDeps): void {
	deps.workerManager.stop(deps.agentName);
}

function handleBtAction(deps: AgentProcessLoopDeps, msg: BtActionInput): void {
	if (msg.action !== "goal-started" && msg.action !== "task-started") return;
	const subject = msg.data.goal ?? msg.data.task ?? "";
	if (!subject) return;

	// Route through task dispatcher when available
	if (deps.dispatcher) {
		deps.dispatcher.submit({
			taskId: `bt-${deps.clock.ms()}`,
			title: subject,
			priority: "normal",
			requiredCapabilities: [],
			requiredAgentTier: "supervised",
			taskTrustTier: "auto",
			reward: { xp: 10, coin: 5 },
			submittedAt: deps.clock.ms(),
			source: "bt-action",
			targetAgent: deps.agentName,
			retryCount: 0,
			tags: [],
			type: msg.data.goalType ?? "bt-goal",
		});
		return;
	}

	// Fallback: direct workerManager.send (backward compat)
	const contextPrefix = msg.data.context ? `${msg.data.context}\n\n` : "";
	const fullMessage = contextPrefix + subject;
	let lastToolName = "";
	let lastToolEmitted = false;
	deps.workerManager.send(deps.agentName, fullMessage, {
		task: msg.data.task,
		onEvent(event: AgentStreamEvent) {
			if (event.kind === "text") return;
			const type = mapStreamEventToType(event);
			const text = extractText(event);
			const meta = extractToolMeta(event);
			if (event.kind === "tool-start") {
				lastToolName = event.name;
				lastToolEmitted = false;
				return;
			}
			if (event.kind === "tool-input") {
				if (!lastToolEmitted) {
					const summary = summarizeToolInput(lastToolName, event.json);
					if (summary) {
						writeEvent(deps, "using-tool", summary, { tool: lastToolName });
						lastToolEmitted = true;
					}
				}
				return;
			}
			if (event.kind === "tool-end" && !lastToolEmitted) {
				writeEvent(deps, "using-tool", lastToolName, { tool: lastToolName });
			}
			writeEvent(deps, type, text, meta);
		},
		onResponse(response) {
			writeEvent(deps, "response", textFromWorkerResponsePayload(response));
		},
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
		case "agent-selected":
			handleAgentSelected(deps);
			break;
		case "agent-deselected":
			handleAgentDeselected(deps);
			break;
		case "bt-action":
			handleBtAction(deps, msg as BtActionInput);
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
