/**
 * task.controller.ts — CLI commands for task management.
 *
 * Provides task:list, task:create, task:assign, task:review, task:approve,
 * task:reject, and task:standing-orders commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";
import type { CliDeps } from "../infrastructure/deps.js";
import { taskStore } from "../domain/tasks/task-store.js";
import { canTransition } from "../domain/tasks/task-lifecycle.js";
import { readLedger, writeLedger, creditReward, appendTransaction } from "../domain/economy/economy-ledger.js";
import { renderTaskList, renderTaskCreated, renderTaskUpdated, renderTaskReview, renderTaskApproved, renderTaskRejected, renderStandingOrders } from "../ui/displays/task-display.js";
import { VAULT_ROOT } from "../infrastructure/config.js";

// ── Helpers ───────────────────────────────────────────────────────

/** Build a TaskStoreDeps-compatible object from CliDeps. */
function taskDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding) as string,
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
			readdirSync: (p: string) => deps.disk.readdirSync(p) as string[],
			unlinkSync: (p: string) => deps.disk.unlinkSync(p),
		},
		paths: deps.paths,
	};
}

/** Build a LedgerDeps-compatible object from CliDeps. */
function ledgerDeps(deps: CliDeps) {
	return {
		disk: {
			existsSync: (p: string) => deps.disk.existsSync(p),
			readFileSync: (p: string, enc?: string) => deps.disk.readFileSync(p, (enc ?? "utf-8") as BufferEncoding),
			writeFileSync: (p: string, c: string) => deps.disk.writeFileSync(p, c, "utf-8"),
			mkdirSync: (p: string, opts?: { recursive?: boolean }) => deps.disk.mkdirSync(p, opts),
		},
		paths: deps.paths,
		clock: deps.clock,
	};
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	"task:list": adaptDescriptor({
		flags: {
			status: { type: "string", default: "", hint: "--status=<status>" },
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
		},
		handler: (ctx) => {
			const all = taskStore.list(taskDeps(ctx.deps), VAULT_ROOT);
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
			taskStore.create(taskDeps(ctx.deps), VAULT_ROOT, def);
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
			const td = taskDeps(ctx.deps);
			const task = taskStore.read(td, VAULT_ROOT, ctx.flags.id as string);
			if (!task) return { id: ctx.flags.id as string, field: "error", value: "task not found" };
			if (!canTransition(task.status, "assigned")) return { id: task.id, field: "error", value: `cannot assign from status ${task.status}` };
			taskStore.updateField(td, VAULT_ROOT, task.id, "assignee", ctx.flags.to as string);
			taskStore.updateField(td, VAULT_ROOT, task.id, "status", "assigned");
			return { id: task.id, field: "assignee", value: ctx.flags.to as string };
		},
		renderer: renderTaskUpdated,
	}),

	"task:review": adaptDescriptor({
		flags: {},
		handler: (ctx) => {
			const all = taskStore.list(taskDeps(ctx.deps), VAULT_ROOT);
			const tasks = all.filter(t => t.status === "review");
			return {
				tasks: tasks.map(t => ({
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
		renderer: renderTaskReview,
	}),

	"task:approve": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
		},
		handler: (ctx) => {
			const td = taskDeps(ctx.deps);
			const task = taskStore.read(td, VAULT_ROOT, ctx.flags.id as string);
			if (!task) return { id: ctx.flags.id as string, ok: false, error: "task not found", xp: 0, coin: 0 };
			if (!canTransition(task.status, "completed")) return { id: task.id, ok: false, error: `cannot approve from status ${task.status}`, xp: 0, coin: 0 };
			const deps = ledgerDeps(ctx.deps);
			const ledger = readLedger(deps, VAULT_ROOT);
			const assignee = task.assignee ?? "";
			const { ledger: updated, reward } = creditReward(ledger, assignee, task.reward);
			writeLedger(deps, VAULT_ROOT, updated);
			appendTransaction(deps, VAULT_ROOT, {
				ts: ctx.deps.clock.iso(),
				agent: assignee,
				type: "task-reward",
				taskId: task.id,
				xp: reward.xp,
				coin: reward.coin,
			});
			taskStore.updateField(td, VAULT_ROOT, task.id, "status", "completed");
			taskStore.updateField(td, VAULT_ROOT, task.id, "completedAt", ctx.deps.clock.iso());
			return { id: task.id, ok: true, xp: reward.xp, coin: reward.coin };
		},
		renderer: renderTaskApproved,
	}),

	"task:reject": adaptDescriptor({
		flags: {
			id: { type: "string", required: true, hint: "--id=<task-id>" },
			reason: { type: "string", default: "", hint: "--reason=<text>" },
		},
		handler: (ctx) => {
			const td = taskDeps(ctx.deps);
			const task = taskStore.read(td, VAULT_ROOT, ctx.flags.id as string);
			if (!task) return { id: ctx.flags.id as string, ok: false, reason: ctx.flags.reason as string };
			if (!canTransition(task.status, "pending")) return { id: task.id, ok: false, reason: `cannot reject from status ${task.status}` };
			taskStore.updateField(td, VAULT_ROOT, task.id, "status", "pending");
			return { id: task.id, ok: true, reason: ctx.flags.reason as string };
		},
		renderer: renderTaskRejected,
	}),

	"task:standing-orders": adaptDescriptor({
		flags: {
			assignee: { type: "string", default: "", hint: "--assignee=<name>" },
		},
		handler: (ctx) => {
			const all = taskStore.list(taskDeps(ctx.deps), VAULT_ROOT);
			const orders = all.filter(t => {
				if (t.type !== "standing-order") return false;
				if (ctx.flags.assignee && (t.assignee ?? "") !== ctx.flags.assignee) return false;
				return true;
			});
			return {
				orders: orders.map(t => ({
					id: t.id,
					title: t.title,
					status: t.status,
					assignee: t.assignee ?? "",
					priority: t.priority,
				})),
			};
		},
		renderer: renderStandingOrders,
	}),
};
