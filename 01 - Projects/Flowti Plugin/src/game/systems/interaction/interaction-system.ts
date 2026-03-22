/**
 * interaction-system.ts — Plugin-side wrapper around the CLI domain interaction bus.
 *
 * Provides a game-loop-friendly API: tick(deltaMs) returns actions + effect state.
 * Intent resolvers and other game systems submit interactions via getBus().
 */

import { createInteractionBus } from "../../../../../Flowti CLI/src/domain/interactions/interaction-bus.js";
import type { EffectState } from "../../../../../Flowti CLI/src/domain/interactions/interaction-bus.js";
import type {
	Interaction,
	InteractionAction,
	InteractionPrerequisite,
	InteractionTemplate,
} from "../../../../../Flowti CLI/src/domain/interactions/interaction-types.js";

// ── Options ────────────────────────────────────────────────────────

type PrerequisiteChecker = (prereq: InteractionPrerequisite, interaction: Interaction) => boolean;

interface TemplateRegistryRef {
	getById(id: string): InteractionTemplate | undefined;
}

type ExternalLockQuery = (entityId: string) => boolean;

export interface InteractionSystemOptions {
	checkPrerequisite?: PrerequisiteChecker;
	templateRegistry?: TemplateRegistryRef;
	externalLockQuery?: ExternalLockQuery;
}

// ── Bus API type (inferred from factory) ───────────────────────────

type InteractionBus = ReturnType<typeof createInteractionBus>;

// ── InteractionSystem ──────────────────────────────────────────────

export class InteractionSystem {
	private readonly bus: InteractionBus;

	constructor(options: InteractionSystemOptions = {}) {
		this.bus = createInteractionBus({
			checkPrerequisite: options.checkPrerequisite,
			templateRegistry: options.templateRegistry,
			externalLockQuery: options.externalLockQuery,
		});
	}

	/** Advance the bus by deltaMs; returns actions produced and accumulated effect state. */
	tick(deltaMs: number): { actions: InteractionAction[]; state: EffectState } {
		return this.bus.tick(deltaMs);
	}

	/** Get the bus instance for resolvers to submit interactions. */
	getBus(): InteractionBus {
		return this.bus;
	}

	/** Check whether an entity is currently locked (internal or external). */
	isEntityLocked(id: string): boolean {
		return this.bus.isEntityLocked(id);
	}
}
