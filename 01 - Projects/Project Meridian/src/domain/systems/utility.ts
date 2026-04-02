export interface ReservationPriceInput {
	baseValue: number;
	needLevel: number;
	needThreshold: number;
	currentStock: number;
	walletGold: number;
	urgencyMax: number;
	stockFactor: number;
	budgetCap: number;
	budgetCapCritical: number;
}

export function calculateReservationPrice(input: ReservationPriceInput): number {
	const isCritical = input.needLevel < input.needThreshold;

	const urgency = isCritical
		? 1 + ((input.needThreshold - input.needLevel) / input.needThreshold) * (input.urgencyMax - 1)
		: Math.max(0.3, input.needLevel / 100);

	const stockPenalty = 1 / (1 + input.currentStock * input.stockFactor);

	const capRatio = isCritical ? input.budgetCapCritical : input.budgetCap;
	const budgetCap = input.walletGold * capRatio;

	const rawReservation = input.baseValue * urgency * stockPenalty;
	return Math.min(rawReservation, budgetCap);
}
