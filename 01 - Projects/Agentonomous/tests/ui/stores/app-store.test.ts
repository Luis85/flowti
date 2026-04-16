import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAppStore } from '../../../src/ui/stores/app-store.js';

describe('useAppStore', () => {
	it('exposes default greeting and version', () => {
		setActivePinia(createPinia());
		const store = useAppStore();
		expect(store.greeting).toBe('Hello from Agentonomous');
		expect(store.pluginVersion).toBe('0.0.0');
	});

	it('setVersion() updates pluginVersion', () => {
		setActivePinia(createPinia());
		const store = useAppStore();
		store.setVersion('1.2.3');
		expect(store.pluginVersion).toBe('1.2.3');
	});
});
