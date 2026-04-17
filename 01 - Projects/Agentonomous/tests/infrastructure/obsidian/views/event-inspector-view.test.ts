import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	EventInspectorView,
	VIEW_TYPE_EVENT_INSPECTOR,
	EVENT_INSPECTOR_VIEW_REGISTRATION,
} from '../../../../src/infrastructure/obsidian/views/event-inspector-view.js';
import type { PluginContext } from '../../../../src/plugin.js';

describe('VIEW_TYPE_EVENT_INSPECTOR', () => {
	it('is the expected string', () => {
		expect(VIEW_TYPE_EVENT_INSPECTOR).toBe('agentonomous-event-inspector');
	});
});

describe('EVENT_INSPECTOR_VIEW_REGISTRATION', () => {
	it('points at the right view type and default location', () => {
		expect(EVENT_INSPECTOR_VIEW_REGISTRATION.type).toBe(VIEW_TYPE_EVENT_INSPECTOR);
		expect(EVENT_INSPECTOR_VIEW_REGISTRATION.defaultLocation).toBe('right');
	});

	it('viewFactory returns a new EventInspectorView', () => {
		const instance = EVENT_INSPECTOR_VIEW_REGISTRATION.viewFactory({} as never, {} as never);
		expect(instance).toBeInstanceOf(EventInspectorView);
	});
});

describe('EventInspectorView basics', () => {
	it('getViewType() returns the view type', () => {
		const view = new EventInspectorView({} as never, {} as never);
		expect(view.getViewType()).toBe(VIEW_TYPE_EVENT_INSPECTOR);
	});

	it('getDisplayText() returns a non-empty string', () => {
		const view = new EventInspectorView({} as never, {} as never);
		expect(view.getDisplayText()).toBeTruthy();
	});

	it('getIcon() returns a non-empty string', () => {
		const view = new EventInspectorView({} as never, {} as never);
		expect(view.getIcon()).toBeTruthy();
	});

	it('onClose() unmounts the Vue app and clears the events subscription', async () => {
		const view = new EventInspectorView({} as never, {} as never);
		const unmount = vi.fn();
		const eventsUnsub = vi.fn();
		(view as unknown as { mounted: { unmount: () => void } | null }).mounted = { unmount };
		(view as unknown as { eventsUnsub: (() => void) | null }).eventsUnsub = eventsUnsub;
		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(unmount).toHaveBeenCalledTimes(1);
		expect(eventsUnsub).toHaveBeenCalledTimes(1);
		expect((view as unknown as { mounted: unknown }).mounted).toBeNull();
		expect((view as unknown as { eventsUnsub: unknown }).eventsUnsub).toBeNull();
	});
});

describe('EventInspectorView — onOpen error branch', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.doMock('../../../../src/ui/create-module-vue-app.js', () => ({
			createModuleVueApp: () => { throw new Error('Vue boom'); },
		}));
	});

	afterEach(() => {
		vi.doUnmock('../../../../src/ui/create-module-vue-app.js');
	});

	it('renders fallback error text when mounting fails', async () => {
		const { EventInspectorView: EV } = await import(
			'../../../../src/infrastructure/obsidian/views/event-inspector-view.js'
		);
		const view = new EV({} as never, {} as unknown as PluginContext);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		const el = (view as unknown as { contentEl: HTMLElement }).contentEl;
		expect(el.textContent).toContain('Event inspector failed to load');
		expect(el.textContent).toContain('Vue boom');
	});
});
