import { describe, it, expect } from 'vitest';
import { applyTrade } from '../../../src/domain/systems/trade.js';
import type { TradeInput } from '../../../src/domain/systems/trade.js';

function baseInput(overrides: Partial<TradeInput> = {}): TradeInput {
	return {
		agentGold: 10,
		price: 5,
		facilityFund: 50,
		itemId: 'bread',
		quantity: 1,
		...overrides,
	};
}

describe('applyTrade', () => {
	it('succeeds when agent has enough gold', () => {
		const result = applyTrade(baseInput());
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-5);
		expect(result.facilityFundChange).toBe(5);
		expect(result.failReason).toBeNull();
	});

	it('fails when agent has no gold', () => {
		const result = applyTrade(baseInput({ agentGold: 0 }));
		expect(result.success).toBe(false);
		expect(result.failReason).toBe('no_gold');
		expect(result.agentGoldChange).toBe(0);
		expect(result.facilityFundChange).toBe(0);
	});

	it('fails when agent has insufficient gold', () => {
		const result = applyTrade(baseInput({ agentGold: 3, price: 5 }));
		expect(result.success).toBe(false);
		expect(result.failReason).toBe('no_gold');
	});

	it('handles exact gold match', () => {
		const result = applyTrade(baseInput({ agentGold: 5, price: 5 }));
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-5);
		expect(result.facilityFundChange).toBe(5);
	});

	it('deducts correct amount for higher prices', () => {
		const result = applyTrade(baseInput({ agentGold: 100, price: 25 }));
		expect(result.success).toBe(true);
		expect(result.agentGoldChange).toBe(-25);
		expect(result.facilityFundChange).toBe(25);
	});
});
