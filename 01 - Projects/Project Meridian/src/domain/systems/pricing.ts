export interface PricingInput {
	baseValue: number;
	demandRate: number;
	supplyCount: number;
	locationHops: number;
	elasticity: number;
	pipelineModifiers: number[];
	clampMin: number;
	clampMax: number;
}

export function calculatePostedPrice(input: PricingInput): number {
	const scarcityRaw = input.demandRate / Math.max(1, input.supplyCount);
	const scarcity = 1.0 + (scarcityRaw - 1.0) * input.elasticity;
	const locationMod = 1.0 + (input.locationHops * 0.1);
	const pipeline = input.pipelineModifiers.length > 0
		? input.pipelineModifiers.reduce((a, b) => a * b, 1.0)
		: 1.0;
	const raw = input.baseValue * scarcity * locationMod * pipeline;
	return clamp(raw, input.baseValue * input.clampMin, input.baseValue * input.clampMax);
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}
