import { describe, it, expect } from 'vitest';
import { createGameLoader } from '../../../src/infrastructure/engine/game-loader.js';

describe('GameLoader', () => {
	it('creates a loader instance', () => {
		const loader = createGameLoader();
		expect(loader).toBeDefined();
	});

	it('resolves user action immediately (no click prompt)', async () => {
		const loader = createGameLoader();
		// onUserAction should resolve without waiting for user interaction
		await expect(loader.onUserAction()).resolves.toBeUndefined();
	});
});
