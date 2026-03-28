import { describe, it, expect, vi } from 'vitest';
import { createBTLoader } from '../../../src/infrastructure/entity/bt-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validBT = { id: 'bt-merchant', root: { type: 'selector', children: [{ type: 'action', action: 'idle', params: {} }] } };
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

describe('BTLoader', () => {
	it('loads valid BT definition', async () => {
		const vault = createMockVault({ 'bt/merchant.json': JSON.stringify(validBT) });
		const loader = createBTLoader(logger);
		const result = await loader.loadFromVault(vault, 'bt/');
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe('bt-merchant');
	});

	it('skips invalid BT and collects error', async () => {
		const vault = createMockVault({ 'bt/bad.json': '{"id": "bad"}' });
		const loader = createBTLoader(logger);
		const result = await loader.loadFromVault(vault, 'bt/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});
});
