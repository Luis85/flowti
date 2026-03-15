/**
 * types.ts — Cross-cutting type definitions for the Flowti CLI.
 */

import type fs from "node:fs";

// ── File system abstraction ────────────────────────────────────────

export interface DirEntry {
	name: string;
	isDirectory(): boolean;
	isFile(): boolean;
}

export interface IFileSystem {
	readFileSync(path: string, encoding: BufferEncoding): string;
	writeFileSync(path: string, content: string, encoding: BufferEncoding): void;
	existsSync(path: string): boolean;
	mkdirSync(path: string, options?: fs.MakeDirectoryOptions): void;
	readdirSync(path: string): string[];
	readdirSync(path: string, options: { withFileTypes: true }): DirEntry[];
	copyFileSync(src: string, dest: string): void;
	rmSync(path: string, options?: fs.RmOptions): void;
	unlinkSync(path: string): void;
	statSync(path: string): fs.Stats;
}

// ── Shell execution abstraction ──────────────────────────────────────

export interface BackgroundProcess {
	/** Wait for a line matching the pattern in stdout/stderr; resolves with the matched line or null on timeout. */
	waitForOutput(pattern: RegExp, timeoutMs?: number): Promise<string | null>;
	/** Wait for the process to exit; resolves with exit code. */
	waitForExit(timeoutMs?: number): Promise<number>;
	/** Subscribe to live output lines. Returns an unsubscribe function. */
	onOutput(callback: (line: string) => void): () => void;
	/** Kill the background process. */
	kill(): void;
	/** Whether the process is still running. */
	readonly running: boolean;
	/** Collected output lines (stdout + stderr) for diagnostics. */
	readonly output: string[];
}

export interface IShell {
	/** Run a command with inherited stdio, return exit code. */
	run(cmd: string, opts?: { cwd?: string; label?: string; env?: Record<string, string> }): number;
	/** Run a command silently, return trimmed stdout or null on error. */
	runSilent(cmd: string, opts?: { cwd?: string }): string | null;
	/** Run a command and check if it succeeds (exit code 0). */
	check(cmd: string): boolean;
	/** Run an executable file with args, return trimmed stdout or null on error. */
	execFile(cmd: string, args: string[], opts?: { timeout?: number; stdio?: string }): string | null;
	/** Run a command capturing both stdout and stderr, return combined output. */
	runCapture(cmd: string, opts?: { cwd?: string; timeout?: number }): string;
	/** Run a command capturing output and exit code. */
	runCaptureStatus(cmd: string, opts?: { cwd?: string; timeout?: number }): { output: string; exitCode: number };
	/** Run a command capturing stdout, stderr, and exit code separately. */
	runCaptureDetailed(cmd: string, opts?: { cwd?: string; timeout?: number; env?: Record<string, string> }): { stdout: string; stderr: string; exitCode: number };
	/** Spawn a command in the background with piped stdout/stderr. */
	spawnBackground(cmd: string, opts?: { cwd?: string; env?: Record<string, string> }): BackgroundProcess;
	/** Run a command asynchronously, return exit code and captured output. Optionally pipe `input` to stdin and stream lines via `onLine`. */
	runAsync(cmd: string, opts?: { cwd?: string; timeout?: number; input?: string; onLine?: (line: string) => void }): Promise<{ output: string; exitCode: number }>;
	/** Run multiple commands in parallel, return results in order. */
	runParallel(cmds: string[], opts?: { cwd?: string; timeout?: number }): Promise<{ output: string; exitCode: number }[]>;
}

// ── Agent shell abstraction ──────────────────────────────────────────

export interface ProviderConfig {
	readonly binary: string;
	readonly streamArgs: readonly string[];
	readonly textArgs: readonly string[];
}

export interface TalkOptions {
	readonly thinkingDisplay?: "full" | "indicator" | "hidden";
	readonly character?: import("../domain/agents/agent-conversation.js").AgentCharacter;
	readonly idleTimeoutMs?: number;
}

export interface TalkResult {
	readonly response: import("../domain/agents/agent-conversation.js").AgentResponse;
	readonly thinking: string;
	readonly detached: boolean;
}

