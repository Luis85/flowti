import { describe, it, expect, vi } from 'vitest';
import { createTraitLoader } from '../../../src/infrastructure/entity/trait-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validTrait = {
	id: 'hardy',
	effects: [{ system: 'NeedsDecaySystem', modifier: { hungerDecayScale: 0.8 } }],
	conflicts_with: ['frail'],
};

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> { return Object.keys(files).filter(f => f.startsWith(path)); },
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('TraitLoader', () => {
	it('loads valid trait definition', async () => {
		const vault = createMockVault({ 'traits/hardy.json': JSON.stringify(validTrait) });
		const loader = createTraitLoader(logger);
		const result = await loader.loadFromVault(vault, 'traits/');
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe('hardy');
		expect(result.errors).toHaveLength(0);
	});

	it('skips invalid trait and collects error', async () => {
		const vault = createMockVault({ 'traits/bad.json': '{"id": ""}' });
		const loader = createTraitLoader(logger);
		const result = await loader.loadFromVault(vault, 'traits/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('traits/bad.json');
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const loader = createTraitLoader(logger);
		const result = await loader.loadFromVault(vault, 'traits/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
