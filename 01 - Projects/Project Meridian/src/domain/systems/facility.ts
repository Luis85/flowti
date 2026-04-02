export interface FacilityTickInput {
	hasWorker: boolean;
	workerJob: string | null;
	facilityJob: string;
	workProgress: number;
	ticksPerCycle: number;
	hasRequiredInput: boolean;
	wage: number;
	taxRate: number;
	facilityFund: number;
	workerGold: number;
	autoProcess: boolean;
	autoTicksPerCycle: number;
	funding: 'facility' | 'treasury';
	treasuryFund: number;
}

export interface FacilityTickResult {
	newWorkProgress: number;
	status: 'idle' | 'producing' | 'auto';
	cycleComplete: boolean;
	workerGoldChange: number;
	facilityFundChange: number;
	treasuryChange: number;
	taxCollected: number;
	consumeInput: boolean;
	produceOutput: boolean;
	idleReason: 'no_worker' | 'no_input' | null;
}

const IDLE_RESULT: Omit<FacilityTickResult, 'idleReason'> = {
	newWorkProgress: 0,
	status: 'idle',
	cycleComplete: false,
	workerGoldChange: 0,
	facilityFundChange: 0,
	treasuryChange: 0,
	taxCollected: 0,
	consumeInput: false,
	produceOutput: false,
};

export function applyFacilityTick(input: FacilityTickInput): FacilityTickResult {
	if (!input.hasWorker || input.workerJob !== input.facilityJob) {
		if (input.autoProcess) {
			if (!input.hasRequiredInput) {
				return { ...IDLE_RESULT, idleReason: 'no_input' };
			}
			const nextProgress = input.workProgress + 1;
			if (nextProgress >= input.autoTicksPerCycle) {
				return {
					newWorkProgress: 0,
					status: 'auto',
					cycleComplete: true,
					workerGoldChange: 0,
					facilityFundChange: 0,
					treasuryChange: 0,
					taxCollected: 0,
					consumeInput: true,
					produceOutput: true,
					idleReason: null,
				};
			}
			return {
				newWorkProgress: nextProgress,
				status: 'auto',
				cycleComplete: false,
				workerGoldChange: 0,
				facilityFundChange: 0,
				treasuryChange: 0,
				taxCollected: 0,
				consumeInput: false,
				produceOutput: false,
				idleReason: null,
			};
		}
		return { ...IDLE_RESULT, idleReason: 'no_worker' };
	}
	if (!input.hasRequiredInput) {
		return { ...IDLE_RESULT, idleReason: 'no_input' };
	}
	const nextProgress = input.workProgress + 1;
	if (nextProgress >= input.ticksPerCycle) {
		if (input.funding === 'treasury') {
			const actualWage = Math.min(input.wage, input.treasuryFund);
			return {
				newWorkProgress: 0,
				status: 'producing',
				cycleComplete: true,
				workerGoldChange: actualWage,
				facilityFundChange: 0,
				treasuryChange: -actualWage,
				taxCollected: 0,
				consumeInput: true,
				produceOutput: true,
				idleReason: null,
			};
		}
		const actualWage = Math.min(input.wage, input.facilityFund);
		const tax = actualWage * input.taxRate;
		const netWage = actualWage - tax;
		return {
			newWorkProgress: 0,
			status: 'producing',
			cycleComplete: true,
			workerGoldChange: netWage,
			facilityFundChange: actualWage === 0 ? 0 : -actualWage,
			treasuryChange: 0,
			taxCollected: tax,
			consumeInput: true,
			produceOutput: true,
			idleReason: null,
		};
	}
	return {
		newWorkProgress: nextProgress,
		status: 'producing',
		cycleComplete: false,
		workerGoldChange: 0,
		facilityFundChange: 0,
		treasuryChange: 0,
		taxCollected: 0,
		consumeInput: false,
		produceOutput: false,
		idleReason: null,
	};
}
