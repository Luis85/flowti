// ── Entity Types ────────────────────────────────────────────────────

export type InteractionEntityType = "agent" | "pet" | "npc" | "director" | "room";

export type EntityRef = {
	readonly id: string;
	readonly entityType: InteractionEntityType;
};

// ── Core Types ──────────────────────────────────────────────────────

export type Cardinality = "one-to-one" | "one-to-many" | "many-to-many" | "entity-to-environment";

export type InteractionCategory =
	| "social"
	| "care"
	| "work"
	| "commerce"
	| "environmental"
	| "directive"
	| "reactive"
	| "playful";

export type DayPhase =
	| "morning-arrival"
	| "productive-morning"
	| "lunch"
	| "afternoon"
	| "afternoon-slump"
	| "wind-down"
	| "evening-departure"
	| "night-owl";

// ── Interaction Context ─────────────────────────────────────────────

export interface InteractionContext {
	readonly topic?: string;
	readonly triggerReason?: string;
	readonly mood?: string;
	readonly roomId?: string;
	readonly phase?: DayPhase;
	readonly templateId?: string;
	readonly extra?: Record<string, string>;
}

// ── Prerequisites (discriminated union — 8 variants) ────────────────

export type InteractionPrerequisite =
	| { readonly type: "proximity"; readonly maxDistance: number }
	| { readonly type: "affinity-range"; readonly min: number; readonly max: number }
	| { readonly type: "need-threshold"; readonly need: string; readonly op: "<" | ">" | "==" | "<=" | ">="; readonly value: number }
	| { readonly type: "phase"; readonly phases: readonly DayPhase[] }
	| { readonly type: "cooldown-clear" }
	| { readonly type: "not-locked" }
	| { readonly type: "has-item"; readonly itemId: string }
	| { readonly type: "trust-tier"; readonly minTier: "supervised" | "trusted" | "autonomous" };

// ── Effects (discriminated union — 11 variants) ─────────────────────

export type EffectTarget = "initiator" | "targets" | "all" | "room" | EntityRef;

export type InteractionEffect =
	| { readonly type: "affinity-change"; readonly target: EffectTarget; readonly amount: number }
	| { readonly type: "need-change"; readonly target: EffectTarget; readonly need: string; readonly amount: number }
	| { readonly type: "mood-change"; readonly target: EffectTarget; readonly mood: string }
	| { readonly type: "bubble"; readonly target: EffectTarget; readonly bubbleKind: "speech" | "thought" | "emote"; readonly phrasePool: string; readonly templateVars?: Record<string, string> }
	| { readonly type: "particle"; readonly target: EffectTarget; readonly particleType: string }
	| { readonly type: "sound"; readonly target: EffectTarget; readonly soundId: string }
	| { readonly type: "state-change"; readonly target: EffectTarget; readonly key: string; readonly value: string | number | boolean }
	| { readonly type: "spawn-interaction"; readonly templateId: string; readonly delayMs?: number }
	| { readonly type: "economy-transaction"; readonly target: EffectTarget; readonly currency: "xp" | "coin" | "tokens"; readonly amount: number }
	| { readonly type: "memory-record"; readonly target: EffectTarget; readonly memory: string }
	| { readonly type: "room-mood-shift"; readonly mood: string; readonly amount: number };

// ── Interaction Object ──────────────────────────────────────────────

export interface Interaction {
	readonly id: string;
	readonly initiator: EntityRef;
	readonly targets: readonly EntityRef[];
	readonly cardinality: Cardinality;
	readonly category: InteractionCategory;
	readonly action: string;
	readonly priority: number;
	readonly context: InteractionContext;
	readonly cooldownMs: number;
	readonly duration?: number;
	readonly prerequisites?: readonly InteractionPrerequisite[];
	readonly effects: readonly InteractionEffect[];
	readonly timestamp: number;
	readonly chainDepth?: number;
}

// ── Interaction Template ────────────────────────────────────────────

export interface InteractionTemplate {
	readonly id: string;
	readonly category: InteractionCategory;
	readonly action: string;
	readonly cardinality: Cardinality;
	readonly initiatorTypes: readonly InteractionEntityType[];
	readonly targetTypes: readonly InteractionEntityType[];
	readonly prerequisites: readonly InteractionPrerequisite[];
	readonly weight: number;
	readonly tags: readonly string[];
	readonly tierRange?: readonly [string, string];
	readonly phaseFilter?: readonly string[];
	readonly priority: number;
	readonly cooldownMs: number;
	readonly duration?: number;
	readonly effects: readonly InteractionEffect[];
	readonly chainTemplates?: readonly string[];
	readonly chainChance?: number;
}

// ── Bus Types ───────────────────────────────────────────────────────

export type SubmitResult =
	| { readonly status: "enqueued"; readonly interactionId: string }
	| { readonly status: "rejected"; readonly reason: string };

export interface InteractionAction {
	readonly interactionId: string;
	readonly entityId: string;
	readonly entityType: InteractionEntityType;
	readonly actionType: string;
	readonly params: Record<string, unknown>;
	readonly timestamp: number;
}

export type InteractionLifecycleEvent =
	| "accepted"
	| "rejected"
	| "started"
	| "completed"
	| "preempted"
	| "expired"
	| "chained";

export type ActiveInteraction = Interaction & { readonly remainingMs: number };

export interface InteractionFilter {
	readonly category?: InteractionCategory;
	readonly entityType?: InteractionEntityType;
	readonly timeRange?: { readonly from: number; readonly to: number };
}

// ── Constants ───────────────────────────────────────────────────────

export const MAX_LOCK_DURATION = 15000;
export const MAX_CHAIN_DEPTH = 3;
export const HISTORY_BUFFER_SIZE = 200;

// ── Valid Entity Types (runtime set) ────────────────────────────────

export const VALID_ENTITY_TYPES: ReadonlySet<InteractionEntityType> = new Set<InteractionEntityType>([
	"agent",
	"pet",
	"npc",
	"director",
	"room",
]);

// ── Helper Functions ────────────────────────────────────────────────

export function createEntityRef(id: string, entityType: InteractionEntityType): EntityRef {
	return {
		id: entityType === "director" ? "director" : id,
		entityType,
	};
}

export function isValidEntityRef(ref: unknown): ref is EntityRef {
	if (ref === null || ref === undefined || typeof ref !== "object") return false;
	const obj = ref as Record<string, unknown>;
	if (typeof obj.id !== "string" || obj.id === "") return false;
	if (typeof obj.entityType !== "string") return false;
	return VALID_ENTITY_TYPES.has(obj.entityType as InteractionEntityType);
}

export function isValidInteraction(interaction: unknown): boolean {
	if (interaction === null || interaction === undefined || typeof interaction !== "object") return false;
	const obj = interaction as Record<string, unknown>;

	const targets = obj.targets;
	if (!Array.isArray(targets) || targets.length === 0) return false;

	const priority = obj.priority;
	if (typeof priority !== "number" || priority < 0 || priority > 100) return false;

	const cooldownMs = obj.cooldownMs;
	if (typeof cooldownMs !== "number" || cooldownMs < 0) return false;

	return true;
}
