import type {
	EntityRef,
	Interaction,
	InteractionAction,
	InteractionEffect,
	InteractionTemplate,
	EffectTarget,
} from "./interaction-types.js";

// ── Effect State ─────────────────────────────────────────────────────

export interface EffectState {
	affinityChanges: Array<{ from: string; to: string; amount: number }>;
	needChanges: Array<{ entityId: string; need: string; amount: number }>;
	moodChanges: Array<{ entityId: string; mood: string }>;
	economyChanges: Array<{ entityId: string; currency: string; amount: number }>;
	memoryRecords: Array<{ entityId: string; memory: string }>;
	roomMoodShifts: Array<{ mood: string; amount: number }>;
	spawnedTemplateIds: string[];
	renderActions: Array<{ type: string; entityId: string; params: Record<string, unknown> }>;
}

export function createEffectState(): EffectState {
	return {
		affinityChanges: [],
		needChanges: [],
		moodChanges: [],
		economyChanges: [],
		memoryRecords: [],
		roomMoodShifts: [],
		spawnedTemplateIds: [],
		renderActions: [],
	};
}

// ── Target Resolution ────────────────────────────────────────────────

function isEntityRef(target: EffectTarget): target is EntityRef {
	return typeof target === "object" && "id" in target && "entityType" in target;
}

export function resolveTargets(
	target: EffectTarget,
	initiator: EntityRef,
	targets: readonly EntityRef[],
): readonly EntityRef[] {
	if (target === "initiator") return [initiator];
	if (target === "targets") return [...targets];
	if (target === "all") return [initiator, ...targets];
	if (target === "room") return [];
	if (isEntityRef(target)) return [target];
	return [];
}

// ── Effect Params Extraction ─────────────────────────────────────────

export function extractEffectParams(effect: InteractionEffect): Record<string, unknown> {
	switch (effect.type) {
		case "bubble":
			return { bubbleKind: effect.bubbleKind, phrasePool: effect.phrasePool, templateVars: effect.templateVars };
		case "affinity-change":
			return { amount: effect.amount };
		case "need-change":
			return { need: effect.need, amount: effect.amount };
		case "mood-change":
			return { mood: effect.mood };
		case "particle":
			return { particleType: effect.particleType };
		case "sound":
			return { soundId: effect.soundId };
		case "state-change":
			return { key: effect.key, value: effect.value };
		case "spawn-interaction":
			return { templateId: effect.templateId, delayMs: effect.delayMs };
		case "economy-transaction":
			return { currency: effect.currency, amount: effect.amount };
		case "memory-record":
			return { memory: effect.memory };
		case "room-mood-shift":
			return { mood: effect.mood, amount: effect.amount };
	}
}

// ── Effect Application ───────────────────────────────────────────────

/**
 * Apply a single effect to the state accumulator. Handles state mutations
 * and render actions. Does NOT handle spawn-interaction (bus-specific).
 */
export function applyEffect(
	effect: InteractionEffect,
	initiator: EntityRef,
	targets: readonly EntityRef[],
	state: EffectState,
): void {
	switch (effect.type) {
		case "affinity-change": {
			// Affinity is always from initiator → target(s).
			// When target is "initiator", the initiator's affinity toward each target changes.
			if (effect.target === "initiator") {
				for (const t of targets) {
					state.affinityChanges.push({ from: initiator.id, to: t.id, amount: effect.amount });
				}
			} else {
				const resolved = resolveTargets(effect.target, initiator, targets);
				for (const entity of resolved) {
					state.affinityChanges.push({ from: initiator.id, to: entity.id, amount: effect.amount });
				}
			}
			break;
		}
		case "need-change": {
			const resolved = resolveTargets(effect.target, initiator, targets);
			for (const entity of resolved) {
				state.needChanges.push({ entityId: entity.id, need: effect.need, amount: effect.amount });
			}
			break;
		}
		case "mood-change": {
			const resolved = resolveTargets(effect.target, initiator, targets);
			for (const entity of resolved) {
				state.moodChanges.push({ entityId: entity.id, mood: effect.mood });
			}
			break;
		}
		case "economy-transaction": {
			const resolved = resolveTargets(effect.target, initiator, targets);
			for (const entity of resolved) {
				state.economyChanges.push({ entityId: entity.id, currency: effect.currency, amount: effect.amount });
			}
			break;
		}
		case "memory-record": {
			const resolved = resolveTargets(effect.target, initiator, targets);
			for (const entity of resolved) {
				state.memoryRecords.push({ entityId: entity.id, memory: effect.memory });
			}
			break;
		}
		case "room-mood-shift": {
			state.roomMoodShifts.push({ mood: effect.mood, amount: effect.amount });
			break;
		}
		case "spawn-interaction": {
			state.spawnedTemplateIds.push(effect.templateId);
			break;
		}
		case "bubble":
		case "particle":
		case "sound":
		case "state-change": {
			const resolved = resolveTargets(effect.target, initiator, targets);
			for (const entity of resolved) {
				state.renderActions.push({
					type: effect.type,
					entityId: entity.id,
					params: extractEffectParams(effect),
				});
			}
			break;
		}
	}
}

/**
 * Build a spawned Interaction from a template and parent context.
 * Returns null if template not found.
 */
export function buildSpawnedInteraction(
	effect: { templateId: string },
	parent: Interaction,
	currentTime: number,
	templateRegistry: { getById(id: string): InteractionTemplate | undefined },
): Interaction | null {
	const template = templateRegistry.getById(effect.templateId);
	if (!template) return null;

	return {
		id: `chain-${parent.id}-${effect.templateId}-${currentTime}`,
		initiator: parent.initiator,
		targets: [...parent.targets],
		cardinality: template.cardinality,
		category: template.category,
		action: template.action,
		priority: template.priority,
		context: { ...parent.context, templateId: template.id },
		cooldownMs: template.cooldownMs,
		duration: template.duration,
		prerequisites: [...template.prerequisites],
		effects: [...template.effects],
		timestamp: currentTime,
		chainDepth: (parent.chainDepth ?? 0) + 1,
	};
}

/**
 * Generate InteractionAction entries from an effect + resolved targets.
 */
export function generateActions(
	effect: InteractionEffect,
	interaction: Interaction,
	currentTime: number,
): InteractionAction[] {
	if (effect.type === "spawn-interaction" || effect.type === "room-mood-shift") return [];
	const targets = resolveTargets(effect.target, interaction.initiator, interaction.targets);
	return targets.map((entity) => ({
		interactionId: interaction.id,
		entityId: entity.id,
		entityType: entity.entityType,
		actionType: effect.type,
		params: extractEffectParams(effect),
		timestamp: currentTime,
	}));
}
