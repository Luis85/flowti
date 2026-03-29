import { describe, it, expect } from 'vitest';
import { applySocialize } from '../../../src/domain/systems/socialize.js';

const defaultConfig = {
	recovery_rate: 0.5,
	memory_significance: 3,
	memory_mood_impact: 2,
	cooldown_ticks: 50,
};

describe('applySocialize', () => {
	it('recovers social at configured rate', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.newSocial).toBe(50.5);
		expect(result.recovered).toBe(0.5);
	});

	it('creates memory when not on cooldown', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.memory).not.toBeNull();
		expect(result.memory?.type).toBe('social');
		expect(result.memory?.participants).toEqual(['agent-marcus']);
		expect(result.memory?.outcome).toBe('positive');
		expect(result.memory?.significance).toBe(3);
		expect(result.memory?.mood_impact).toBe(2);
	});

	it('does not create memory when on cooldown', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 120, lastSocialTick: 100,
		}, defaultConfig);
		// 120 - 100 = 20, < cooldown 50 → on cooldown
		expect(result.memory).toBeNull();
		expect(result.recovered).toBe(0.5); // social still recovers
	});

	it('creates memory when cooldown expired', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 200, lastSocialTick: 100,
		}, defaultConfig);
		// 200 - 100 = 100, >= cooldown 50 → ok
		expect(result.memory).not.toBeNull();
	});

	it('clamps social to 100', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 99.8, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.newSocial).toBe(100);
	});

	it('includes partner name in memory description', () => {
		const result = applySocialize({
			agentId: 'agent-elena', agentName: 'Elena',
			partnerId: 'agent-marcus', partnerName: 'Marcus',
			currentSocial: 50, currentTick: 100, lastSocialTick: null,
		}, defaultConfig);
		expect(result.memory?.description).toContain('Marcus');
	});
});
