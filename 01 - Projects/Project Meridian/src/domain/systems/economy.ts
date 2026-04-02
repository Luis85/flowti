import { calculatePostedPrice } from './pricing.js';

export interface FacilityItemContext {
	itemId: string;
	baseValue: number;
	category: string;
	stock: number;
}

export interface FacilityPricingContext {
	facilityId: string;
	items: FacilityItemContext[];
	demandRates: Record<string, number>;
	locationHops: number;
	pipelineModifiers: number[];
	elasticityMap: Record<string, number>;
	clampMin: number;
	clampMax: number;
}

export function shouldRecalculate(currentTick: number, scheduledTick: number): boolean {
	return currentTick >= scheduledTick;
}

export function recalculateFacilityPrices(ctx: FacilityPricingContext): Record<string, number> {
	const prices: Record<string, number> = {};
	for (const item of ctx.items) {
		prices[item.itemId] = calculatePostedPrice({
			baseValue: item.baseValue,
			demandRate: ctx.demandRates[item.itemId] ?? 0,
			supplyCount: item.stock,
			locationHops: ctx.locationHops,
			elasticity: ctx.elasticityMap[item.category] ?? 1.0,
			pipelineModifiers: ctx.pipelineModifiers,
			clampMin: ctx.clampMin,
			clampMax: ctx.clampMax,
		});
	}
	return prices;
}
