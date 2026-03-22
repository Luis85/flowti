/**
 * pet-intent-resolver.ts — Resolves pet interaction intents.
 *
 * Examines nearby entities, pet state (hunger, energy, affinity), and
 * filters templates to pet-appropriate categories (social, care, playful,
 * reactive) to produce a concrete Interaction.
 */

import type {
	Interaction,
	InteractionCategory,
	InteractionEntityType,
	InteractionTemplate,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";
import type { IntentResolver } from "../../../../../Flowti CLI/src/domain/interactions/intent-resolver-types.js";
import { selectTemplate } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";
import type { SelectionContext } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";

// ── Allowed Categories ─────────────────────────────────────────────

const PET_CATEGORIES: ReadonlySet<InteractionCategory> = new Set<InteractionCategory>([
	"social",
	"care",
	"playful",
	"reactive",
]);

// ── Config ──────────────────────────────────────────────────────────

export interface PetResolverConfig {
	readonly petId: string;
	readonly getNearby: () => Array<{ id: string; entityType: string; distance: number }>;
	readonly getPetState: () => { hunger: number; thirst: number; energy: number; affinity: Map<string, number> };
	readonly getHistory: () => readonly Interaction[];
	readonly templates: { getAll(): InteractionTemplate[]; getById(id: string): InteractionTemplate | undefined };
}

// ── Context Tags from Pet State ────────────────────────────────────

function deriveContextTags(state: { hunger: number; energy: number }): string[] {
	const tags: string[] = [];
	if (state.energy > 80) tags.push("playful");
	if (state.hunger < 30) tags.push("care");
	return tags;
}

// ── Resolver ────────────────────────────────────────────────────────

export function createPetIntentResolver(config: PetResolverConfig): IntentResolver {
	return {
		entityType: "pet",
		resolve(): Interaction[] {
			const nearby = config.getNearby();
			if (nearby.length === 0) return [];

			const petState = config.getPetState();
			const contextTags = deriveContextTags(petState);

			const target = nearby[0];
			const targetTypes: InteractionEntityType[] = nearby.map(
				(n) => n.entityType as InteractionEntityType,
			);
			const uniqueTargetTypes = [...new Set(targetTypes)];

			const history = config.getHistory();

			// Filter templates to pet-allowed categories only
			const filteredTemplates = config.templates.getAll().filter(
				(t) => PET_CATEGORIES.has(t.category),
			);
			const filteredRegistry = {
				getAll: () => filteredTemplates,
				getById: (id: string) => filteredTemplates.find((t) => t.id === id),
			};

			const selectionCtx: SelectionContext = {
				initiatorType: "pet",
				targetTypes: uniqueTargetTypes,
				history,
				contextTags,
			};

			const template = selectTemplate(filteredRegistry, selectionCtx);
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
				id: `pet-${config.petId}-${Date.now()}`,
				initiator: { id: config.petId, entityType: "pet" },
				targets: resolvedTargets,
				cardinality: template.cardinality,
				category: template.category,
				action: template.action,
				priority: template.priority,
				context: {
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
