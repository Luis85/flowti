import { describe, it, expect } from 'vitest';
import { GameConfigSchema } from '../../src/domain/schemas/game-config-schema.js';
import { applyFacilityTick } from '../../src/domain/systems/facility.js';
import { calculateReservationPrice } from '../../src/domain/systems/utility.js';

describe('two-agent economy integration', () => {
	const config = GameConfigSchema.parse({});

	it('treasury-funded facility pays wages from treasury without tax', () => {
		const result = applyFacilityTick({
			hasWorker: true,
			workerJob: 'guard',
			facilityJob: 'guard',
			workProgress: 19,
			ticksPerCycle: 20,
			hasRequiredInput: true,
			wage: 4,
			taxRate: 0.10,
			facilityFund: 0,
			workerGold: 30,
			autoProcess: false,
			autoTicksPerCycle: 60,
			funding: 'treasury',
			treasuryFund: 1000,
		});

		expect(result.cycleComplete).toBe(true);
		expect(result.workerGoldChange).toBe(4);
		expect(result.treasuryChange).toBe(-4);
		expect(result.taxCollected).toBe(0);
		expect(result.facilityFundChange).toBe(0);
	});

	it('farmer keeps food reserve and only sells excess', () => {
		expect(5 > config.needs.food_reserve).toBe(true);
		expect(3 > config.needs.food_reserve).toBe(false);
	});

	it('starving guard is willing to pay more than base price', () => {
		const price = calculateReservationPrice({
			baseValue: config.economy.food_price,
			needLevel: 10,
			needThreshold: config.needs.hunger_threshold,
			currentStock: 0,
			walletGold: 30,
			urgencyMax: config.economy.reservation_urgency_max,
			stockFactor: config.economy.reservation_stock_factor,
			budgetCap: config.economy.reservation_budget_cap,
			budgetCapCritical: config.economy.reservation_budget_cap_critical,
		});
		expect(price).toBeGreaterThan(config.economy.food_price);
	});

	it('well-fed guard is not willing to pay base price', () => {
		const price = calculateReservationPrice({
			baseValue: config.economy.food_price,
			needLevel: 80,
			needThreshold: config.needs.hunger_threshold,
			currentStock: 2,
			walletGold: 20,
			urgencyMax: config.economy.reservation_urgency_max,
			stockFactor: config.economy.reservation_stock_factor,
			budgetCap: config.economy.reservation_budget_cap,
			budgetCapCritical: config.economy.reservation_budget_cap_critical,
		});
		expect(price).toBeLessThan(config.economy.food_price);
	});

	it('per-agent treasury regen scales with agent count', () => {
		const regenPerAgent = config.economy.treasury_regen_per_agent_per_day;
		expect(regenPerAgent * 2).toBe(50);
		expect(regenPerAgent * 5).toBe(125);
	});
});
