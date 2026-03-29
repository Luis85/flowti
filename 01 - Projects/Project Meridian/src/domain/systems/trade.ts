export interface TradeInput {
	agentGold: number;
	price: number;
	facilityFund: number;
	itemId: string;
	quantity: number;
}

export interface TradeResult {
	success: boolean;
	agentGoldChange: number;
	facilityFundChange: number;
	failReason: 'no_gold' | 'no_stock' | null;
}

export function applyTrade(input: TradeInput): TradeResult {
	if (input.agentGold < input.price) {
		return { success: false, agentGoldChange: 0, facilityFundChange: 0, failReason: 'no_gold' };
	}
	return { success: true, agentGoldChange: -input.price, facilityFundChange: input.price, failReason: null };
}
