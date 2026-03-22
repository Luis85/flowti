/** agent-session.ts — Session tracking for autonomous agent runs. */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentStreamEvent } from "./agent-stream.js";

// ── Types ────────────────────────────────────────────────────────────

export type SessionStatus = "spawning" | "running" | "completed" | "failed";

export interface AgentSession {
	readonly id: string;
	readonly agentName: string;
	readonly iterationNumber: number;
	readonly status: SessionStatus;
	readonly startedAt: string;
	readonly completedAt?: string;
	readonly briefRef: string;
	readonly outputLines: readonly string[];
}

export type SessionStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock"> & {
	readonly parseFrontmatter: (content: string) => Record<string, unknown> | null;
};

// ── Utilities ────────────────────────────────────────────────────────

function sessionsDir(deps: SessionStoreDeps, iterDir: string): string {
	const dir = deps.paths.join(iterDir, "sessions");
	if (!deps.disk.existsSync(dir)) deps.disk.mkdirSync(dir, { recursive: true });
	return dir;
}

function sessionFileName(id: string): string {
	return `session-${id}.md`;
}

function generateId(deps: SessionStoreDeps): string {
	return deps.clock.safeIso().replace(/[^a-zA-Z0-9]/g, "-").slice(0, 24);
}

function parseStatus(raw: unknown): SessionStatus {
	if (raw === "running") return "running";
	if (raw === "completed") return "completed";
	if (raw === "failed") return "failed";
	return "spawning";
}

function parseOutputLines(content: string): string[] {
	const marker = "## Output";
	const idx = content.indexOf(marker);
	if (idx === -1) return [];
	const after = content.slice(idx + marker.length).trim();
	if (!after) return [];
	return after.split("\n").filter((l) => l.trim().length > 0);
}

function buildSessionMarkdown(session: AgentSession): string {
	const lines: string[] = [
		"---",
		`id: ${session.id}`,
		`agent: ${session.agentName}`,
		`iteration: ${session.iterationNumber}`,
		`status: ${session.status}`,
		`startedAt: ${session.startedAt}`,
		session.completedAt ? `completedAt: ${session.completedAt}` : null,
		`briefRef: ${session.briefRef}`,
		"---",
		"",
		`# Agent Session: ${session.agentName}`,
		"",
		"## Output",
		"",
	].filter((l): l is string => l !== null);
	if (session.outputLines.length > 0) {
		lines.push(...session.outputLines);
	}
	return lines.join("\n") + "\n";
}

// ── CRUD ─────────────────────────────────────────────────────────────

/** Create a new session and persist it to disk. */
export function createSession(deps: SessionStoreDeps, iterDir: string, agentName: string, iterationNumber: number, briefRef: string): AgentSession {
	const id = generateId(deps);
	const session: AgentSession = {
		id, agentName, iterationNumber, status: "spawning",
		startedAt: deps.clock.iso(), briefRef, outputLines: [],
	};
	const dir = sessionsDir(deps, iterDir);
	deps.disk.writeFileSync(deps.paths.join(dir, sessionFileName(id)), buildSessionMarkdown(session), "utf-8");
	return session;
}