export interface TalkSession {
	onEvent(callback: (event: import("../domain/agents/agent-stream.js").AgentStreamEvent) => void): () => void;
	readonly result: Promise<TalkResult | null>;
	detach(): void;
}

export interface DispatchOptions {
	readonly iterDir?: string;
	readonly iterationNumber?: number;
}

export interface DispatchHandle {
	onEvent(callback: (event: import("../domain/agents/agent-stream.js").AgentStreamEvent) => void): () => void;
	readonly sessionId: string;
	readonly agentName: string;
	readonly task: string;
	readonly running: boolean;
	stop(): void;
}

export interface PendingQuestion {
	readonly agentName: string;
	readonly persona?: string;
	readonly question: string;
	readonly agent: import("../domain/agents/agent-types.js").AgentSummary;
	readonly briefPath: string;
	readonly task: string;
	readonly opts?: DispatchOptions;
}

export interface IAgentShell {
	talk(agent: import("../domain/agents/agent-types.js").AgentSummary, prompt: string, opts?: TalkOptions): TalkSession;
	dispatch(agent: import("../domain/agents/agent-types.js").AgentSummary, briefPath: string, task: string, opts?: DispatchOptions): DispatchHandle;
	getActiveDispatch(agentName: string): DispatchHandle | null;
	reconcileStaleAgents(): { recovered: string[] };
	pendingQuestions(): PendingQuestion[];
	answerAgent(agentName: string, answer: string): Promise<void>;
}

// ── Process abstraction ──────────────────────────────────────────────

export interface IProcess {
	/** Terminate the process with exit code. */
	exit(code: number): never;
	/** Command-line arguments (process.argv.slice(2)). */
	argv(): string[];
	/** Current working directory. */
	cwd(): string;
	/** Environment variables. */
	env(): Record<string, string | undefined>;
}

// ── Path operations abstraction ──────────────────────────────────────

export interface IPaths {
	join(...segments: string[]): string;
	resolve(...segments: string[]): string;
	dirname(p: string): string;
	basename(p: string, ext?: string): string;
	relative(from: string, to: string): string;
	extname(p: string): string;
	isAbsolute(p: string): boolean;
	readonly sep: string;
}

// ── Clock abstraction ───────────────────────────────────────────────

export interface IClock {
	/** Current date/time. */
	now(): Date;
	/** Millisecond timestamp (like Date.now()). */
	ms(): number;
	/** ISO 8601 timestamp string. */
	iso(): string;
	/** Filename-safe timestamp (colons replaced with dashes). */
	safeIso(): string;
}

// ── User input abstraction ──────────────────────────────────────────

export interface IInput {
	ask(question: string, defaultValue?: string): Promise<string>;
	askAbortable(question: string): { promise: Promise<string>; abort: () => void };
	askYesNo(question: string, defaultNo?: boolean): Promise<boolean>;
	waitForEnter(): Promise<void>;
}

// ── CLI argument parsing ────────────────────────────────────────────

export interface ParsedArgs {
	command: string | null;
	flags: Record<string, string | boolean>;
}

// ── Menu system ─────────────────────────────────────────────────────

export type MenuResult = "main" | "quit" | "start" | "refresh" | void;

export interface MenuItem {
	key: string;
	label: string;
	action: () => MenuResult | Promise<MenuResult>;
	disabled?: boolean | (() => boolean);
	disabledMessage?: string;
	/** Visual grouping — separators inserted between different groups automatically. */
	group?: string;
}

export interface MenuSeparator {
	separator: true;
}

export type MenuEntry = MenuItem | MenuSeparator;

export interface MenuOptions {
	defaultChoice?: string;
	onAgentQuestion?: () => Promise<MenuResult | undefined>;
	renderStatusBar?: () => void;
}

// ── Lifecycle entity type (kept here — imported by types-config.ts) ──

export type EntityType = "project" | "product" | "feature" | "iteration" | "brief";

// ── World state types ────────────────────────────────────────────────

export type { IWorldStateManager, WorldState, WorldEntity, AgentAction, AgentActionType, PermissionEntry, ActivityEntry, WorldEntityType } from "../domain/agents/world-state-types.js";

// ── Re-export all config types for backward compatibility ───────────

export * from "./types-config.js";
