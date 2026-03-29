import { describe, it, expect } from 'vitest';
import { TraitDefinitionSchema } from '../../../src/domain/schemas/trait-definition-schema.js';

describe('TraitDefinitionSchema', () => {
	it('parses a valid definition', () => {
		const input = {
			id: 'hardy',
			effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
			conflicts_with: ['frail'],
		};
		const result = TraitDefinitionSchema.safeParse(input);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.id).toBe('hardy');
			expect(result.data.effects).toHaveLength(1);
			expect(result.data.conflicts_with).toEqual(['frail']);
		}
	});

	it('defaults effects to [] when missing', () => {
		const result = TraitDefinitionSchema.parse({ id: 'curious' });
		expect(result.effects).toEqual([]);
	});

	it('defaults conflicts_with to [] when missing', () => {
		const result = TraitDefinitionSchema.parse({ id: 'curious' });
		expect(result.conflicts_with).toEqual([]);
	});

	it('rejects empty id', () => {
		const result = TraitDefinitionSchema.safeParse({ id: '' });
		expect(result.success).toBe(false);
	});
});
