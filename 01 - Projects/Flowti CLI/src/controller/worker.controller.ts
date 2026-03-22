/**
 * worker.controller.ts — CLI commands for worker management.
 *
 * Provides worker:status, worker:queue, worker:reassign,
 * worker:pause, and worker:resume commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { taskStore } from "../domain/tasks/task-store.js";
import { agentStore } from "../domain/agents/agent-store.js";
import { renderWorkerStatus, renderWorkerQueue, renderWorkerReassigned, renderWorkerPaused, renderWorkerResumed } from "../ui/displays/worker-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

const PAUSE_FLAG_PATH = ".flowti/var/worker-paused.json";

/** Build a TaskStoreDeps-compatible object from CliDeps. */
function taskDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
			readdirSync: (p: string) => deps.disk.readdirSync(p) as string[],
			unlinkSync: (p: string) => deps.disk.unlinkSync(p),
		},
		paths: deps.paths,
	};
}

// ── Helpers ───────────────────────────────────────────────────────

function readPausedSet(deps: { disk: { existsSync(p: string): boolean; readFileSync(p: string, enc?: string): string }; paths: { join(...s: string[]): string } }): Set<string> {
	const path = deps.paths.join(VAULT_ROOT, PAUSE_FLAG_PATH);
	if (!deps.disk.existsSync(path)) return new Set();
	try {
		const raw = deps.disk.readFileSync(path, "utf-8");
		const parsed = JSON.parse(raw) as { paused?: string[] };
		return new Set(parsed.paused ?? []);
	} catch {
		return new Set();
	}
}

function writePausedSet(deps: { disk: { writeFileSync(p: string, c: string, enc?: string): void; mkdirSync(p: string, opts?: { recursive?: boolean }): void }; paths: { join(...s: string[]): string; dirname(p: string): string } }, paused: Set<string>): void {
	const path = deps.paths.join(VAULT_ROOT, PAUSE_FLAG_PATH);
	const dir = deps.paths.dirname(path);
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(path, JSON.stringify({ paused: [...paused] }, null, "\t"));
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"worker:status": adaptDescriptor({
		flags: {},
		handler: (ctx) => {
			const agents = agentStore.list(ctx.deps, VAULT_ROOT);
			const tasks = taskStore.list(taskDeps(ctx.deps), VAULT_ROOT);
			const paused = readPausedSet(ctx.deps);
			const liveWorkers = ctx.deps.workerManager.listWorkers();
			const workerStateMap = new Map(liveWorkers.map(w => [w.name, w.state]));

			const workers = agents.map(a => {
				const activeTaskCount = tasks.filter(t => t.assignee === a.name && (t.status === "assigned" || t.status === "in-progress")).length;
				const standingOrderCount = tasks.filter(t => t.assignee === a.name && t.type === "standing-order").length;
				const state = workerStateMap.get(a.name) ?? "stopped";
				return {
					name: a.name,
					state,
					activeTaskCount,
					standingOrderCount,
					paused: paused.has(a.name),
				};
			});

			return { workers };
		},
		renderer: renderWorkerStatus,
	}),

	"worker:queue": adaptDescriptor({
		flags: {},
		handler: (ctx) => {
			const all = taskStore.list(taskDeps(ctx.deps), VAULT_ROOT);
			const queued = all.filter(t => t.status === "pending" || t.status === "assigned");
			return {
				tasks: queued.map(t => ({
					id: t.id,
					title: t.title,
					status: t.status,
					assignee: t.assignee ?? "",
					priority: t.priority,
				})),
			};
		},
		renderer: renderWorkerQueue,
	}),

	"worker:reassign": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
			to: { type: "string", required: true, hint: "--to=<agent-name>" },
		},
		handler: (ctx) => {
			const id = ctx.flags.id as string;
			const to = ctx.flags.to as string;
			const task = taskStore.read(taskDeps(ctx.deps), VAULT_ROOT, id);
			if (!task) return { id, to, ok: false, error: "task not found" };
			taskStore.updateField(taskDeps(ctx.deps), VAULT_ROOT, task.id, "assignee", to);
			return { id: task.id, to, ok: true };
		},
		renderer: renderWorkerReassigned,
	}),

	"worker:pause": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const paused = readPausedSet(ctx.deps);
			paused.add(agent);
			writePausedSet(ctx.deps, paused);
			return { agent, ok: true };
		},
		renderer: renderWorkerPaused,
	}),

	"worker:resume": adaptDescriptor({
		flags: {
			agent: { type: "string", required: true, hint: "--agent=<name>" },
		},
		handler: (ctx) => {
			const agent = ctx.flags.agent as string;
			const paused = readPausedSet(ctx.deps);
			paused.delete(agent);
			writePausedSet(ctx.deps, paused);
			return { agent, ok: true };
		},
		renderer: renderWorkerResumed,
	}),
};
