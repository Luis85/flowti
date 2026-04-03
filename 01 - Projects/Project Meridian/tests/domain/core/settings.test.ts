import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../../../src/domain/core/settings.js';

describe('MeridianSettings', () => {
	it('has sensible defaults', () => {
		expect(DEFAULT_SETTINGS.logLevel).toBe('info');
		expect(DEFAULT_SETTINGS.debugMode).toBe(false);
		expect(DEFAULT_SETTINGS.performanceTracking).toBe(false);
		expect(DEFAULT_SETTINGS.gameSpeed).toBe(1);
		expect(DEFAULT_SETTINGS.hungerRate).toBe(1);
		expect(DEFAULT_SETTINGS.thirstRate).toBe(1);
		expect(DEFAULT_SETTINGS.energyRate).toBe(1);
		expect(DEFAULT_SETTINGS.foodPrice).toBe(0);
	});
});
