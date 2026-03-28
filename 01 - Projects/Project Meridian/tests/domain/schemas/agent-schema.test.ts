import { describe, it, expect } from 'vitest';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';
import {
	ATTRIBUTE_RANGE,
	STATUS_RANGE,
	REPUTATION_RANGE,
	NEED_RANGE,
	MOOD_RANGE,
} from '../../../src/domain/schemas/ranges.js';

describe('AgentSchema', () => {
	const validAgent = {
		id: 'agent-merchant-elena',
		name: 'Elena Vasquez',
		kind: 'merchant',
		attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 },
		social: { status: 0, reputation: 0, charisma: 14 },
		needs: { hunger: 80, energy: 90, social: 70 },
		mood: 50,
		wallet: { gold: 100 },
		position: { x: 100, y: 200, region: 'loc-marketplace' },
		behavior_tree: 'config/kinds/merchant-bt.json',
	};

	it('validates a well-formed agent', () => {
		expect(AgentSchema.safeParse(validAgent).success).toBe(true);
	});

	it('rejects an agent with invalid id prefix', () => {
		expect(AgentSchema.safeParse({ ...validAgent, id: 'npc-elena' }).success).toBe(false);
	});

	it('rejects attributes above max', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			attributes: { ST: ATTRIBUTE_RANGE.max + 1, DX: 10, IQ: 10, HT: 10 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects attributes below min', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			attributes: { ST: ATTRIBUTE_RANGE.min - 1, DX: 10, IQ: 10, HT: 10 },
		});
		expect(result.success).toBe(false);
	});

	it('applies defaults for optional arrays', () => {
		const result = AgentSchema.parse(validAgent);
		expect(result.memory).toEqual([]);
		expect(result.goals).toEqual([]);
		expect(result.skills).toEqual([]);
		expect(result.traits).toEqual([]);
		expect(result.inventory).toEqual([]);
		expect(result.property).toEqual([]);
		expect(result.tools).toEqual([]);
		expect(result.equipment).toEqual({
			head: null, body: null, hands: null, tool: null, accessory: null,
		});
	});

	it('rejects needs above max', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			needs: { hunger: NEED_RANGE.max + 1, energy: 50, social: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects mood above max', () => {
		expect(AgentSchema.safeParse({ ...validAgent, mood: MOOD_RANGE.max + 1 }).success).toBe(false);
	});

	it('rejects mood below min', () => {
		expect(AgentSchema.safeParse({ ...validAgent, mood: MOOD_RANGE.min - 1 }).success).toBe(false);
	});

	it('accepts status at boundaries', () => {
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, status: STATUS_RANGE.min } }).success).toBe(true);
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, status: STATUS_RANGE.max } }).success).toBe(true);
	});

	it('rejects status outside boundaries', () => {
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, status: STATUS_RANGE.min - 1 } }).success).toBe(false);
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, status: STATUS_RANGE.max + 1 } }).success).toBe(false);
	});

	it('accepts reputation at boundaries', () => {
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, reputation: REPUTATION_RANGE.min } }).success).toBe(true);
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, reputation: REPUTATION_RANGE.max } }).success).toBe(true);
	});

	it('rejects reputation outside boundaries', () => {
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, reputation: REPUTATION_RANGE.min - 1 } }).success).toBe(false);
		expect(AgentSchema.safeParse({ ...validAgent, social: { ...validAgent.social, reputation: REPUTATION_RANGE.max + 1 } }).success).toBe(false);
	});

	it('requires wallet (no default)', () => {
		const { wallet: _omitted, ...noWallet } = validAgent;
		expect(AgentSchema.safeParse(noWallet).success).toBe(false);
	});
});
