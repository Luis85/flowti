import type {
	Interaction,
	InteractionAction,
	InteractionFilter,
	InteractionLifecycleEvent,
	InteractionPrerequisite,
	InteractionTemplate,
	ActiveInteraction,
	SubmitResult,
} from "./interaction-types.js";
import {
	MAX_LOCK_DURATION,
	MAX_CHAIN_DEPTH,
	HISTORY_BUFFER_SIZE,
	isValidInteraction,
} from "./interaction-types.js";
import {
	applyEffect,
	buildSpawnedInteraction,
	createEffectState,
	generateActions,
} from "./interaction-effects.js";
import type { EffectState } from "./interaction-effects.js";

export type { EffectState };

// ── Bus Options ────────────────────────────────────────────────────

type PrerequisiteChecker = (prereq: InteractionPrerequisite, interaction: Interaction) => boolean;

interface TemplateRegistryRef {
	getById(id: string): InteractionTemplate | undefined;
}

type ExternalLockQuery = (entityId: string) => boolean;

interface BusOptions {
	checkPrerequisite?: PrerequisiteChecker;
	templateRegistry?: TemplateRegistryRef;
	externalLockQuery?: ExternalLockQuery;
}

// ── Internal Types ─────────────────────────────────────────────────

interface LockEntry {
	interactionId: string;
	remainingMs: number;
	elapsedMs: number;
	interaction: Interaction;
}

interface CooldownEntry {
	expiresAt: number;
}

type EventHandler = (interaction: Interaction) => void;

// ── Bus API ────────────────────────────────────────────────────────

interface InteractionBusApi {
	submit(interaction: Interaction): SubmitResult;
	tick(deltaMs: number): { actions: InteractionAction[]; state: EffectState };
	getActive(): ActiveInteraction[];
	getHistory(filter?: InteractionFilter): Interaction[];
	on(event: InteractionLifecycleEvent, handler: EventHandler): void;
	isEntityLocked(id: string): boolean;
	getCooldown(entityId: string, entityType: string, action: string): number;
}

// ── Helpers ────────────────────────────────────────────────────────

function cooldownKey(entityId: string, entityType: string, action: string): string {
	return `${entityType}:${entityId}:${action}`;
}

// ── Factory ────────────────────────────────────────────────────────

