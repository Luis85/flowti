/**
 * room-intent-resolver.ts — Resolves room-level interaction intents.
 *
 * Evaluates RoomInteractionRules against environment conditions
 * (occupancy, collective mood, phase) to produce Interactions
 * where the room is the initiator and all occupants are targets.
 */

import type {
	RoomInteractionRule,
	EnvironmentCondition,
} from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import type {
	DayPhase,
	Interaction,
	InteractionEntityType,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";

// ── Config ──────────────────────────────────────────────────────────

export interface RoomResolverConfig {
	readonly roomId: string;
	readonly roomType: string;
	readonly rules: readonly RoomInteractionRule[];
	readonly getOccupancy: () => number;
	readonly getOccupantIds: () => string[];
	readonly getCollectiveMood: () => { mood: string; intensity: number };
	readonly getPhase: () => string;
}

// ── Condition Evaluation ────────────────────────────────────────────

function evaluateCondition(
	condition: EnvironmentCondition,
	config: RoomResolverConfig,
): boolean {
	switch (condition.type) {
		case "occupancy": {
			const occupancy = config.getOccupancy();
			switch (condition.op) {
				case ">": return occupancy > condition.value;
				case "<": return occupancy < condition.value;
				case "==": return occupancy === condition.value;
			}
			break;
		}
		case "collective-mood": {
			const collective = config.getCollectiveMood();
			return collective.mood === condition.mood
				&& collective.intensity >= condition.threshold;
		}
		case "phase": {
			const currentPhase = config.getPhase();
			return condition.phases.includes(currentPhase as DayPhase);
		}
		case "event-recent":
			return true;
		case "weather":
			return true;
	}
	return false;
}

function allConditionsPass(
	conditions: readonly EnvironmentCondition[],
	config: RoomResolverConfig,
): boolean {
	return conditions.every((c) => evaluateCondition(c, config));
}

// ── Resolver ────────────────────────────────────────────────────────

export interface RoomIntentResolver {
	readonly entityType: InteractionEntityType;
	resolve(): Interaction[];
}

export function createRoomIntentResolver(config: RoomResolverConfig): RoomIntentResolver {
	return {
		entityType: "room",

		resolve(): Interaction[] {
			const interactions: Interaction[] = [];

			for (const rule of config.rules) {
				if (rule.layer === "passive") continue;

				if (!allConditionsPass(rule.conditions, config)) continue;

				const occupantIds = config.getOccupantIds();
				const targets = occupantIds.map((id) => ({
					id,
					entityType: "agent" as InteractionEntityType,
				}));

				const partial = rule.interaction;

				const interaction: Interaction = {
					id: `room-${config.roomId}-${Date.now()}`,
					initiator: { id: config.roomId, entityType: "room" },
					targets,
					cardinality: partial.cardinality ?? "one-to-many",
					category: partial.category ?? "environmental",
					action: partial.action ?? "unknown",
					priority: partial.priority ?? 50,
					context: partial.context ?? {
						phase: config.getPhase() as Interaction["context"]["phase"],
						roomId: config.roomId,
					},
					cooldownMs: partial.cooldownMs ?? rule.cooldownMs,
					duration: partial.duration,
					prerequisites: partial.prerequisites,
					effects: partial.effects ?? [],
					timestamp: Date.now(),
				};

				interactions.push(interaction);
			}

			return interactions;
		},
	};
}
