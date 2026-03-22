/**
 * npc-intent-resolver.ts — Resolves NPC interaction intents.
 *
 * Evaluates NPC interaction rules (sorted by weight, highest first)
 * against trigger conditions and cooldowns. The first matching rule
 * produces a single Interaction.
 */

import type {
	Interaction,
	InteractionEntityType,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import type { NPCInteractionRule } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import type { IntentResolver } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";

// ── Config ──────────────────────────────────────────────────────────

export interface NPCResolverConfig {
	readonly npcId: string;
	readonly npcRole: string;
	readonly rules: readonly NPCInteractionRule[];
	readonly getNearby: () => Array<{ id: string; entityType: string; distance: number }>;
	readonly getCooldown: () => number;
	readonly now: () => number;
}

// ── Trigger Evaluation ──────────────────────────────────────────────

function evaluateTrigger(
	trigger: NPCInteractionRule["trigger"],
	nearby: Array<{ id: string; entityType: string; distance: number }>,
): boolean {
	switch (trigger) {
		case "proximity":
			return nearby.length > 0;
		case "idle-timeout":
			return nearby.length === 0;
		case "schedule":
		case "event":
			return true;
	}
}

// ── Resolver ────────────────────────────────────────────────────────

export function createNPCIntentResolver(config: NPCResolverConfig): IntentResolver {
	return {
		entityType: "npc",

		resolve(): Interaction[] {
			const nearby = config.getNearby();
			const now = config.now();
			const cooldownExpiry = config.getCooldown();

			// If cooldown is still active, skip all rules
			if (cooldownExpiry > 0 && now < cooldownExpiry) return [];

			// Sort rules by weight (highest first)
			const sorted = [...config.rules].sort((a, b) => b.weight - a.weight);

			for (const rule of sorted) {
				if (!evaluateTrigger(rule.trigger, nearby)) continue;

				const partial = rule.interaction;

				const targets = nearby.map((n) => ({
					id: n.id,
					entityType: n.entityType as InteractionEntityType,
				}));

				const interaction: Interaction = {
					id: `npc-${config.npcId}-${now}`,
					initiator: { id: config.npcId, entityType: "npc" },
					targets,
					cardinality: partial.cardinality ?? "one-to-one",
					category: partial.category ?? "reactive",
					action: partial.action ?? "unknown",
					priority: partial.priority ?? 50,
					context: partial.context ?? {},
					cooldownMs: partial.cooldownMs ?? rule.cooldownMs,
					duration: partial.duration,
					prerequisites: partial.prerequisites,
					effects: partial.effects ?? [],
					timestamp: now,
				};

				return [interaction];
			}

			return [];
		},
	};
}
