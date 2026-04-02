import { describe, it, expect } from 'vitest';
import { createItemLoader } from '../../../src/infrastructure/entity/item-loader.js';
import type { Logger } from '../../../src/domain/core/logger.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

function stubLogger(): Logger {
	return {
		info: () => {},
		warn: () => {},
		debug: () => {},
		error: () => {},
	};
}

function stubVault(files: Record<string, string>): VaultReader {
	return {
		list: async (path: string) => Object.keys(files).filter(f => f.startsWith(path)),
		read: async (path: string) => files[path] ?? '',
	};
}

describe('ItemLoader', () => {
	it('loads valid item files', async () => {
		const vault = stubVault({
			'items/bread.json': JSON.stringify({ id: 'bread', name: 'Bread', baseValue: 5, category: 'subsistence' }),
			'items/wheat.json': JSON.stringify({ id: 'wheat', name: 'Wheat', baseValue: 2 }),
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(2);
		expect(result.errors).toHaveLength(0);
		expect(result.items[0].id).toBe('bread');
		expect(result.items[0].category).toBe('subsistence');
		expect(result.items[1].category).toBe('trade_goods'); // default
	});

	it('reports errors for invalid files', async () => {
		const vault = stubVault({
			'items/bad.json': JSON.stringify({ id: '', name: 'Bad', baseValue: -1 }),
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0].file).toBe('items/bad.json');
	});

	it('handles malformed JSON', async () => {
		const vault = stubVault({
			'items/broken.json': '{ not valid json',
		});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});

	it('returns empty result for empty directory', async () => {
		const vault = stubVault({});
		const loader = createItemLoader(stubLogger());
		const result = await loader.loadFromVault(vault, 'items');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
