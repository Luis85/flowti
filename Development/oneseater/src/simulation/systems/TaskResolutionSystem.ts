import { createSystem, ReadEvents, WriteEvents, WriteResource, ReadResource } from "sim-ecs";
import { TaskFinishedEvent } from "src/eventsystem/tasks/TaskFinishedEvent";
import { TaskSuccessEvent } from "src/eventsystem/tasks/TaskSuccessEvent";
import { mkId } from "src/messages/utils";
import { PLAYER_MAX_ENERGY, PLAYER_MIN_ENERGY } from "src/models/Player";
import { TaskContext, TaskOutcome, ResolutionRecord } from "src/models/Task";
import { GurpsDice } from "src/utils/TheDice";
import { SimulationStore } from "../stores/SimulationStore";
import { TaskStore } from "../stores/TaskStore";
import { clamp } from "../utils";
import { getLevelFromXP } from "./player/LevelSystem";


export const TaskResolutionSystem = createSystem({
	finished: ReadEvents(TaskFinishedEvent),
	success: WriteEvents(TaskSuccessEvent),

	tasks: WriteResource(TaskStore),
	sim: WriteResource(SimulationStore),
	dice: ReadResource(GurpsDice),
})
	.withRunFunction(async ({ finished, success, tasks, sim, dice }) => {
		for (const evt of finished.iter()) {
			// 1) Idempotenz
			if (tasks.hasResolved(evt.taskId)) continue;

			// 2) Context Snapshot: nimm die "essentials" aus evt + ggf Message Snapshot
			const ctx: TaskContext = buildTaskContextFromFinished(evt, sim);

			// Optional: tasksById pflegen (damit du später eine Task-Historie hast)
			tasks.tasksById.set(ctx.taskId, ctx);

			// 3) PlayerSkill Snapshot (minimal)
			const skill = getPlayerSkill(sim, ctx.skillKey);

			// 4) Difficulty -> GURPS modifier
			const modifier = mapDifficultyToGurpsModifier(ctx.difficulty);

			// 5) Gurps dice roll
			const rollResult = dice.roll({
				targetNumber: skill.level,
				modifier,
				description: `${ctx.kind}${ctx.action ? `:${ctx.action}` : ""}`,
			});

			// 6) Map dice outcome -> TaskOutcome
			const outcome: TaskOutcome = mapGurpsOutcomeToTaskOutcome(
				rollResult.outcome
			);

			// 7) Rewards (V1: base from evt/context + multipliers by outcome)
			const mult = outcomeMultiplier(outcome);
			const xp = Math.max(
				0,
				Math.round((evt.xpGain ?? ctx.baseXp) * mult)
			);

			const energyCost = evt.energyCost ?? ctx.baseEnergyCost;
			const timeCostMin = evt.timeCostMinutes ?? ctx.baseTimeCostMin;

			const record: ResolutionRecord = {
				id: newId("res"),
				taskId: ctx.taskId,
				createdAtIso: evt.finishedAtIso,
				context: ctx,
				roll: {
					outcome,
					score: rollResult.total,
					threshold: rollResult.effectiveTarget,
					modifiers: [
						{
							key: "gurps_modifier",
							value: modifier,
							note: rollResult.summary,
						},
						...(rollResult.isCritical
							? [{ key: "critical", value: 1 }]
							: []),
					],
				},
				rewards: { xp, energyCost, timeCostMin },
			};

			tasks.appendResolution(record);

			// 8) Apply rewards to player (XP/energy/time)
			applyRewards(sim, record);

			// 9) Fire success event (auch wenn outcome partial/fail ist)
			success.publish({
				type: "task:success",
				taskId: ctx.taskId,
				resolutionId: record.id,
				finishedAtIso: evt.finishedAtIso,
				outcome,
				xpGranted: xp,
				energyCost,
				timeCostMin,
			});
		}
	})
	.build();

