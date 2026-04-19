import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { TFile } from 'obsidian';
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

	it('getDisplayText() returns "File detail" when file is undefined (pre-onLoadFile)', () => {
		const view = new FileDetailView({} as never, {} as never);
		(view as unknown as { file: unknown }).file = undefined;
		expect(view.getDisplayText()).toBe('File detail');
	});

	it('getDisplayText() returns the filename when a file is loaded', () => {
		const view = new FileDetailView({} as never, {} as never);
		view.file = new TFile('notes/plan.json');
		expect(view.getDisplayText()).toBe('plan.json');
	});

	it('getIcon() returns a non-empty string', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.getIcon()).toBeTruthy();
	});

	it('canAcceptExtension() accepts registered handlers (json, csv)', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.canAcceptExtension('json')).toBe(true);
		expect(view.canAcceptExtension('csv')).toBe(true);
	});

	it('canAcceptExtension() rejects unregistered extensions', () => {
		const view = new FileDetailView({} as never, {} as never);
		expect(view.canAcceptExtension('md')).toBe(false);
		expect(view.canAcceptExtension('txt')).toBe(false);
	});

	it('onClose() unmounts the Vue app and clears references', async () => {
		const view = new FileDetailView({} as never, {} as never);
		const unmount = vi.fn();
		(view as unknown as { mounted: { unmount: () => void } | null }).mounted = { unmount };
		(view as unknown as { store: unknown }).store = {};
		(view as unknown as { mountPromise: unknown }).mountPromise = Promise.resolve();
		await (view as unknown as { onClose: () => Promise<void> }).onClose();
		expect(unmount).toHaveBeenCalledTimes(1);
		expect((view as unknown as { mounted: unknown }).mounted).toBeNull();
		expect((view as unknown as { store: unknown }).store).toBeNull();
		expect((view as unknown as { mountPromise: unknown }).mountPromise).toBeNull();
	});

	it('onUnloadFile() clears the store when one is mounted', async () => {
		const view = new FileDetailView({} as never, {} as never);
		const clear = vi.fn();
		(view as unknown as { store: { clear: () => void } }).store = { clear };
		await view.onUnloadFile(new TFile('notes/plan.json'));
		expect(clear).toHaveBeenCalledTimes(1);
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
		await expect((view as unknown as { onOpen: () => Promise<void> }).onOpen()).rejects.toThrow('Vue boom');
		const el = (view as unknown as { contentEl: HTMLElement }).contentEl;
		expect(el.textContent).toContain('File detail failed to load');
		expect(el.textContent).toContain('Vue boom');
	});

	it('onLoadFile swallows a failed mount and returns without touching the store', async () => {
		const { FileDetailView: FV } = await import(
			'../../../../src/infrastructure/obsidian/views/file-detail-view.js'
		);
		const view = new FV({} as never, {} as unknown as PluginContext);
		void (view as unknown as { onOpen: () => Promise<void> }).onOpen().catch(() => {});
		await expect(view.onLoadFile(new TFile('notes/plan.json'))).resolves.toBeUndefined();
	});
});

describe('FileDetailView setState — delegates to TabPolicy', () => {
	type NewLeaf = { openFile: ReturnType<typeof vi.fn> };
	function makeView(opts: {
		currentFile?: TFile | null;
		siblingLeaves?: readonly unknown[];
	} = {}): {
		view: FileDetailView;
		newLeaf: NewLeaf;
		getLeaf: ReturnType<typeof vi.fn>;
		setActiveLeaf: ReturnType<typeof vi.fn>;
	} {
		const view = new FileDetailView({} as never, {} as never);
		view.file = opts.currentFile ?? null;
		const newLeaf: NewLeaf = { openFile: vi.fn().mockResolvedValue(undefined) };
		const getLeaf = vi.fn().mockReturnValue(newLeaf);
		const setActiveLeaf = vi.fn();
		const ownLeaf = {};
		(view as unknown as { leaf: unknown }).leaf = ownLeaf;
		const leavesOfType = [ownLeaf, ...(opts.siblingLeaves ?? [])];
		(view as unknown as { app: unknown }).app = {
			vault: { getFileByPath: (p: string) => new TFile(p) },
			workspace: {
				getLeaf,
				setActiveLeaf,
				getLeavesOfType: vi.fn().mockReturnValue(leavesOfType),
			},
		};
		return { view, newLeaf, getLeaf, setActiveLeaf };
	}

	it('opens a new tab when the requested file differs from the current one and no sibling has it', async () => {
		const { view, newLeaf, getLeaf } = makeView({ currentFile: new TFile('data/first.json') });
		await view.setState({ file: 'data/other.csv' }, {} as never);
		expect(getLeaf).toHaveBeenCalledWith('tab');
		expect(newLeaf.openFile).toHaveBeenCalledWith(expect.anything(), { active: true });
	});

	it('activates the existing sibling leaf when one already shows the requested file', async () => {
		const sibling = { view: { file: new TFile('data/other.csv') } };
		const { view, setActiveLeaf, newLeaf } = makeView({
			currentFile: new TFile('data/first.json'),
			siblingLeaves: [sibling],
		});
		await view.setState({ file: 'data/other.csv' }, {} as never);
		expect(setActiveLeaf).toHaveBeenCalledWith(sibling, { focus: true });
		expect(newLeaf.openFile).not.toHaveBeenCalled();
	});

	it('re-asserts focus on a macrotask after opening a new tab', async () => {
		const { view, newLeaf, setActiveLeaf } = makeView({ currentFile: new TFile('data/first.json') });
		await view.setState({ file: 'data/other.csv' }, {} as never);
		await new Promise<void>((r) => setTimeout(r, 0));
		expect(setActiveLeaf).toHaveBeenCalledWith(newLeaf, { focus: true });
	});

	it('accepts (lets super.setState run) when no file is loaded yet', async () => {
		const { view, newLeaf, setActiveLeaf } = makeView({ currentFile: null });
		await view.setState({ file: 'data/first.json' }, {} as never);
		expect(newLeaf.openFile).not.toHaveBeenCalled();
		expect(setActiveLeaf).not.toHaveBeenCalled();
	});

	it('accepts when the requested path matches the currently loaded file', async () => {
		const { view, newLeaf, setActiveLeaf } = makeView({ currentFile: new TFile('data/first.json') });
		await view.setState({ file: 'data/first.json' }, {} as never);
		expect(newLeaf.openFile).not.toHaveBeenCalled();
		expect(setActiveLeaf).not.toHaveBeenCalled();
	});

	it('accepts when state carries no file key', async () => {
		const { view, newLeaf, setActiveLeaf } = makeView({ currentFile: new TFile('data/first.json') });
		await view.setState({}, {} as never);
		expect(newLeaf.openFile).not.toHaveBeenCalled();
		expect(setActiveLeaf).not.toHaveBeenCalled();
	});
});
