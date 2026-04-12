import type { Recipe } from '../schemas/recipe-schema.js';

export interface StockEntry {
	item_id: string;
	quantity: number;
	charges?: number;
}

export interface RecipeCycleInput {
	facilityStock: ReadonlyArray<StockEntry>;
	workProgress: number;
	ticksPerCycle: number;
	recipe: Recipe;
	wage: number;
	facilityFund: number;
	funding: 'facility' | 'treasury';
	treasuryFund: number;
	taxRate: number;
}

export interface RecipeCycleResult {
	newStock: StockEntry[];
	newWorkProgress: number;
	cycleComplete: boolean;
	workerGoldChange: number;
	taxCollected: number;
	newFund: number;
	newTreasury: number;
}

function hasRequiredInputs(
	stock: ReadonlyArray<StockEntry>,
	inputs: Recipe['inputs'],
): boolean {
	for (const req of inputs) {
		const entry = stock.find((s) => s.item_id === req.item_id);
		if (!entry || entry.quantity < req.quantity) return false;
	}
	return true;
}

function consumeInputs(
	stock: ReadonlyArray<StockEntry>,
	inputs: Recipe['inputs'],
): StockEntry[] {
	let next: StockEntry[] = stock.map((s) => ({ ...s }));
	for (const req of inputs) {
		next = next
			.map((entry) =>
				entry.item_id === req.item_id
					? { ...entry, quantity: entry.quantity - req.quantity }
					: entry,
			)
			.filter((entry) => entry.quantity > 0);
	}
	return next;
}

function addOutputs(
	stock: StockEntry[],
	outputs: Recipe['outputs'],
): StockEntry[] {
	let next = stock;
	for (const out of outputs) {
		const existingIdx = next.findIndex((s) => s.item_id === out.item_id);
		if (existingIdx >= 0) {
			next = next.map((entry, idx) =>
				idx === existingIdx
					? { ...entry, quantity: entry.quantity + out.quantity }
					: entry,
			);
		} else {
			next = [...next, { item_id: out.item_id, quantity: out.quantity }];
		}
	}
	return next;
}

export function applyRecipeCycle(input: RecipeCycleInput): RecipeCycleResult {
	const unchangedStock = input.facilityStock.map((s) => ({ ...s }));

	if (!hasRequiredInputs(input.facilityStock, input.recipe.inputs)) {
		return {
			newStock: unchangedStock,
			newWorkProgress: input.workProgress,
			cycleComplete: false,
			workerGoldChange: 0,
			taxCollected: 0,
			newFund: input.facilityFund,
			newTreasury: input.treasuryFund,
		};
	}

	const nextProgress = input.workProgress + 1;
	if (nextProgress < input.ticksPerCycle) {
		return {
			newStock: unchangedStock,
			newWorkProgress: nextProgress,
			cycleComplete: false,
			workerGoldChange: 0,
			taxCollected: 0,
			newFund: input.facilityFund,
			newTreasury: input.treasuryFund,
		};
	}

	const afterConsume = consumeInputs(input.facilityStock, input.recipe.inputs);
	const afterProduce = addOutputs(afterConsume, input.recipe.outputs);

	if (input.funding === 'treasury') {
		const actualWage = Math.min(input.wage, input.treasuryFund);
		return {
			newStock: afterProduce,
			newWorkProgress: 0,
			cycleComplete: true,
			workerGoldChange: actualWage,
			taxCollected: 0,
			newFund: input.facilityFund,
			newTreasury: input.treasuryFund - actualWage,
		};
	}

	const actualWage = Math.min(input.wage, input.facilityFund);
	const tax = actualWage * input.taxRate;
	const netWage = actualWage - tax;
	return {
		newStock: afterProduce,
		newWorkProgress: 0,
		cycleComplete: true,
		workerGoldChange: netWage,
		taxCollected: tax,
		newFund: input.facilityFund - actualWage,
		newTreasury: input.treasuryFund,
	};
}