// ---------- helpers ----------
function mapGurpsOutcomeToTaskOutcome(o: string): TaskOutcome {
	switch (o) {
		case "critical-success":
			return "crit_success";
		case "success":
			return "success";
		case "failure":
			return "fail";
		case "critical-failure":
			return "crit_fail";
		default:
			return "fail";
	}
}

function outcomeMultiplier(o: TaskOutcome): number {
	switch (o) {
		case "crit_success":
			return 1.5;
		case "success":
			return 1.0;
		case "partial":
			return 0.5;
		case "fail":
			return 0.1;
		case "crit_fail":
			return 0.0;
	}
}

function mapDifficultyToGurpsModifier(d: number): number {
	if (d <= 15) return +4;
	if (d <= 30) return +2;
	if (d <= 55) return 0;
	if (d <= 70) return -2;
	if (d <= 80) return -4;
	if (d <= 90) return -6;
	if (d <= 97) return -8;
	return -10;
}
function buildTaskContextFromFinished(
	evt: Readonly<TaskFinishedEvent>,
	sim: SimulationStore
): TaskContext {
	let skillKey = "chores"
	let id = mkId(Math.random()*10, Math.random()*10, Math.random()*10) + '-chores';
	if(evt.messageId) {
		const message = sim.findMessage(evt.messageId)
		skillKey = message ? message.type : skillKey
		id = evt.messageId
	}
	
	return {
		taskId: id,
		source: "inbox",
		kind: "message:read",
		difficulty: 0,
		baseXp: 0,
		baseEnergyCost: 0,
		baseTimeCostMin: 0,
		skillKey,
	};
}

function getPlayerSkill(sim: SimulationStore, skillKey: string) {
	return { level: 12, key: "chores" };
}

function newId(arg0: string): string {
	return (
		mkId(Math.random() * 100, Math.random() * 100, Math.random() * 100) +
		arg0
	);
}

type ApplyRewardsResult = {
	xpGained: number;
	energySpent: number;
	timeSpentMinutes: number;
	completedTasksAdded: number;
	playerLevel: number;
	becameExhausted: boolean;
};

export function applyRewards(
	sim: SimulationStore,
	record: ResolutionRecord
): ApplyRewardsResult {
	const player = sim.player;
	const stats = player.stats;

	const xpGained = Math.max(0, record.rewards.xp ?? 0);
	const energySpent = Math.max(0, record.rewards.energyCost ?? 0);
	const timeSpentMinutes = Math.max(0, record.rewards.timeCostMin ?? 0);

	// 1) XP
	stats.xp = (stats.xp ?? 0) + xpGained;

	// 2) Task counters
	stats.completedTasks = (stats.completedTasks ?? 0) + 1;
	stats.timeSpentMinutes = (stats.timeSpentMinutes ?? 0) + timeSpentMinutes;

	// 3) Energy (sleeping bleibt unangetastet – Tasks sollten dort eh nicht passieren)
	let becameExhausted = false;
	if (player.status !== "sleeping") {
		const before = Number.isFinite(stats.energy) ? stats.energy : PLAYER_MAX_ENERGY;
		const after = clamp(before - energySpent, PLAYER_MIN_ENERGY, PLAYER_MAX_ENERGY);
		stats.energy = after;

		// Statuswechsel: exhausted wenn Energy auf 0 fällt
		if (before > 0 && after === 0) {
			player.status = "exhausted";
			stats.exhaustedSleepStacks = (stats.exhaustedSleepStacks ?? 0) + 1;
			becameExhausted = true;
		} else {
			// Wenn nicht exhausted: idle → active (optional “feel good”)
			// Exhausted bleibt exhausted, bis ein anderes System (Sleep/Recover) ihn rauszieht.
			if (player.status === "idle") player.status = "active";
			if (player.status === "active" && after === 0) player.status = "exhausted";
		}
	}

	// 4) Level ableiten (nicht speichern)
	const playerLevel = getLevelFromXP(stats.xp).level;

	return {
		xpGained,
		energySpent,
		timeSpentMinutes,
		completedTasksAdded: 1,
		playerLevel,
		becameExhausted,
	};
}
