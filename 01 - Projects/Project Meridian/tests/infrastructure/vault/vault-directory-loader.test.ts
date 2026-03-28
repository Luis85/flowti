import { describe, it, expect, vi } from 'vitest';
import { createVaultDirectoryLoader } from '../../../src/infrastructure/vault/vault-directory-loader.js';
import { createMemfsVaultAdapter } from '../../../src/infrastructure/vault/memfs-vault-adapter.js';
import { Result } from '../../../src/domain/core/result.js';
import type { VaultAdapter } from '../../../src/domain/core/platform.js';
import { AgentSchema, TraitSchema, TRAIT_CATEGORIES, TRAIT_ASSIGNABLE_BY } from '../../../src/domain/schemas/index.js';

describe('VaultDirectoryLoader', () => {
	const agentElena = `---
id: agent-merchant-elena
name: Elena Vasquez
kind: merchant
attributes: { ST: 10, DX: 10, IQ: 12, HT: 10 }
social: { status: 0, reputation: 0, charisma: 14 }
needs: { hunger: 80, energy: 90, social: 70 }
wallet: { gold: 100 }
position: { x: 100, y: 200, region: loc-marketplace }
behavior_tree: config/kinds/merchant-bt.json
---`;

	const agentBad = `---
id: bad-prefix
name: Bad
---`;

	const traitUnkillable = `---
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

	it('loads all valid agents from a directory', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': agentElena,
			'config/traits/unkillable.md': traitUnkillable,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.loaded[0]?.id).toBe('agent-merchant-elena');
		expect(result.quarantined).toHaveLength(0);
	});

	it('quarantines invalid files and continues loading valid ones', async () => {
		const adapter = createMemfsVaultAdapter({
			'agents/elena.md': agentElena,
			'agents/bad.md': agentBad,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.quarantined).toHaveLength(1);
		expect(result.quarantined[0]).toBe('agents/bad.md');
	});

	it('loads traits from config directory', async () => {
		const adapter = createMemfsVaultAdapter({
			'config/traits/unkillable.md': traitUnkillable,
		});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('config/traits/', TraitSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.loaded[0]?.id).toBe('trait-unkillable');
	});

	it('returns empty results for empty directory', async () => {
		const adapter = createMemfsVaultAdapter({});
		const loader = createVaultDirectoryLoader(adapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(0);
		expect(result.quarantined).toHaveLength(0);
	});

	it('quarantines files that fail to read and continues loading', async () => {
		const inner = createMemfsVaultAdapter({ 'agents/elena.md': agentElena });
		const failingAdapter: VaultAdapter = {
			...inner,
			readFile(path: string) {
				if (path === 'agents/corrupt.md') {
					return Promise.resolve(Result.err({
						code: 'READ_ERROR', message: 'disk error', system: 'VaultAdapter', recoverable: true,
					}));
				}
				return inner.readFile(path);
			},
			listFiles() {
				return Promise.resolve(['agents/elena.md', 'agents/corrupt.md']);
			},
		};

		const loader = createVaultDirectoryLoader(failingAdapter);
		const result = await loader.loadDirectory('agents/', AgentSchema);

		expect(result.loaded).toHaveLength(1);
		expect(result.quarantined).toContain('agents/corrupt.md');
	});

	it('calls logger when provided', async () => {
		const adapter = createMemfsVaultAdapter({ 'agents/elena.md': agentElena });
		const mockLogger = {
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		};
		const loader = createVaultDirectoryLoader(adapter, mockLogger);
		await loader.loadDirectory('agents/', AgentSchema);

		expect(mockLogger.info).toHaveBeenCalledOnce();
	});
});