/** Update the status of an existing session. */
export function updateSessionStatus(deps: SessionStoreDeps, iterDir: string, sessionId: string, status: SessionStatus): boolean {
	const dir = deps.paths.join(iterDir, "sessions");
	const filePath = deps.paths.join(dir, sessionFileName(sessionId));
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^(status:\s*).*$/m, `$1${status}`);
	if (status === "completed" || status === "failed") {
		if (!content.includes("completedAt:")) {
			content = content.replace(/^(status:.*\n)/m, `$1completedAt: ${deps.clock.iso()}\n`);
		}
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Append output lines to a session's Output section. */
export function appendOutput(deps: SessionStoreDeps, iterDir: string, sessionId: string, lines: string[]): boolean {
	const dir = deps.paths.join(iterDir, "sessions");
	const filePath = deps.paths.join(dir, sessionFileName(sessionId));
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.trimEnd() + "\n" + lines.join("\n") + "\n";
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

function fmString(fm: Record<string, unknown> | null, key: string, fallback: string): string {
	const val = fm?.[key];
	return val !== undefined && val !== null ? String(val) : fallback;
}

function parseSessionFromContent(deps: SessionStoreDeps, content: string, fallbackId: string): AgentSession {
	const fm = deps.parseFrontmatter(content);
	return {
		id: fmString(fm, "id", fallbackId),
		agentName: fmString(fm, "agent", "unknown"),
		iterationNumber: Number(fm?.iteration ?? 0),
		status: parseStatus(fm?.status),
		startedAt: fmString(fm, "startedAt", ""),
		completedAt: fm?.completedAt ? String(fm.completedAt) : undefined,
		briefRef: fmString(fm, "briefRef", ""),
		outputLines: parseOutputLines(content),
	};
}

/** Read and parse a session from disk. */
export function getSession(deps: SessionStoreDeps, iterDir: string, sessionId: string): AgentSession | null {
	const dir = deps.paths.join(iterDir, "sessions");
	const filePath = deps.paths.join(dir, sessionFileName(sessionId));
	if (!deps.disk.existsSync(filePath)) return null;
	return parseSessionFromContent(deps, deps.disk.readFileSync(filePath, "utf-8"), sessionId);
}

/** List all sessions, optionally filtered by iteration number. */
export function listSessions(deps: SessionStoreDeps, iterDir: string, iterationNumber?: number): AgentSession[] {
	const dir = deps.paths.join(iterDir, "sessions");
	if (!deps.disk.existsSync(dir)) return [];
	const files = deps.disk.readdirSync(dir).filter((f) => f.startsWith("session-") && f.endsWith(".md"));
	const sessions: AgentSession[] = [];
	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const session = parseSessionFromContent(deps, content, file.replace(/^session-|\.md$/g, ""));
		if (iterationNumber === undefined || session.iterationNumber === iterationNumber) {
			sessions.push(session);
		}
	}
	return sessions;
}

// ── Structured output ─────────────────────────────────────────────────

export interface TimestampedEvent { readonly kind: AgentStreamEvent["kind"]; readonly ts: string; readonly [key: string]: unknown; }

/** Persist structured JSON output and update the session markdown summary. */
export function appendStructuredOutput(
	deps: SessionStoreDeps, iterDir: string, sessionId: string,
	events: readonly TimestampedEvent[], usage?: { inputTokens: number; outputTokens: number },
): boolean {
	const sessionsDir = deps.paths.join(iterDir, "sessions");
	const jsonPath = deps.paths.join(sessionsDir, `${sessionId}.json`);
	const data = { id: sessionId, events, usage };
	deps.disk.writeFileSync(jsonPath, JSON.stringify(data, null, "\t"), "utf-8");
	const mdPath = deps.paths.join(sessionsDir, sessionFileName(sessionId));
	if (deps.disk.existsSync(mdPath)) {
		let content = deps.disk.readFileSync(mdPath, "utf-8");
		const summary = renderSessionSummary(events as readonly AgentStreamEvent[]);
		content = content.replace(/## Output[\s\S]*$/, summary);
		deps.disk.writeFileSync(mdPath, content, "utf-8");
	}
	return true;
}

/** Render a markdown summary of agent stream events. */
export function renderSessionSummary(events: readonly AgentStreamEvent[]): string {
	const lines: string[] = ["## Output", ""];
	if (events.length === 0) { lines.push("_No output captured._", ""); return lines.join("\n"); }
	const thinking = events.filter((e) => e.kind === "thinking").map((e) => (e as { text: string }).text).join("");
	const tools = events.filter((e) => e.kind === "tool-start") as Array<{ kind: "tool-start"; id: string; name: string }>;
	const text = events.filter((e) => e.kind === "text").map((e) => (e as { text: string }).text).join("");
	const usage = events.find((e) => e.kind === "usage") as { inputTokens: number; outputTokens: number } | undefined;
	if (thinking) {
		lines.push("### Thinking", "", `> ${thinking.slice(0, 200)}${thinking.length > 200 ? "..." : ""}`, "");
	}
	if (tools.length > 0) {
		lines.push("### Tool Usage", "");
		for (const t of tools) lines.push(`- \`${t.name}\``);
		lines.push("");
	}
	if (text) {
		lines.push("### Response", "", text, "");
	}
	if (usage) {
		lines.push("### Usage", "", `- Input: ${usage.inputTokens} tokens | Output: ${usage.outputTokens} tokens`, "");
	}
	return lines.join("\n");
}
