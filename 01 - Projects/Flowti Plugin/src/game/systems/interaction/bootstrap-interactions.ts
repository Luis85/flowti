/**
 * bootstrap-interactions.ts — Assembles all interaction system components.
 *
 * Loads templates into a registry, creates prerequisite checker,
 * instantiates the InteractionSystem + all IntentResolvers,
 * and wires up the effect renderer.
 */

import { createTemplateRegistry } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";
import type { TemplateRegistry } from "../../../../../Flowti CLI/src/domain/interactions/interaction-templates.js";
import type {
	DayPhase,
	Interaction,
	InteractionPrerequisite,
	InteractionTemplate,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";

/** Local resolver interface — compatible with both CLI and Plugin resolver shapes. */
interface Resolver {
	resolve(): Interaction[];
}

// ── Template data ────────────────────────────────────────────────────
import { AGENT_AGENT_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/agent-agent.js";
import { AGENT_PET_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/agent-pet.js";
import { PET_SOCIAL_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/pet-social.js";
import { NPC_INTERACTION_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/npc-interactions.js";
import { ROOM_REACTION_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/room-reactions.js";
import { DIRECTOR_COMMAND_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/director-commands.js";
import { CROSS_TYPE_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/cross-type.js";
import { ENVIRONMENT_EVENT_TEMPLATES } from "../../../../../Flowti CLI/src/domain/interactions/templates/environment-events.js";

// ── Resolvers ────────────────────────────────────────────────────────
import { InteractionSystem } from "./interaction-system.js";
import { createAgentIntentResolver } from "./agent-intent-resolver.js";
import { createPetIntentResolver } from "./pet-intent-resolver.js";
import { createNPCIntentResolver } from "./npc-intent-resolver.js";
import { createRoomIntentResolver } from "./room-intent-resolver.js";
import { createDirectorIntentResolver } from "./director-intent-resolver.js";
import { renderInteractionActions } from "./interaction-effect-renderer.js";

// ── Dependency interfaces (minimal contracts) ────────────────────────

export interface BootstrapSystems {
	readonly social: {
		getNearbyEntities(entityId: string): Array<{ id: string; entityType: string; distance: number }>;
	};
	readonly relationship: {
		getAffinity(from: string, to: string): number;
	};
	readonly needs: {
		getAgentNames(): readonly string[];
		getNeeds(agentName: string): { energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number };
	};
	readonly dayClock: {
		getPhase(): string;
	};
	readonly conversation: {
		isLocked(entityId: string): boolean;
	};
	readonly talk?: {
		triggerReactive(entityId: string, trigger: string): void;
	};
	readonly bubble?: {
		showBubble(entityId: string, kind: string, text: string, ...args: unknown[]): void;
	};
}

// ── Result ───────────────────────────────────────────────────────────

export interface InteractionBootstrap {
	readonly system: InteractionSystem;
	readonly registry: TemplateRegistry;
	readonly resolvers: {
		readonly entities: Map<string, Resolver>;
		readonly director: ReturnType<typeof createDirectorIntentResolver>;
	};
	/** Call each tick after system.tick() to render visual effects. */
	readonly renderActions: typeof renderInteractionActions;
}

// ── Prerequisite evaluation ──────────────────────────────────────────

function evaluateOp(value: number, op: string, threshold: number): boolean {
	switch (op) {
		case "<": return value < threshold;
		case ">": return value > threshold;
		case "==": return value === threshold;
		case "<=": return value <= threshold;
		case ">=": return value >= threshold;
		default: return false;
	}
}

function createPrerequisiteChecker(
	systems: BootstrapSystems,
): (prereq: InteractionPrerequisite, interaction: Interaction) => boolean {
	return (prereq, interaction) => {
		switch (prereq.type) {
			case "proximity": {
				const nearby = systems.social.getNearbyEntities(interaction.initiator.id);
				return interaction.targets.every((t) =>
					nearby.some((n) => n.id === t.id && n.distance <= prereq.maxDistance),
				);
			}
			case "affinity-range": {
				return interaction.targets.every((t) => {
					const affinity = systems.relationship.getAffinity(interaction.initiator.id, t.id);
					return affinity >= prereq.min && affinity <= prereq.max;
				});
			}
			case "need-threshold": {
				const needs = systems.needs.getNeeds(interaction.initiator.id);
				const value = needs[prereq.need as keyof typeof needs] as number;
				if (value === undefined) return true;
				return evaluateOp(value, prereq.op, prereq.value);
			}
			case "phase": {
				const currentPhase = systems.dayClock.getPhase() as DayPhase;
				return prereq.phases.includes(currentPhase);
			}
			case "trust-tier":
			case "has-item":
				return true; // deferred to future implementation
			default:
				return true;
		}
	};
}

// ── Bootstrap ────────────────────────────────────────────────────────

export function bootstrapInteractionSystem(systems: BootstrapSystems): InteractionBootstrap {
	// 1. Aggregate all templates
	const allTemplates: InteractionTemplate[] = [
		...AGENT_AGENT_TEMPLATES,
		...AGENT_PET_TEMPLATES,
		...PET_SOCIAL_TEMPLATES,
		...NPC_INTERACTION_TEMPLATES,
		...ROOM_REACTION_TEMPLATES,
		...DIRECTOR_COMMAND_TEMPLATES,
		...CROSS_TYPE_TEMPLATES,
		...ENVIRONMENT_EVENT_TEMPLATES,
	];
	const registry = createTemplateRegistry(allTemplates);

	// 2. Create prerequisite checker
	const checkPrerequisite = createPrerequisiteChecker(systems);

	// 3. Create InteractionSystem (wraps bus)
	const system = new InteractionSystem({
		checkPrerequisite,
		templateRegistry: registry,
		externalLockQuery: (entityId) => systems.conversation.isLocked(entityId),
	});

	// 4. Create director resolver (shared, event-driven)
	const director = createDirectorIntentResolver({ templates: registry });

	return {
		system,
		registry,
		resolvers: {
			entities: new Map(),
			director,
		},
		renderActions: renderInteractionActions,
	};
}

/**
 * Create an agent intent resolver and register it.
 * Called per-agent during agent initialization.
 */
export function registerAgentResolver(
	bootstrap: InteractionBootstrap,
	agentId: string,
	systems: BootstrapSystems,
): Resolver {
	const resolver = createAgentIntentResolver({
		agentId,
		getNearby: () => systems.social.getNearbyEntities(agentId),
		getNeeds: () => systems.needs.getNeeds(agentId),
		getHistory: () => bootstrap.system.getBus().getHistory(),
		getPhase: () => systems.dayClock.getPhase(),
		getAffinity: (from, to) => systems.relationship.getAffinity(from, to),
		templates: bootstrap.registry,
	});
	bootstrap.resolvers.entities.set(agentId, resolver);
	return resolver;
}

/**
 * Create a pet intent resolver.
 * Called per-pet during pet initialization.
 */
export function registerPetResolver(
	bootstrap: InteractionBootstrap,
	petId: string,
	systems: BootstrapSystems,
	getPetState: () => { hunger: number; thirst: number; energy: number; affinity: Map<string, number> },
): Resolver {
	const resolver = createPetIntentResolver({
		petId,
		getNearby: () => systems.social.getNearbyEntities(petId),
		getPetState,
		getHistory: () => bootstrap.system.getBus().getHistory(),
		templates: bootstrap.registry,
	});
	bootstrap.resolvers.entities.set(petId, resolver);
	return resolver;
}

/** Export resolver factories for NPC and room (created per-entity at game time). */
export { createNPCIntentResolver, createRoomIntentResolver };
