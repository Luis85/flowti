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
		autoProcess: false,
		autoTicksPerCycle: 10,
		funding: 'facility' as const,
		treasuryFund: 0,
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

describe('applyFacilityTick — auto-process', () => {
	function autoInput(overrides: Partial<FacilityTickInput> = {}): FacilityTickInput {
		return baseInput({
			hasWorker: false,
			workerJob: null,
			autoProcess: true,
			autoTicksPerCycle: 10,
			...overrides,
		});
	}

	it('produces output when no worker and auto_process is true on cycle completion', () => {
		const result = applyFacilityTick(autoInput({ workProgress: 9, autoTicksPerCycle: 10 }));
		expect(result.status).toBe('auto');
		expect(result.cycleComplete).toBe(true);
		expect(result.produceOutput).toBe(true);
		expect(result.consumeInput).toBe(true);
		expect(result.newWorkProgress).toBe(0);
	});

	it('does not pay wages on auto-process cycle completion', () => {
		const result = applyFacilityTick(autoInput({ workProgress: 9, autoTicksPerCycle: 10 }));
		expect(result.workerGoldChange).toBe(0);
		expect(result.facilityFundChange).toBe(0);
		expect(result.taxCollected).toBe(0);
	});

	it('uses autoTicksPerCycle instead of ticksPerCycle for cycle check', () => {
		// ticksPerCycle=5 but autoTicksPerCycle=10 — progress 5 should NOT complete when auto
		const notDone = applyFacilityTick(autoInput({ workProgress: 4, ticksPerCycle: 5, autoTicksPerCycle: 10 }));
		expect(notDone.cycleComplete).toBe(false);
		expect(notDone.status).toBe('auto');

		// progress 9 reaches autoTicksPerCycle=10
		const done = applyFacilityTick(autoInput({ workProgress: 9, ticksPerCycle: 5, autoTicksPerCycle: 10 }));
		expect(done.cycleComplete).toBe(true);
	});

	it('increments work progress during auto-process when cycle is not complete', () => {
		const result = applyFacilityTick(autoInput({ workProgress: 3, autoTicksPerCycle: 10 }));
		expect(result.newWorkProgress).toBe(4);
		expect(result.cycleComplete).toBe(false);
		expect(result.produceOutput).toBe(false);
	});

	it('returns idle with no_worker when no worker and auto_process is false', () => {
		const result = applyFacilityTick(baseInput({ hasWorker: false, workerJob: null, autoProcess: false }));
		expect(result.status).toBe('idle');
		expect(result.idleReason).toBe('no_worker');
	});

	it('normal worker production still works (regression)', () => {
		const result = applyFacilityTick(baseInput({ workProgress: 4, ticksPerCycle: 5 }));
		expect(result.status).toBe('producing');
		expect(result.cycleComplete).toBe(true);
		expect(result.workerGoldChange).toBeCloseTo(2.85);
	});
});

describe('treasury-funded facility', () => {
	it('pays full wage from treasury with no tax', () => {
		const result = applyFacilityTick(baseInput({
			workProgress: 4, funding: 'treasury', facilityFund: 0, treasuryFund: 500,
		}));
		expect(result.cycleComplete).toBe(true);
		expect(result.workerGoldChange).toBe(3); // full wage (baseInput wage=3), no tax
		expect(result.facilityFundChange).toBe(0);
		expect(result.treasuryChange).toBe(-3);
		expect(result.taxCollected).toBe(0);
	});

	it('pays partial wage when treasury is low', () => {
		const result = applyFacilityTick(baseInput({
			workProgress: 4, funding: 'treasury', facilityFund: 0, treasuryFund: 1,
		}));
		expect(result.workerGoldChange).toBe(1);
		expect(result.treasuryChange).toBe(-1);
	});
});
