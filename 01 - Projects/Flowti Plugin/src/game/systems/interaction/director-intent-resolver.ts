/**
 * director-intent-resolver.ts — Resolves director-initiated interactions.
 *
 * Unlike agent resolvers, the director is event-driven rather than
 * tick-driven. Its resolve() always returns [] — interactions are
 * created explicitly via createDirectorInteraction().
 */

import type {
	EntityRef,
	Interaction,
	InteractionTemplate,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";

// ── Config ──────────────────────────────────────────────────────────

export interface DirectorResolverConfig {
	readonly templates: {
		getAll(): InteractionTemplate[];
		getById(id: string): InteractionTemplate | undefined;
	};
}

// ── Result Type ─────────────────────────────────────────────────────

export interface DirectorIntentResolver {
	readonly resolver: {
		resolve(): Interaction[];
		readonly entityType: "director";
	};
	createDirectorInteraction(templateId: string, targets: EntityRef[]): Interaction | null;
}

// ── Factory ─────────────────────────────────────────────────────────

export function createDirectorIntentResolver(config: DirectorResolverConfig): DirectorIntentResolver {
	return {
		resolver: {
			resolve(): Interaction[] {
				return [];
			},
			entityType: "director",
		},

		createDirectorInteraction(templateId: string, targets: EntityRef[]): Interaction | null {
			const template = config.templates.getById(templateId);
			if (!template) return null;

			const interaction: Interaction = {
				id: `director-${Date.now()}`,
				initiator: { id: "director", entityType: "director" },
				targets,
				cardinality: template.cardinality,
				category: template.category,
				action: template.action,
				priority: template.priority,
				context: {
					templateId,
				},
				cooldownMs: template.cooldownMs,
				duration: template.duration,
				effects: template.effects,
				timestamp: Date.now(),
			};

			return interaction;
		},
	};
}
