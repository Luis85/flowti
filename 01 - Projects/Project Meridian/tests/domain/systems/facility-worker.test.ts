import { describe, it, expect } from 'vitest';
import { findWorker, type WorkerCandidate } from '../../../src/domain/systems/facility-worker.js';

function makeAgent(overrides: Partial<WorkerCandidate> = {}): WorkerCandidate {
	return {
		agentId: 'bram',
		job: 'settler',
		pos: { x: 100, y: 100 },
		behaviorAgent: { btAction: 'work' },
		...overrides,
	};
}

describe('findWorker', () => {
	it('returns the agent when worker is present, correct job, and within radius', () => {
		const agent = makeAgent();
		const result = findWorker([agent], 'bram', 'settler', 100, 100, 50);
		expect(result).toBe(agent);
	});

	it('returns undefined when the matched agent has the wrong job', () => {
		const agent = makeAgent({ job: 'guard' });
		const result = findWorker([agent], 'bram', 'settler', 100, 100, 50);
		expect(result).toBeUndefined();
	});

	it('returns undefined when the matched agent is not performing the work action', () => {
		const agent = makeAgent({ behaviorAgent: { btAction: 'idle' } });
		const result = findWorker([agent], 'bram', 'settler', 100, 100, 50);
		expect(result).toBeUndefined();
	});

	it('returns undefined when the matched agent is out of radius', () => {
		const agent = makeAgent({ pos: { x: 500, y: 500 } });
		const result = findWorker([agent], 'bram', 'settler', 100, 100, 50);
		expect(result).toBeUndefined();
	});

	it('returns the specific matching agent when multiple candidates exist', () => {
		const alice = makeAgent({ agentId: 'alice' });
		const bram = makeAgent({ agentId: 'bram' });
		const cara = makeAgent({ agentId: 'cara' });
		const result = findWorker([alice, bram, cara], 'bram', 'settler', 100, 100, 50);
		expect(result).toBe(bram);
	});
});
