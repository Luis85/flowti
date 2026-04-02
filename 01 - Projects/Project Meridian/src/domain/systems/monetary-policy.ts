import type { GoldFlow } from '../core/component-data.js';

export interface MonetaryLedger {
	flows: GoldFlow[];
	windowSize: number;
}

export interface MonetarySnapshot {
	moneySupply: number;
	velocity: number;
	faucetRate: number;
	sinkRate: number;
	netFlow: number;
}

export function createMonetaryLedger(windowSize: number): MonetaryLedger {
	return { flows: [], windowSize };
}

export function recordFlow(ledger: MonetaryLedger, flow: GoldFlow): void {
	ledger.flows.push(flow);
	const cutoff = flow.tick - ledger.windowSize;
	const oldest = ledger.flows[0];
	if (oldest !== undefined && oldest.tick < cutoff) {
		ledger.flows = ledger.flows.filter(f => f.tick >= cutoff);
	}
}

export function calculateMonetarySnapshot(
	ledger: MonetaryLedger,
	currentTick: number,
	allGoldBalances: number[],
	treasuryGold: number,
): MonetarySnapshot {
	const cutoff = currentTick - ledger.windowSize;
	const recent = ledger.flows.filter(f => f.tick >= cutoff);
	ledger.flows = recent;

	const moneySupply = allGoldBalances.reduce((a, b) => a + b, 0) + treasuryGold;

	let transferVolume = 0;
	let faucetTotal = 0;
	let sinkTotal = 0;

	for (const f of recent) {
		if (f.category === 'transfer') transferVolume += f.amount;
		else if (f.category === 'faucet') faucetTotal += f.amount;
		else if (f.category === 'sink') sinkTotal += f.amount;
	}

	return {
		moneySupply,
		velocity: moneySupply > 0 ? transferVolume / moneySupply : 0,
		faucetRate: faucetTotal,
		sinkRate: sinkTotal,
		netFlow: faucetTotal - sinkTotal,
	};
}

export function getEffectiveTaxRate(
	baseTax: number,
	velocity: number,
	thresholds: { stagnant: number; overheated: number },
	multipliers: { stagnant: number; overheated: number },
): number {
	if (velocity > thresholds.overheated) return baseTax * multipliers.overheated;
	if (velocity < thresholds.stagnant) return baseTax * multipliers.stagnant;
	return baseTax;
}

export function evaluateSafetyNets(
	velocity: number,
	consecutiveStagnantTicks: number,
	config: { stagnant: number; critical: number; stimulusTriggerTicks: number },
): string[] {
	const interventions: string[] = [];
	if (velocity < config.critical) {
		interventions.push('recovery_event');
	}
	if (velocity < config.stagnant && consecutiveStagnantTicks >= config.stimulusTriggerTicks) {
		interventions.push('stimulus');
	}
	return interventions;
}
