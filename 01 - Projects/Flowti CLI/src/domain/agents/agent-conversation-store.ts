/**
 * agent-conversation-store.ts — Conversation persistence for the Talk flow.
 *
 * Stores per-agent conversation threads in .flowti/var/conversations/.
 * Pure functions with injected deps.
 */

import type { CliDeps } from "../../infrastructure/deps.js";

export type ConversationStoreDeps = Pick<CliDeps, "disk" | "paths">;

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly content: string;
	readonly ts: string;
	readonly thinking?: string;
}

export interface ConversationThread {
	readonly id: string;
	readonly startedAt: string;
	readonly lastActivity: string;
	readonly turns: ConversationTurn[];
}

export interface ConversationFile {
	readonly agent: string;
	readonly threads: ConversationThread[];
	readonly activeThread: string | null;
}

function emptyConversation(agentName: string): ConversationFile {
	return { agent: agentName, threads: [], activeThread: null };
}

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function loadConversation(deps: ConversationStoreDeps, dir: string, agentName: string): ConversationFile {
	const filePath = deps.paths.join(dir, "conversations", `${slugify(agentName)}.json`);
	if (!deps.disk.existsSync(filePath)) return emptyConversation(agentName);
	try {
		const raw = deps.disk.readFileSync(filePath, "utf-8");
		return JSON.parse(raw) as ConversationFile;
	} catch { return emptyConversation(agentName); }
}

export function saveConversation(deps: ConversationStoreDeps, dir: string, agentName: string, data: ConversationFile): void {
	const convDir = deps.paths.join(dir, "conversations");
	if (!deps.disk.existsSync(convDir)) deps.disk.mkdirSync(convDir, { recursive: true });
	const filePath = deps.paths.join(convDir, `${slugify(agentName)}.json`);
	deps.disk.writeFileSync(filePath, JSON.stringify(data, null, "\t"), "utf-8");
}

export function createThread(data: ConversationFile, id: string, startedAt: string): ConversationFile {
	const thread: ConversationThread = { id, startedAt, lastActivity: startedAt, turns: [] };
	return { ...data, threads: [...data.threads, thread], activeThread: id };
}

export function appendTurn(data: ConversationFile, turn: ConversationTurn): ConversationFile {
	if (!data.activeThread) return data;
	const threads = data.threads.map((t) =>
		t.id === data.activeThread ? { ...t, turns: [...t.turns, turn], lastActivity: turn.ts } : t,
	);
	return { ...data, threads };
}

export function getActiveHistory(data: ConversationFile, maxTurns = 20): ConversationTurn[] {
	if (!data.activeThread) return [];
	const thread = data.threads.find((t) => t.id === data.activeThread);
	if (!thread) return [];
	return thread.turns.slice(-maxTurns);
}
