import { describe, it, expect } from 'vitest';
import { applyFacilityTick } from '../../../src/domain/systems/facility.js';
import type { FacilityTickInput } from '../../../src/domain/systems/facility.js';

function baseInput(overrides: Partial<FacilityTickInput> = {}): FacilityTickInput {
	return {
		hasWorker: true,
		workerJob: 'baker',
		facilityJob: 'baker',
		workProgress: 0,
		ticksPerCycle: 5,
		hasRequiredInput: true,
		wage: 3,
		taxRate: 0.05,
		facilityFund: 100,
		workerGold: 10,
		...overrides,
	};
}

describe('applyFacilityTick', () => {
	it('returns idle when no worker', () => {
		const result = applyFacilityTick(baseInput({ hasWorker: false }));
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_worker');
		expect(result.newWorkProgress).toBe(0);
	});

	it('returns idle when missing required input', () => {
		const result = applyFacilityTick(baseInput({ hasRequiredInput: false }));
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_input');
	});

	it('increments work progress when producing', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 2 }));
		expect(result.newWorkProgress).toBe(3);
		expect(result.status).toBe('producing');
		expect(result.cycleComplete).toBe(false);
	});

	it('completes cycle when workProgress reaches ticksPerCycle', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 4, ticksPerCycle: 5 }));
		expect(result.cycleComplete).toBe(true);
		expect(result.newWorkProgress).toBe(0);
		expect(result.consumeInput).toBe(true);
		expect(result.produceOutput).toBe(true);
	});

	it('calculates net wage and tax correctly', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 4, ticksPerCycle: 5, wage: 3, taxRate: 0.05 }));
		expect(result.taxCollected).toBeCloseTo(0.15);
		expect(result.workerGoldChange).toBeCloseTo(2.85);
		expect(result.facilityFundChange).toBe(-3);
	});

	it('pays partial wage when facility fund is insufficient', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 4, ticksPerCycle: 5, wage: 3, facilityFund: 2 }));
		expect(result.facilityFundChange).toBe(-2);
		expect(result.workerGoldChange).toBeCloseTo(2 - 2 * 0.05);
		expect(result.taxCollected).toBeCloseTo(2 * 0.05);
	});

	it('does not consume input when cycle is incomplete', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 1, ticksPerCycle: 5 }));
		expect(result.consumeInput).toBe(false);
		expect(result.produceOutput).toBe(false);
	});

	it('does not pay when facility fund is zero', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 4, ticksPerCycle: 5, facilityFund: 0 }));
		expect(result.workerGoldChange).toBe(0);
		expect(result.facilityFundChange).toBe(0);
		expect(result.taxCollected).toBe(0);
	});

	it('starts at workProgress 0 for first tick', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 0 }));
		expect(result.newWorkProgress).toBe(1);
		expect(result.cycleComplete).toBe(false);
	});

	it('returns job mismatch as no_worker', () => {
		const result = applyFacilityTick(baseInput({ workerJob: 'miner', facilityJob: 'baker' }));
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_worker');
	});
});
