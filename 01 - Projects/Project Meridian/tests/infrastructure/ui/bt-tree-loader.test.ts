import { describe, it, expect, vi } from 'vitest';
import { loadStaticTree } from '../../../src/infrastructure/ui/bt-tree-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';
import type { Logger } from '../../../src/domain/core/logger.js';

const silentLogger: Logger = {
	debug: vi.fn(),
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
};

function mockVault(files: Record<string, string>): VaultReader {
	return {
		list: async () => [],
		read: async (path: string) => {
			if (path in files) return files[path]!;
			throw new Error(`Not found: ${path}`);
		},
	};
}

// Mistreevous requires exactly ONE unnamed root {} as the main entry.
// Named roots (e.g. root [Job] {}) are subtree definitions composed in via branch [Name].
// VALID_BASE is a standalone tree (what 'kind: base' loads).
// COMPOSABLE_BASE + VALID_BRANCH is what 'kind: job' composes.
const VALID_BASE = `root {
    selector {
        action [Wander]
    }
}`;

const COMPOSABLE_BASE = `root {
    branch [Job]
}`;

const VALID_BRANCH = `root [Job] {
    selector {
        action [Work]
        action [Wander]
    }
}`;

describe('loadStaticTree', () => {
	it('loads a base tree and returns NodeDetails', async () => {
		const vault = mockVault({ 'behavior-trees/base.mdsl': VALID_BASE });
		const details = await loadStaticTree(vault, { kind: 'base', path: 'behavior-trees/base.mdsl' }, silentLogger);
		expect(details.type).toBe('root');
	});

	it('loads a job tree by composing base + branch', async () => {
		// Use COMPOSABLE_BASE (has `branch [Job]` placeholder) for composition tests
		const vault = mockVault({
			'behavior-trees/base.mdsl': COMPOSABLE_BASE,
			'jobs/settler.mdsl': VALID_BRANCH,
		});
		const details = await loadStaticTree(vault, {
			kind: 'job',
			branchPath: 'jobs/settler.mdsl',
			basePath: 'behavior-trees/base.mdsl',
		}, silentLogger);
		expect(details.type).toBe('root');
	});

	it('throws descriptive error when job composition fails (missing base)', async () => {
		const vault = mockVault({ 'jobs/settler.mdsl': VALID_BRANCH });
		await expect(loadStaticTree(vault, {
			kind: 'job',
			branchPath: 'jobs/settler.mdsl',
			basePath: 'behavior-trees/base.mdsl',
		}, silentLogger)).rejects.toThrow(/base/i);
	});

	it('throws when MDSL is invalid', async () => {
		const vault = mockVault({ 'behavior-trees/base.mdsl': 'this is not valid mdsl' });
		await expect(loadStaticTree(vault, {
			kind: 'base',
			path: 'behavior-trees/base.mdsl',
		}, silentLogger)).rejects.toThrow();
	});

	it('throws when base file is missing', async () => {
		const vault = mockVault({});
		await expect(loadStaticTree(vault, {
			kind: 'base',
			path: 'behavior-trees/base.mdsl',
		}, silentLogger)).rejects.toThrow(/Not found/);
	});
});
