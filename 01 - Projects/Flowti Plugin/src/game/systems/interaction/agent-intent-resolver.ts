/**
 * agent-intent-resolver.ts — Resolves agent interaction intents.
 *
 * Examines nearby entities, agent needs, and affinity to select an
 * appropriate InteractionTemplate and produce a concrete Interaction.
 */

import type {
	Interaction,
	InteractionEntityType,
	InteractionTemplate,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import type { IntentResolver } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import { selectTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";
import type { SelectionContext } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";

// ── Config ──────────────────────────────────────────────────────────

export interface AgentResolverConfig {
	readonly agentId: string;
	readonly getNearby: () => Array<{ id: string; entityType: string; distance: number }>;
	readonly getNeeds: () => { energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number };
	readonly getHistory: () => readonly Interaction[];
	readonly getPhase: () => string;
	readonly getAffinity: (from: string, to: string) => number;
	readonly templates: { getAll(): InteractionTemplate[]; getById(id: string): InteractionTemplate | undefined };
}

// ── Affinity → Tier ─────────────────────────────────────────────────

type AffinityTier = "rival" | "acquaintance" | "colleague" | "friend" | "best-friend";

function affinityTier(score: number): AffinityTier {
	if (score <= -30) return "rival";
	if (score <= 15) return "acquaintance";
	if (score <= 50) return "colleague";
	if (score <= 80) return "friend";
	return "best-friend";
}

// ── Context Tags from Needs ─────────────────────────────────────────

function deriveContextTags(needs: { energy: number; social: number; focus: number; morale: number }): string[] {
	const tags: string[] = [];
	if (needs.social < 30) tags.push("bonding");
	if (needs.morale < 30) tags.push("comfort");
	if (needs.energy < 30) tags.push("rest");
	if (needs.focus < 30) tags.push("quiet");
	return tags;
}

// ── Resolver ────────────────────────────────────────────────────────

export function createAgentIntentResolver(config: AgentResolverConfig): IntentResolver {
	return {
		entityType: "agent",
		resolve(): Interaction[] {
			const nearby = config.getNearby();
			if (nearby.length === 0) return [];

			const needs = config.getNeeds();
			const contextTags = deriveContextTags(needs);

			const target = nearby[0];
			const targetTypes: InteractionEntityType[] = nearby.map(
				(n) => n.entityType as InteractionEntityType,
			);
			// Deduplicate target types
			const uniqueTargetTypes = [...new Set(targetTypes)];

			const affinityScore = config.getAffinity(config.agentId, target.id);
			const tier = affinityTier(affinityScore);

			const history = config.getHistory();
			const phase = config.getPhase();

			const selectionCtx: SelectionContext = {
				initiatorType: "agent",
				targetTypes: uniqueTargetTypes,
				history,
				contextTags,
				currentPhase: phase,
				affinityTier: tier,
			};

			const template = selectTemplate(config.templates, selectionCtx);
			if (template === null) return [];

			// Resolve targets: pick nearby entities whose entityType matches template targetTypes
			const matchedTargets = nearby
				.filter((n) => template.targetTypes.includes(n.entityType as InteractionEntityType))
				.map((n) => ({ id: n.id, entityType: n.entityType as InteractionEntityType }));

			// If no targets matched the template, fall back to the first nearby entity
			const resolvedTargets = matchedTargets.length > 0
				? matchedTargets
				: [{ id: target.id, entityType: target.entityType as InteractionEntityType }];

			const interaction: Interaction = {
				id: `agent-${config.agentId}-${Date.now()}`,
				initiator: { id: config.agentId, entityType: "agent" },
				targets: resolvedTargets,
				cardinality: template.cardinality,
				category: template.category,
				action: template.action,
				priority: template.priority,
				context: {
					phase: phase as Interaction["context"]["phase"],
					mood: contextTags.length > 0 ? contextTags[0] : undefined,
					templateId: template.id,
				},
				cooldownMs: template.cooldownMs,
				duration: template.duration,
				prerequisites: template.prerequisites,
				effects: template.effects,
				timestamp: Date.now(),
			};

			return [interaction];
		},
	};
}
