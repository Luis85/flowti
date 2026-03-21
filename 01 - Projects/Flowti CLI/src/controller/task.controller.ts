/**
 * task.controller.ts — CLI commands for task management.
 *
 * Provides task:list, task:create, and task:assign commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import { taskStore } from "../domain/tasks/task-store.js";
import { canTransition } from "../domain/tasks/task-lifecycle.js";
import { renderTaskList, renderTaskCreated, renderTaskUpdated } from "../ui/displays/task-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"task:list": adaptDescriptor({
		flags: {
			status: { type: "string", default: "", hint: "--status=<status>" },
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
		},
		handler: (ctx) => {
			const all = taskStore.list(ctx.deps, VAULT_ROOT);
			const filtered = all.filter(t => {
				if (ctx.flags.status && t.status !== ctx.flags.status) return false;
				if (ctx.flags.assignee && (t.assignee ?? "") !== ctx.flags.assignee) return false;
				return true;
			});
			return {
				tasks: filtered.map(t => ({
					id: t.id,
					title: t.title,
					type: t.type,
					status: t.status,
					assignee: t.assignee ?? "",
					priority: t.priority,
					reward: t.reward,
				})),
			};
		},
		renderer: renderTaskList,
	}),

	"task:create": adaptDescriptor({
		flags: {
			title: { type: "string", required: true, hint: "--title=<text>" },
			type: { type: "string", default: "one-off", choices: ["one-off", "standing-order", "delegated", "self-proposed"], hint: "--type=<type>" },
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
			priority: { type: "string", default: "normal", choices: ["normal", "high", "urgent"], hint: "--priority=<level>" },
			trustTier: { type: "string", default: "review", choices: ["auto", "review", "manual"], hint: "--trust=<tier>" },
			xp: { type: "number", default: 50, hint: "--xp=<amount>" },
			coin: { type: "number", default: 25, hint: "--coin=<amount>" },
		},
		handler: (ctx) => {
			const id = `task-${ctx.deps.clock.safeIso()}`;
			const def = {
				id,
				type: ctx.flags.type as "one-off",
				title: ctx.flags.title as string,
				assignee: ctx.flags.assignee as string,
				creator: "director",
				priority: ctx.flags.priority as "normal",
				trustTier: ctx.flags.trustTier as "review",
				status: "pending" as const,
				reward: { xp: ctx.flags.xp as number, coin: ctx.flags.coin as number },
				tags: [],
				createdAt: ctx.deps.clock.iso(),
			};
			taskStore.create(ctx.deps, VAULT_ROOT, def);
			return { id, title: def.title };
		},
		renderer: renderTaskCreated,
	}),

	"task:assign": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
			to: { type: "string", required: true, hint: "--to=<agent-name>" },
		},
		handler: (ctx) => {
			const task = taskStore.read(ctx.deps, VAULT_ROOT, ctx.flags.id as string);
			if (!task) return { id: ctx.flags.id as string, field: "error", value: "task not found" };
			if (!canTransition(task.status, "assigned")) return { id: task.id, field: "error", value: `cannot assign from status ${task.status}` };
			taskStore.updateField(ctx.deps, VAULT_ROOT, task.id, "assignee", ctx.flags.to as string);
			taskStore.updateField(ctx.deps, VAULT_ROOT, task.id, "status", "assigned");
			return { id: task.id, field: "assignee", value: ctx.flags.to as string };
		},
		renderer: renderTaskUpdated,
	}),
};
