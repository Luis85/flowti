import type {
	Interaction,
	InteractionEntityType,
	InteractionTemplate,
} from "./interaction-types.js";

// ── Selection Context ───────────────────────────────────────────────

export interface SelectionContext {
	readonly initiatorType: InteractionEntityType;
	readonly targetTypes: readonly InteractionEntityType[];
	readonly history: readonly Interaction[];
	readonly contextTags?: readonly string[];
	readonly currentPhase?: string;
	readonly affinityTier?: string;
}

// ── Template Registry ───────────────────────────────────────────────

export interface TemplateRegistry {
	getAll(): InteractionTemplate[];
	getById(id: string): InteractionTemplate | undefined;
}

export function createTemplateRegistry(templates: InteractionTemplate[]): TemplateRegistry {
	const map = new Map<string, InteractionTemplate>();
	for (const t of templates) {
		map.set(t.id, t);
	}

	return {
		getAll: () => [...map.values()],
		getById: (id: string) => map.get(id),
	};
}

// ── Tier Ordering ───────────────────────────────────────────────────

const TIER_ORDER: readonly string[] = ["rival", "stranger", "acquaintance", "colleague", "friend", "best-friend"];

function tierIndex(tier: string): number {
	return TIER_ORDER.indexOf(tier);
}

function isWithinTierRange(tier: string, range: readonly [string, string]): boolean {
	const idx = tierIndex(tier);
	const minIdx = tierIndex(range[0]);
	const maxIdx = tierIndex(range[1]);
	if (idx === -1 || minIdx === -1 || maxIdx === -1) return false;
	return idx >= minIdx && idx <= maxIdx;
}

// ── Weighted Random ─────────────────────────────────────────────────

interface WeightedEntry<T> {
	readonly item: T;
	readonly weight: number;
}

function weightedRandom<T>(entries: WeightedEntry<T>[]): T | null {
	if (entries.length === 0) return null;

	const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
	if (totalWeight <= 0) return null;

	const roll = Math.random() * totalWeight;
	let cumulative = 0;

	for (const entry of entries) {
		cumulative += entry.weight;
		if (roll < cumulative) return entry.item;
	}

	return entries[entries.length - 1].item;
}

// ── Template Selection ──────────────────────────────────────────────

const RECENCY_WINDOW = 10;
const RECENCY_PENALTY = 0.5;
const TAG_BOOST = 2;

export function selectTemplate(
	registry: TemplateRegistry,
	context: SelectionContext,
): InteractionTemplate | null {
	const all = registry.getAll();

	// Step 1: Filter
	const candidates = all.filter((t) => {
		if (!t.initiatorTypes.includes(context.initiatorType)) return false;

		const hasTargetOverlap = t.targetTypes.some((tt) =>
			context.targetTypes.includes(tt),
		);
		if (!hasTargetOverlap) return false;

		if (t.phaseFilter !== undefined && context.currentPhase !== undefined) {
			if (!t.phaseFilter.includes(context.currentPhase)) return false;
		}

		if (t.tierRange !== undefined && context.affinityTier !== undefined) {
			if (!isWithinTierRange(context.affinityTier, t.tierRange as readonly [string, string])) {
				return false;
			}
		}

		return true;
	});

	if (candidates.length === 0) return null;

	// Collect recent template IDs from history (last 10 entries)
	const recentIds = new Set<string>();
	const historySlice = context.history.slice(-RECENCY_WINDOW);
	for (const interaction of historySlice) {
		if (interaction.context.templateId) {
			recentIds.add(interaction.context.templateId);
		}
	}

	// Step 2 & 3: Compute adjusted weights
	const weighted = candidates.map((t) => {
		let weight = t.weight;

		// Tag boost
		if (context.contextTags && context.contextTags.length > 0) {
			const hasOverlap = t.tags.some((tag) => context.contextTags!.includes(tag));
			if (hasOverlap) {
				weight *= TAG_BOOST;
			}
		}

		// Recency penalty
		if (recentIds.has(t.id)) {
			weight *= RECENCY_PENALTY;
		}

		return { item: t, weight };
	});

	// Step 4: Weighted random selection
	return weightedRandom(weighted);
}
