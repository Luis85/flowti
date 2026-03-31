/** Startup world consistency validation — pure domain function. */

export interface WorldValidationAgent {
	id: string;
	name: string;
	job: string | null;
	inventory: { item_id: string; quantity: number }[];
	behaviorTree: string;
}

export interface WorldValidationLocation {
	id: string;
	type: string;
	production: {
		job: string;
		output: { item_id: string };
		input: { item_id: string } | null;
	} | null;
}

export interface WorldValidationInput {
	agents: WorldValidationAgent[];
	locations: WorldValidationLocation[];
	btDefinitions: Record<string, unknown>;
	knownFoodItems: Set<string>;
	knownActions: Set<string>;
}

export interface ValidationWarning {
	category: 'item_mismatch' | 'job_mismatch' | 'bt_missing' | 'supply_chain';
	message: string;
	agentId?: string;
	locationId?: string;
}

/** Food-like substrings — inventory items containing these are flagged if not in the food registry. */
const FOOD_KEYWORDS = ['bread', 'food', 'wheat', 'meat', 'fish', 'stew', 'pie', 'soup', 'cake', 'meal'];

function checkItemMismatches(agents: WorldValidationAgent[], knownFoodItems: Set<string>): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];
	for (const agent of agents) {
		for (const item of agent.inventory) {
			if (knownFoodItems.has(item.item_id)) continue;
			const lower = item.item_id.toLowerCase();
			const matchedKeyword = FOOD_KEYWORDS.find(kw => lower.includes(kw));
			if (matchedKeyword !== undefined) {
				warnings.push({
					category: 'item_mismatch',
					message: `Agent "${agent.name}" has item "${item.item_id}" which looks food-like (contains "${matchedKeyword}") but is not in the food registry`,
					agentId: agent.id,
				});
			}
		}
	}
	return warnings;
}

function checkJobFacilityMatches(agents: WorldValidationAgent[], locations: WorldValidationLocation[]): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];
	const facilityJobs = new Set<string>();
	for (const loc of locations) {
		if (loc.production !== null) {
			facilityJobs.add(loc.production.job);
		}
	}
	for (const agent of agents) {
		if (agent.job !== null && !facilityJobs.has(agent.job)) {
			warnings.push({
				category: 'job_mismatch',
				message: `Agent "${agent.name}" has job "${agent.job}" but no facility produces for that job`,
				agentId: agent.id,
			});
		}
	}
	return warnings;
}

function checkBTDefinitions(agents: WorldValidationAgent[], btDefinitions: Record<string, unknown>): ValidationWarning[] {
	const BT_PREFIX = 'bt-';
	const warnings: ValidationWarning[] = [];
	for (const agent of agents) {
		// BT map keys have the 'bt-' prefix stripped (e.g., 'bt-scholar' → 'scholar')
		const btKey = agent.behaviorTree.startsWith(BT_PREFIX)
			? agent.behaviorTree.slice(BT_PREFIX.length)
			: agent.behaviorTree;
		if (!(btKey in btDefinitions)) {
			warnings.push({
				category: 'bt_missing',
				message: `Agent "${agent.name}" references behavior tree "${agent.behaviorTree}" which is not loaded`,
				agentId: agent.id,
			});
		}
	}
	return warnings;
}

function checkSupplyChains(locations: WorldValidationLocation[]): ValidationWarning[] {
	const warnings: ValidationWarning[] = [];
	const producedItems = new Set<string>();
	for (const loc of locations) {
		if (loc.production !== null) {
			producedItems.add(loc.production.output.item_id);
		}
	}
	for (const loc of locations) {
		if (loc.production !== null && loc.production.input !== null) {
			if (!producedItems.has(loc.production.input.item_id)) {
				warnings.push({
					category: 'supply_chain',
					message: `Location "${loc.id}" requires input "${loc.production.input.item_id}" but no facility produces it`,
					locationId: loc.id,
				});
			}
		}
	}
	return warnings;
}

export function validateWorldConsistency(input: WorldValidationInput): ValidationWarning[] {
	return [
		...checkItemMismatches(input.agents, input.knownFoodItems),
		...checkJobFacilityMatches(input.agents, input.locations),
		...checkBTDefinitions(input.agents, input.btDefinitions),
		...checkSupplyChains(input.locations),
	];
}
