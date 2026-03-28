import { describe, it, expect } from 'vitest';
import { createVaultLoader } from '../../../src/infrastructure/vault/vault-loader.js';
import { AgentSchema } from '../../../src/domain/schemas/index.js';
import { TraitSchema, TRAIT_CATEGORIES, TRAIT_ASSIGNABLE_BY } from '../../../src/domain/schemas/index.js';

describe('VaultLoader', () => {
	const validAgentMd = `---
id: agent-merchant-elena
name: Elena Vasquez
kind: merchant
attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 }
social: { status: 0, reputation: 0, charisma: 14 }
needs: { hunger: 80, energy: 90, social: 70 }
wallet: { gold: 100 }
position: { x: 100, y: 200, region: loc-marketplace }
behavior_tree: config/kinds/merchant-bt.json
---
Elena is a merchant.`;

	const invalidAgentMd = `---
id: bad-prefix
name: Bad
---
Invalid agent.`;

	it('loads and validates a well-formed agent file', () => {
		const loader = createVaultLoader();
		const result = loader.loadEntity(validAgentMd, AgentSchema, 'agents/elena.md');
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.value.id).toBe('agent-merchant-elena');
			expect(result.value.name).toBe('Elena Vasquez');
			expect(result.value.traits).toEqual([]);
		}
	});

	it('returns error and quarantines an invalid agent file', () => {
		const loader = createVaultLoader();
		const result = loader.loadEntity(invalidAgentMd, AgentSchema, 'agents/bad.md');
		expect(result.ok).toBe(false);
		expect(loader.quarantined).toContain('agents/bad.md');
	});

	it('returns error for file with no frontmatter and attaches filePath in context', () => {
		const loader = createVaultLoader();
		const result = loader.loadEntity('Just text.', AgentSchema, 'agents/none.md');
		expect(result.ok).toBe(false);
		expect(loader.quarantined).toContain('agents/none.md');
		if (!result.ok) {
			expect(result.error.context).toEqual({ filePath: 'agents/none.md' });
		}
	});

	it('loads a valid trait file', () => {
		const traitMd = `---
id: trait-unkillable
name: Unkillable
description: Cannot die.
category: ${TRAIT_CATEGORIES[0]}
effects:
  - system: MortalityCheck
    modifier: { prevent_death: true }
assignable_by: ${TRAIT_ASSIGNABLE_BY[0]}
stackable: false
conflicts_with: []
---`;
		const loader = createVaultLoader();
		const result = loader.loadEntity(traitMd, TraitSchema, 'config/traits/unkillable.md');
		expect(result.ok).toBe(true);
	});
});
