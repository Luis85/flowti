import { describe, it, expect, vi } from 'vitest';
import { createMDSLLoader } from '../../../src/infrastructure/entity/bt-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const MINIMAL_BASE = `root {
    selector {
        sequence {
            condition [IsDaytime]
            branch [Role]
        }
        action [Wander]
    }
}`;

const MINIMAL_BRANCH = `root [Role] {
    selector {
        action [Wander]
    }
}`;

const GARBAGE_MDSL = 'this is not valid mdsl %%%;';

function createMockVault(files: Record<string, string>): VaultReader {
	return {
		async list(path: string): Promise<string[]> {
			return Object.keys(files).filter(f => f.startsWith(path));
		},
		async read(path: string): Promise<string> {
			const content = files[path];
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		},
	};
}

describe('MDSLLoader', () => {
	it('composes base + branch MDSL into a single string', async () => {
		const vault = createMockVault({
			'bt/base.mdsl': MINIMAL_BASE,
			'bt/branch-artisan.mdsl': MINIMAL_BRANCH,
		});
		const loader = createMDSLLoader(logger);
		const result = await loader.loadComposed(vault, 'bt/base.mdsl', 'bt/branch-artisan.mdsl');
		expect(result.mdsl).not.toBeNull();
		expect(result.mdsl).toContain('branch [Role]');
		expect(result.mdsl).toContain('root [Role]');
	});

	it('returns error when base file is missing', async () => {
		const vault = createMockVault({
			'bt/branch-artisan.mdsl': MINIMAL_BRANCH,
		});
		const loader = createMDSLLoader(logger);
		const result = await loader.loadComposed(vault, 'bt/base.mdsl', 'bt/branch-artisan.mdsl');
		expect(result.mdsl).toBeNull();
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('bt/base.mdsl');
	});

	it('returns error when branch file is missing', async () => {
		const vault = createMockVault({
			'bt/base.mdsl': MINIMAL_BASE,
		});
		const loader = createMDSLLoader(logger);
		const result = await loader.loadComposed(vault, 'bt/base.mdsl', 'bt/branch-artisan.mdsl');
		expect(result.mdsl).toBeNull();
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]?.file).toBe('bt/branch-artisan.mdsl');
	});

	it('validates composed MDSL via mistreevous', async () => {
		const vault = createMockVault({
			'bt/base.mdsl': MINIMAL_BASE,
			'bt/branch-artisan.mdsl': MINIMAL_BRANCH,
		});
		const loader = createMDSLLoader(logger);
		const result = await loader.loadComposed(vault, 'bt/base.mdsl', 'bt/branch-artisan.mdsl');
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it('detects invalid MDSL', async () => {
		const vault = createMockVault({
			'bt/base.mdsl': GARBAGE_MDSL,
			'bt/branch-artisan.mdsl': MINIMAL_BRANCH,
		});
		const loader = createMDSLLoader(logger);
		const result = await loader.loadComposed(vault, 'bt/base.mdsl', 'bt/branch-artisan.mdsl');
		expect(result.valid).toBe(false);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
