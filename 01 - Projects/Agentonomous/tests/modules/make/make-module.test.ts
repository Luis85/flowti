import { describe, it, expect } from 'vitest';
import { MakeModule, getMakeService, VIEW_TYPE_MAKE } from '../../../src/modules/make/make-module.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts } from '../../__fakes__/fake-ports.js';

describe('MakeModule', () => {
	it('registers view and commands declaratively', () => {
		expect(MakeModule.views?.[0]?.type).toBe(VIEW_TYPE_MAKE);
		expect(MakeModule.commands?.[0]?.id).toBe('open-make');
	});
	it('init exposes a service; destroy clears it', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		expect(getMakeService()).not.toBeNull();
		await MakeModule.destroy();
		expect(getMakeService()).toBeNull();
	});
	it('init is idempotent', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		expect(getMakeService()).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange with folder change destroys and re-inits', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeService();
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, typesFolder: 'OtherTypes' });
		const after = getMakeService();
		expect(after).not.toBe(before);        // different service instance
		expect(after).not.toBeNull();
		await MakeModule.destroy();
	});
	it('onSettingsChange for non-folder change keeps the SAME service instance', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		const before = getMakeService();
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book'] });
		const after = getMakeService();
		expect(after).toBe(before);             // same instance — no rebuild
		await MakeModule.destroy();
	});
	it('onSettingsChange updates state.settings in place for non-folder changes', async () => {
		await MakeModule.init(fakeModulePorts(), MAKE_DEFAULTS);
		MakeModule.onSettingsChange?.({ ...MAKE_DEFAULTS, favorites: ['book', 'recipe'] });
		// The getter used by the service should now return the new favorites.
		// (Direct assertion is via the module-level getter exported for tests.)
		const { getMakeSettings } = await import('../../../src/modules/make/make-module.js');
		expect(getMakeSettings()?.favorites).toEqual(['book', 'recipe']);
		await MakeModule.destroy();
	});
});
