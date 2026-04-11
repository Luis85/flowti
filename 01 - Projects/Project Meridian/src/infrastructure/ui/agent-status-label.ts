/**
 * Builds contextual status labels for agents, used by both the thought bubble
 * (live, above the sprite) and the debug snapshot (markdown line per agent).
 *
 * Pure — no domain imports. Accepts narrow primitive shapes so tests and non-UI
 * callers can build labels without pulling in Excalibur/mistreevous.
 */

export interface QuestContext {
	type: 'supply' | 'restock' | 'repair';
	facilityId: string;
	itemId: string | null;
	quantity: number;
	repairProgress: number;
	repairTicksRequired?: number;
}

export interface SupplyContext {
	sourceId: string;
	destinationId: string;
	itemId: string;
}

export interface CargoContext {
	itemId: string;
	quantity: number;
	destination: string;
}

export interface AgentStatusInput {
	action: string;
	activeQuest: QuestContext | null;
	supplyRoute: SupplyContext | null;
	haulCargo: CargoContext | null;
	buyTargetItem: string | null;
	/** Resolve a location id to its display name. Return the id as fallback. */
	resolveLocation: (id: string) => string;
}

export interface StatusLabel {
	emoji: string;
	label: string;
}

/**
 * Returns an enriched status label if one applies, or `null` if the caller
 * should fall back to its default action-only label. Priority:
 *   1. Hauling physical cargo (most concrete "doing" state)
 *   2. Active quest (type-specific label with facility name)
 *   3. Supply route context while seeking/pickup/deliver cargo
 *   4. Buy target during market actions
 */
export function enrichAgentStatus(input: AgentStatusInput): StatusLabel | null {
	// 1. Hauling cargo — agent is physically moving something
	if (input.haulCargo !== null) {
		const destName = input.resolveLocation(input.haulCargo.destination);
		const qty = input.haulCargo.quantity > 1 ? `x${String(input.haulCargo.quantity)}` : '';
		return {
			emoji: '📦',
			label: `Delivering ${input.haulCargo.itemId}${qty} → ${destName}`,
		};
	}

	// 2. Active quest
	if (input.activeQuest !== null) {
		return labelForQuest(input.activeQuest, input.action, input.resolveLocation);
	}

	// 3. Supply route during cargo-related actions
	if (input.supplyRoute !== null && isCargoAction(input.action)) {
		const destName = input.resolveLocation(input.supplyRoute.destinationId);
		return {
			emoji: '📦',
			label: `Supply ${input.supplyRoute.itemId} → ${destName}`,
		};
	}

	// 4. Buy target during market actions
	if (input.buyTargetItem !== null && isMarketAction(input.action)) {
		return { emoji: '🛒', label: `Buying ${input.buyTargetItem}` };
	}

	return null;
}

function labelForQuest(
	quest: QuestContext,
	action: string,
	resolveLocation: (id: string) => string,
): StatusLabel {
	const facilityName = resolveLocation(quest.facilityId);

	if (quest.type === 'repair') {
		if (action === 'repair') {
			const pct = formatRepairPercent(quest.repairProgress, quest.repairTicksRequired);
			const suffix = pct !== null ? ` ${pct}` : '';
			return { emoji: '🔧', label: `Repairing ${facilityName}${suffix}` };
		}
		// Traveling to or claiming the repair site
		return { emoji: '🔧', label: `Repair quest → ${facilityName}` };
	}

	// supply / restock — show item when available
	const item = quest.itemId !== null
		? `${quest.itemId}${quest.quantity > 1 ? `x${String(quest.quantity)}` : ''}`
		: '';
	const arrow = item !== '' ? `${item} → ${facilityName}` : `→ ${facilityName}`;
	const verb = quest.type === 'supply' ? 'Supply' : 'Restock';
	return { emoji: '📦', label: `${verb} quest ${arrow}` };
}

function formatRepairPercent(progress: number, ticksRequired: number | undefined): string | null {
	if (ticksRequired === undefined || ticksRequired <= 0) return null;
	const pct = Math.min(100, Math.round((progress / ticksRequired) * 100));
	return `${String(pct)}%`;
}

function isCargoAction(action: string): boolean {
	return action === 'pickup_cargo'
		|| action === 'deliver_cargo'
		|| action === 'seek_delivery'
		|| action === 'seek_supply';
}

function isMarketAction(action: string): boolean {
	return action === 'buy' || action === 'seek_market';
}