export function createInteractionBus(options: BusOptions = {}): InteractionBusApi {
	const { checkPrerequisite, templateRegistry, externalLockQuery } = options;

	const queue: Interaction[] = [];
	const history: Interaction[] = [];
	const lockedEntities = new Map<string, LockEntry>();
	const activeInteractions = new Map<string, LockEntry>();
	const cooldowns = new Map<string, CooldownEntry>();
	const listeners = new Map<InteractionLifecycleEvent, EventHandler[]>();
	let deferredSpawns: Interaction[] = [];
	let currentTime = 0;

	// ── Event emitter ──────────────────────────────────────────────

	function emit(event: InteractionLifecycleEvent, interaction: Interaction): void {
		const handlers = listeners.get(event);
		if (handlers) {
			for (const handler of handlers) handler(interaction);
		}
	}

	// ── Lock management ────────────────────────────────────────────

	function isEffectivelyLocked(entityId: string): boolean {
		return lockedEntities.has(entityId) || (externalLockQuery ? externalLockQuery(entityId) : false);
	}

	function getAllParticipantIds(interaction: Interaction): string[] {
		return [interaction.initiator.id, ...interaction.targets.map(t => t.id)];
	}

	function removeInteractionLocks(interactionId: string, interaction: Interaction): void {
		for (const id of getAllParticipantIds(interaction)) {
			if (lockedEntities.get(id)?.interactionId === interactionId) {
				lockedEntities.delete(id);
			}
		}
		activeInteractions.delete(interactionId);
	}

	// ── Prerequisite checking ──────────────────────────────────────

	function checkAllPrerequisites(interaction: Interaction): boolean {
		const prereqs = interaction.prerequisites;
		if (!prereqs || prereqs.length === 0) return true;

		for (const prereq of prereqs) {
			switch (prereq.type) {
				case "cooldown-clear": {
					const key = cooldownKey(interaction.initiator.id, interaction.initiator.entityType, interaction.action);
					const entry = cooldowns.get(key);
					if (entry && currentTime < entry.expiresAt) return false;
					break;
				}
				case "not-locked": {
					const participantIds = getAllParticipantIds(interaction);
					if (!participantIds.every(id => !isEffectivelyLocked(id))) return false;
					break;
				}
				default:
					if (checkPrerequisite && !checkPrerequisite(prereq, interaction)) return false;
					break;
			}
		}
		return true;
	}

	// ── Effect execution (delegates to interaction-effects.ts) ─────

	function executeEffects(interaction: Interaction, state: EffectState, actions: InteractionAction[]): void {
		for (const effect of interaction.effects) {
			// Spawn-interaction: bus-specific (needs deferredSpawns closure)
			if (effect.type === "spawn-interaction") {
				if (!templateRegistry) continue;
				const spawned = buildSpawnedInteraction(effect, interaction, currentTime, templateRegistry);
				if (spawned) {
					deferredSpawns.push(spawned);
					state.spawnedTemplateIds.push(effect.templateId);
					emit("chained", spawned);
				}
				continue;
			}

			// State mutations
			applyEffect(effect, interaction.initiator, interaction.targets, state);

			// Action generation
			const newActions = generateActions(effect, interaction, currentTime);
			for (const action of newActions) actions.push(action);
		}

		// chainTemplates/chainChance: roll against chance and spawn a random chain template
		if (templateRegistry && interaction.context.templateId) {
			const template = templateRegistry.getById(interaction.context.templateId);
			if (template?.chainTemplates && template.chainTemplates.length > 0) {
				const chance = template.chainChance ?? 0;
				if (chance > 0 && Math.random() < chance) {
					const chainId = template.chainTemplates[Math.floor(Math.random() * template.chainTemplates.length)];
					const spawned = buildSpawnedInteraction({ templateId: chainId }, interaction, currentTime, templateRegistry);
					if (spawned) {
						deferredSpawns.push(spawned);
						state.spawnedTemplateIds.push(chainId);
						emit("chained", spawned);
					}
				}
			}
		}
	}

	// ── Public API ─────────────────────────────────────────────────

	function submit(interaction: Interaction): SubmitResult {
		if (!isValidInteraction(interaction)) {
			return { status: "rejected", reason: "invalid interaction" };
		}
		queue.push(interaction);
		return { status: "enqueued", interactionId: interaction.id };
	}

	function tick(deltaMs: number): { actions: InteractionAction[]; state: EffectState } {
		currentTime += deltaMs;
		const actions: InteractionAction[] = [];
		const state = createEffectState();

		// Step 1: Expire locks
		const expiredIds: string[] = [];
		for (const [interactionId, entry] of activeInteractions) {
			entry.remainingMs -= deltaMs;
			entry.elapsedMs += deltaMs;
			if (entry.remainingMs <= 0 || entry.elapsedMs >= MAX_LOCK_DURATION) {
				expiredIds.push(interactionId);
			}
		}
		for (const interactionId of expiredIds) {
			const entry = activeInteractions.get(interactionId);
			if (!entry) continue;
			removeInteractionLocks(interactionId, entry.interaction);
			emit("completed", entry.interaction);
		}

		// Step 2: Drain queue
		const batch = [...deferredSpawns, ...queue.splice(0)];
		deferredSpawns = [];
		batch.sort((a, b) => b.priority !== a.priority ? b.priority - a.priority : a.timestamp - b.timestamp);

		// Step 3: Process each interaction
		for (const interaction of batch) {
			if ((interaction.chainDepth ?? 0) > MAX_CHAIN_DEPTH) {
				emit("rejected", interaction);
				continue;
			}

			if (!checkAllPrerequisites(interaction)) {
				emit("rejected", interaction);
				continue;
			}

			// Conflict resolution
			const participantIds = getAllParticipantIds(interaction);
			const conflicting = participantIds.reduce<LockEntry | undefined>(
				(found, id) => found ?? lockedEntities.get(id), undefined,
			);
			if (conflicting) {
				if (interaction.priority > 90) {
					removeInteractionLocks(conflicting.interactionId, conflicting.interaction);
					emit("preempted", conflicting.interaction);
				} else {
					emit("rejected", interaction);
					continue;
				}
			}

			emit("accepted", interaction);

			// Lock participants
			const duration = interaction.duration ?? 0;
			if (duration > 0) {
				const cappedDuration = Math.min(duration, MAX_LOCK_DURATION);
				const lockEntry: LockEntry = {
					interactionId: interaction.id,
					remainingMs: cappedDuration,
					elapsedMs: 0,
					interaction,
				};
				for (const id of participantIds) lockedEntities.set(id, lockEntry);
				activeInteractions.set(interaction.id, lockEntry);
				emit("started", interaction);
			}

			// Execute effects
			executeEffects(interaction, state, actions);

			// Record
			if (interaction.cooldownMs > 0) {
				const key = cooldownKey(interaction.initiator.id, interaction.initiator.entityType, interaction.action);
				cooldowns.set(key, { expiresAt: currentTime + interaction.cooldownMs });
			}
			history.push(interaction);
			if (history.length > HISTORY_BUFFER_SIZE) {
				history.splice(0, history.length - HISTORY_BUFFER_SIZE);
			}

			if (duration <= 0) emit("completed", interaction);
		}

		return { actions, state };
	}

	function getActive(): ActiveInteraction[] {
		return [...activeInteractions.values()].map(entry => ({
			...entry.interaction,
			remainingMs: entry.remainingMs,
		}));
	}

	function getHistory(filter?: InteractionFilter): Interaction[] {
		if (!filter) return [...history];
		return history.filter(interaction => {
			if (filter.category && interaction.category !== filter.category) return false;
			if (filter.entityType) {
				const hasEntity =
					interaction.initiator.entityType === filter.entityType ||
					interaction.targets.some(t => t.entityType === filter.entityType);
				if (!hasEntity) return false;
			}
			if (filter.timeRange) {
				if (interaction.timestamp < filter.timeRange.from || interaction.timestamp > filter.timeRange.to) return false;
			}
			return true;
		});
	}

	function on(event: InteractionLifecycleEvent, handler: EventHandler): void {
		const handlers = listeners.get(event) ?? [];
		handlers.push(handler);
		listeners.set(event, handlers);
	}

	function isEntityLocked(id: string): boolean {
		return isEffectivelyLocked(id);
	}

	function getCooldown(entityId: string, entityType: string, action: string): number {
		const key = cooldownKey(entityId, entityType, action);
		const entry = cooldowns.get(key);
		if (!entry) return 0;
		const remaining = entry.expiresAt - currentTime;
		return remaining > 0 ? remaining : 0;
	}

	return { submit, tick, getActive, getHistory, on, isEntityLocked, getCooldown };
}
