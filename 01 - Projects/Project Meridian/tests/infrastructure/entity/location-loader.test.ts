import { describe, it, expect, vi } from 'vitest';
import { createLocationLoader } from '../../../src/infrastructure/entity/location-loader.js';
import type { VaultReader } from '../../../src/infrastructure/entity/agent-spawner.js';

const validLocation = { id: 'loc-tavern', name: 'The Rusty Anchor', facility_type: 'tavern', position: { x: 300, y: 200 }, capacity: 5 };
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

describe('LocationLoader', () => {
	it('loads valid location', async () => {
		const vault = createMockVault({ 'locations/tavern.json': JSON.stringify(validLocation) });
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(1);
		expect(result.items[0]?.id).toBe('loc-tavern');
	});

	it('skips invalid location and collects error', async () => {
		const vault = createMockVault({ 'locations/bad.json': '{"invalid": true}' });
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(1);
	});

	it('handles empty directory', async () => {
		const vault = createMockVault({});
		const loader = createLocationLoader(logger);
		const result = await loader.loadFromVault(vault, 'locations/');
		expect(result.items).toHaveLength(0);
		expect(result.errors).toHaveLength(0);
	});
});
