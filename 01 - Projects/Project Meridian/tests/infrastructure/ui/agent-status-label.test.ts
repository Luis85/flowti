import { describe, it, expect } from 'vitest';
import { enrichAgentStatus, type AgentStatusInput } from '../../../src/infrastructure/ui/agent-status-label.js';

const resolveLocation = (id: string): string => {
	const map: Record<string, string> = {
		'loc-workshop': 'Workshop',
		'loc-market': 'Market Stall',
		'loc-tavern': 'Tavern',
		'loc-farmland': 'Farmland',
	};
	return map[id] ?? id;
};

function baseInput(partial: Partial<AgentStatusInput> = {}): AgentStatusInput {
	return {
		action: 'idle',
		activeQuest: null,
		supplyRoute: null,
		haulCargo: null,
		buyTargetItem: null,
		resolveLocation,
		...partial,
	};
}

describe('enrichAgentStatus', () => {
	it('returns null for plain idle/wander with no context', () => {
		expect(enrichAgentStatus(baseInput({ action: 'idle' }))).toBeNull();
		expect(enrichAgentStatus(baseInput({ action: 'wander' }))).toBeNull();
	});

	it('returns null when the action is unrelated to any context field', () => {
		expect(enrichAgentStatus(baseInput({
			action: 'eat',
			buyTargetItem: 'food', // buy target present but action is eat, not buy
		}))).toBeNull();
	});

	describe('hauling cargo', () => {
		it('takes priority over all other fields', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'deliver_cargo',
				haulCargo: { itemId: 'food', quantity: 3, destination: 'loc-tavern' },
				activeQuest: { type: 'supply', facilityId: 'loc-workshop', itemId: 'tools', quantity: 1, repairProgress: 0 },
			}));
			expect(result).toEqual({ emoji: '📦', label: 'Delivering foodx3 → Tavern' });
		});

		it('omits quantity suffix for single-unit cargo', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'deliver_cargo',
				haulCargo: { itemId: 'tools', quantity: 1, destination: 'loc-market' },
			}));
			expect(result?.label).toBe('Delivering tools → Market Stall');
		});

		it('falls back to raw id when destination is unknown', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'deliver_cargo',
				haulCargo: { itemId: 'food', quantity: 2, destination: 'loc-unknown' },
			}));
			expect(result?.label).toBe('Delivering foodx2 → loc-unknown');
		});
	});

	describe('active quest — repair', () => {
		it('shows travel label during seek_quest', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'seek_quest',
				activeQuest: { type: 'repair', facilityId: 'loc-workshop', itemId: null, quantity: 0, repairProgress: 0 },
			}));
			expect(result).toEqual({ emoji: '🔧', label: 'Repair quest → Workshop' });
		});

		it('shows progress percent during repair action when repairTicksRequired provided', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'repair',
				activeQuest: { type: 'repair', facilityId: 'loc-workshop', itemId: null, quantity: 0, repairProgress: 15, repairTicksRequired: 30 },
			}));
			expect(result).toEqual({ emoji: '🔧', label: 'Repairing Workshop 50%' });
		});

		it('omits percent when repairTicksRequired is missing', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'repair',
				activeQuest: { type: 'repair', facilityId: 'loc-workshop', itemId: null, quantity: 0, repairProgress: 15 },
			}));
			expect(result?.label).toBe('Repairing Workshop');
		});

		it('caps percent at 100 when progress exceeds required ticks', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'repair',
				activeQuest: { type: 'repair', facilityId: 'loc-workshop', itemId: null, quantity: 0, repairProgress: 50, repairTicksRequired: 30 },
			}));
			expect(result?.label).toBe('Repairing Workshop 100%');
		});
	});

	describe('active quest — supply/restock', () => {
		it('shows item and facility for supply quest', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'seek_quest',
				activeQuest: { type: 'supply', facilityId: 'loc-tavern', itemId: 'food', quantity: 5, repairProgress: 0 },
			}));
			expect(result).toEqual({ emoji: '📦', label: 'Supply quest foodx5 → Tavern' });
		});

		it('uses "Restock" verb for restock quest', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'claim_quest',
				activeQuest: { type: 'restock', facilityId: 'loc-market', itemId: 'tools', quantity: 2, repairProgress: 0 },
			}));
			expect(result).toEqual({ emoji: '📦', label: 'Restock quest toolsx2 → Market Stall' });
		});

		it('omits quantity suffix when quantity is 1', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'seek_quest',
				activeQuest: { type: 'supply', facilityId: 'loc-tavern', itemId: 'food', quantity: 1, repairProgress: 0 },
			}));
			expect(result?.label).toBe('Supply quest food → Tavern');
		});

		it('handles missing itemId gracefully', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'seek_quest',
				activeQuest: { type: 'supply', facilityId: 'loc-tavern', itemId: null, quantity: 1, repairProgress: 0 },
			}));
			expect(result?.label).toBe('Supply quest → Tavern');
		});
	});

	describe('supply route without quest', () => {
		it('labels cargo-related actions with the route destination', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'pickup_cargo',
				supplyRoute: { sourceId: 'loc-farmland', destinationId: 'loc-tavern', itemId: 'food' },
			}));
			expect(result).toEqual({ emoji: '📦', label: 'Supply food → Tavern' });
		});

		it('ignores supply route for non-cargo actions', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'idle',
				supplyRoute: { sourceId: 'loc-farmland', destinationId: 'loc-tavern', itemId: 'food' },
			}));
			expect(result).toBeNull();
		});
	});

	describe('buy target', () => {
		it('shows buying context during seek_market', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'seek_market',
				buyTargetItem: 'food',
			}));
			expect(result).toEqual({ emoji: '🛒', label: 'Buying food' });
		});

		it('shows buying context during buy action', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'buy',
				buyTargetItem: 'equipment',
			}));
			expect(result?.label).toBe('Buying equipment');
		});

		it('ignores buy target for unrelated actions', () => {
			const result = enrichAgentStatus(baseInput({
				action: 'wander',
				buyTargetItem: 'food',
			}));
			expect(result).toBeNull();
		});
	});
});
