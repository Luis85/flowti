import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
	FileDetailView,
	VIEW_TYPE_FILE_DETAIL,
	FILE_DETAIL_VIEW_REGISTRATION,
} from '../../../../src/infrastructure/obsidian/views/file-detail-view.js';
import type { PluginContext } from '../../../../src/plugin.js';

describe('VIEW_TYPE_FILE_DETAIL', () => {
	it('is the expected string', () => {
		expect(VIEW_TYPE_FILE_DETAIL).toBe('agentonomous-file-detail');
	});
});

describe('FILE_DETAIL_VIEW_REGISTRATION', () => {
	it('points at the right view type and default location', () => {
		expect(FILE_DETAIL_VIEW_REGISTRATION.type).toBe(VIEW_TYPE_FILE_DETAIL);
		expect(FILE_DETAIL_VIEW_REGISTRATION.defaultLocation).toBe('right');
	});

	it('viewFactory returns a new FileDetailView', () => {
		const instance = FILE_DETAIL_VIEW_REGISTRATION.viewFactory({} as never, {} as never);
		expect(instance).toBeInstanceOf(FileDetailView);
	});
});

describe('FileDetailView basics', () => {
	it('getViewType() returns the view type', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.getViewType()).toBe(VIEW_TYPE_FILE_DETAIL);
	});

	it('getDisplayText() returns "File detail" when no file is loaded', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.getDisplayText()).toBe('File detail');
	});

	it('getDisplayText() returns the filename when a file is loaded', () => {
		const view = new FileDetailView({} as never, {} as never);
		(view as unknown as { currentFile: string | null }).currentFile = 'notes/plan.json';
		expect(view.getDisplayText()).toBe('plan.json');
	});

	it('getIcon() returns a non-empty string', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.getIcon()).toBeTruthy();
	});

	it('getState() omits the file key when no file is set', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.getState()['file']).toBeUndefined();
	});

	it('getState() includes the file key when a file is set', () => {
		const view = new FileDetailView({} as never, {} as never);
		(view as unknown as { currentFile: string | null }).currentFile = 'notes/plan.json';
		expect(view.getState()['file']).toBe('notes/plan.json');
	});

	it('onClose() unmounts the Vue app and clears references', async () => {
		const view = new FileDetailView({} as never, {} as never);
		const unmount = vi.fn();
		(view as unknown as { mounted: { unmount: () => void } | null }).mounted = { unmount };
		(view as unknown as { store: unknown }).store = {};
		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(unmount).toHaveBeenCalledTimes(1);
		expect((view as unknown as { mounted: unknown }).mounted).toBeNull();
		expect((view as unknown as { store: unknown }).store).toBeNull();
	});
});

describe('FileDetailView — onOpen error branch', () => {
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
		const { FileDetailView: FV } = await import(
			'../../../../src/infrastructure/obsidian/views/file-detail-view.js'
		);
		const view = new FV({} as never, {} as unknown as PluginContext);
		await (view as unknown as { onOpen: () => Promise<void> }).onOpen();
		const el = (view as unknown as { contentEl: HTMLElement }).contentEl;
		expect(el.textContent).toContain('File detail failed to load');
		expect(el.textContent).toContain('Vue boom');
	});
});
