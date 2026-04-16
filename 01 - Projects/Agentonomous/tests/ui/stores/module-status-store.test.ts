import { describe, expect, it } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useModuleStatusStore } from '../../../src/ui/stores/module-status-store.js';

describe('useModuleStatusStore', () => {
	it('starts with an empty modules list', () => {
		setActivePinia(createPinia());
		const store = useModuleStatusStore();
		expect(store.modules).toHaveLength(0);
	});

	it('setModules() populates the modules list', () => {
		setActivePinia(createPinia());
		const store = useModuleStatusStore();
		store.setModules([
			{ id: 'core', name: 'Core', status: 'ready' },
			{ id: 'broken', name: 'Broken', status: 'degraded' },
		]);
		expect(store.modules).toHaveLength(2);
		expect(store.modules[0].status).toBe('ready');
		expect(store.modules[1].status).toBe('degraded');
	});

	it('setModules() replaces existing modules', () => {
		setActivePinia(createPinia());
		const store = useModuleStatusStore();
		store.setModules([{ id: 'a', name: 'A', status: 'ready' }]);
		store.setModules([{ id: 'b', name: 'B', status: 'degraded' }]);
		expect(store.modules).toHaveLength(1);
		expect(store.modules[0].id).toBe('b');
	});
});
