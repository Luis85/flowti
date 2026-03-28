import { describe, it, expect } from 'vitest';
import { AgentSchema } from '../../../src/domain/schemas/agent-schema.js';

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
		const result = AgentSchema.safeParse(validAgent);
		expect(result.success).toBe(true);
	});

	it('rejects an agent with invalid id prefix', () => {
		const result = AgentSchema.safeParse({ ...validAgent, id: 'npc-elena' });
		expect(result.success).toBe(false);
	});

	it('rejects attributes outside range 1-20', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			attributes: { ST: 25, DX: 10, IQ: 10, HT: 10 },
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
	});

	it('rejects needs outside 0-100 range', () => {
		const result = AgentSchema.safeParse({
			...validAgent,
			needs: { hunger: 150, energy: 50, social: 50 },
		});
		expect(result.success).toBe(false);
	});

	it('rejects mood outside -100 to 100 range', () => {
		const result = AgentSchema.safeParse({ ...validAgent, mood: 200 });
		expect(result.success).toBe(false);
	});
});
