import { vi } from 'vitest';

export type FakeLeaf = {
	view: unknown;
	detach: () => void;
	setViewState: ReturnType<typeof vi.fn>;
};

export type FakeWorkspace = {
	getLeavesOfType: ReturnType<typeof vi.fn>;
	getLeaf: ReturnType<typeof vi.fn>;
	getLeftLeaf: ReturnType<typeof vi.fn>;
	getRightLeaf: ReturnType<typeof vi.fn>;
	revealLeaf: ReturnType<typeof vi.fn>;
	detachLeavesOfType: ReturnType<typeof vi.fn>;
};

export type FakePlugin = {
	data: unknown;
	app: { workspace: FakeWorkspace };
	loadData: ReturnType<typeof vi.fn>;
	saveData: ReturnType<typeof vi.fn>;
	registerView: ReturnType<typeof vi.fn>;
	addRibbonIcon: ReturnType<typeof vi.fn>;
	addCommand: ReturnType<typeof vi.fn>;
	addSettingTab: ReturnType<typeof vi.fn>;
};

export function createFakePlugin(initialData: unknown = null): FakePlugin {
	const state = { data: initialData };
	const makeLeaf = () => ({ setViewState: vi.fn(async () => undefined), detach: vi.fn() });
	const workspace: FakeWorkspace = {
		getLeavesOfType: vi.fn(() => []),
		getLeaf: vi.fn(makeLeaf),
		getLeftLeaf: vi.fn(makeLeaf),
		getRightLeaf: vi.fn(makeLeaf),
		revealLeaf: vi.fn(),
		detachLeavesOfType: vi.fn(),
	};
	return {
		get data() { return state.data; },
		set data(v) { state.data = v; },
		app: { workspace },
		loadData: vi.fn(async () => state.data),
		saveData: vi.fn(async (d: unknown) => { state.data = d; }),
		registerView: vi.fn(),
		addRibbonIcon: vi.fn(() => ({ remove: vi.fn() })),
		addCommand: vi.fn(),
		addSettingTab: vi.fn(),
	};
}
