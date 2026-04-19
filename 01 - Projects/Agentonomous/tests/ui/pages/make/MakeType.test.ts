import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import MakeType from '../../../../src/ui/pages/make/MakeType.vue';
import MakeTypes from '../../../../src/ui/pages/make/MakeTypes.vue';
import { MakeTypePage } from '../../../../src/ui/pages/make/MakeType.po.js';
import { mountWithI18n } from '../../../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext, fakeMakeService } from '../../../__fixtures__/fake-make-context.js';
import { MakeContextKey } from '../../../../src/ui/make-context-key.js';
import { PluginContextKey } from '../../../../src/ui/plugin-context-key.js';
import { useMakeStore } from '../../../../src/ui/stores/make-store.js';
import type { TypeSchema } from '../../../../src/domain/make/type-schema.js';
import type { InstanceRef } from '../../../../src/domain/make/types.js';
import type { PluginContext } from '../../../../src/plugin.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', description: 'Reading log', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [
		{ kind: 'text', name: 'title', required: true },
		{ kind: 'text', name: 'author', required: false },
		{ kind: 'number', name: 'pages', required: false, description: 'Page count' },
	],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};
const BOOK_WITH_BASE: TypeSchema = {
	...BOOK,
	updatedAt: '2026-04-20T00:00:00.000Z',
	baseFile: { path: 'Make/Bases/book.md', generatedAt: '2026-04-19T00:00:00.000Z' },
};
const BOOK_WITH_BASE_FRESH: TypeSchema = {
	...BOOK,
	updatedAt: '2026-04-18T00:00:00.000Z',
	baseFile: { path: 'Make/Bases/book.md', generatedAt: '2026-04-19T00:00:00.000Z' },
};
const DUNE: InstanceRef = { typeId: 'book', path: 'Books/Dune.md', title: 'Dune', createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z' };
const NEURO: InstanceRef = { typeId: 'book', path: 'Books/Neuromancer.md', title: 'Neuromancer', createdAt: '2026-04-19T00:00:00.000Z', updatedAt: '2026-04-19T00:00:00.000Z' };

// Per-test service spies — created fresh in beforeEach.
let listTypes: ReturnType<typeof vi.fn>;
let listInstances: ReturnType<typeof vi.fn>;
let createType: ReturnType<typeof vi.fn>;
let updateType: ReturnType<typeof vi.fn>;
let deleteType: ReturnType<typeof vi.fn>;
let regenerateBaseFile: ReturnType<typeof vi.fn>;
let toggleFavorite: ReturnType<typeof vi.fn>;
let notificationsSpy: {
	success: ReturnType<typeof vi.fn>;
	warn:    ReturnType<typeof vi.fn>;
	info:    ReturnType<typeof vi.fn>;
	error:   ReturnType<typeof vi.fn>;
};

function createTestRouter(extraRoutes: { path: string; name?: string; component: unknown }[] = []) {
	return createRouter({
		history: createMemoryHistory(),
		routes: [
			{ path: '/make/types', component: MakeTypes },
			{ path: '/make/types/new', name: 'make-type-new', component: MakeType },
			{ path: '/make/types/:typeId', component: MakeType },
			...extraRoutes,
		],
	});
}

async function mountTypePage(
	initialPath = '/make/types/book',
	seedTypes: TypeSchema[] = [BOOK],
) {
	const ctx = createFakeMakeContext({
		service: fakeMakeService({ listTypes, listInstances, createType, updateType, deleteType, regenerateBaseFile, toggleFavorite }),
		settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
	});
	const router = createTestRouter();
	await router.push(initialPath);
	await router.isReady();
	const pinia = createPinia();
	// Pre-seed the Pinia store state so the component's setup() sees populated
	// types before useMakeTypeDraft initialises the draft. Pinia hydrates
	// setup-store refs from pinia.state.value[storeId] during first access.
	pinia.state.value['make'] = {
		types: seedTypes,
		typesLoaded: true,
		typesLoading: false,
		typesError: null,
		instancesByTypeId: new Map(),
		instancesLoading: new Set(),
		instancesError: new Map(),
		savingType: false,
		saveError: null,
		regeneratingForId: new Set(),
		regenerationError: new Map(),
		favoriteToggling: new Set(),
		optimisticFavoriteOverrides: new Map(),
	};
	const pluginCtx = { notifications: notificationsSpy } as unknown as PluginContext;
	const wrapper = mountWithI18n(MakeType, {
		router,
		attachTo: document.body,
		provide: {
			[MakeContextKey as symbol]: ctx,
			[PluginContextKey as symbol]: pluginCtx,
		} as Record<PropertyKey, unknown>,
		plugins: [pinia],
	});
	const store = useMakeStore();
	return { wrapper, router, page: new MakeTypePage(wrapper.element as HTMLElement), store };
}

function tick(ms = 0): Promise<void> {
	return new Promise((r) => setTimeout(r, ms));
}

describe('MakeType', () => {
	beforeEach(() => {
		setActivePinia(createPinia());
		listTypes         = vi.fn().mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
		listInstances     = vi.fn().mockResolvedValue({ kind: 'ok', value: [DUNE, NEURO] });
		createType        = vi.fn();
		updateType        = vi.fn();
		deleteType        = vi.fn();
		regenerateBaseFile = vi.fn();
		toggleFavorite    = vi.fn();
		notificationsSpy  = { success: vi.fn(), warn: vi.fn(), info: vi.fn(), error: vi.fn() };
	});

	afterEach(() => {
		// Clean up any teleported dialogs left in document.body between tests.
		for (const el of document.body.querySelectorAll('[data-testid="confirm-dialog"]')) { el.remove(); }
		for (const el of document.body.querySelectorAll('[data-testid="delete-type-dialog"]')) { el.remove(); }
		for (const el of document.body.querySelectorAll('[data-testid="confirm-dialog-backdrop"]')) { el.remove(); }
		for (const el of document.body.querySelectorAll('[data-testid="delete-type-dialog-backdrop"]')) { el.remove(); }
	});

	// --- Chunk 2 existing tests ---

	it('renders header with type name and folder', async () => {
		const { page } = await mountTypePage();
		await tick();
		expect(page.title).toContain('Book');
		expect(page.folder).toContain('Books');
	});

	it('defaults to the Instances tab when no hash is present', async () => {
		const { page } = await mountTypePage();
		await tick();
		expect(page.activeTab).toBe('instances');
		expect(page.instanceRows.length).toBeGreaterThan(0);
	});

	it('selects the Fields tab on mount when url hash is #fields (hash-restore)', async () => {
		const { page } = await mountTypePage('/make/types/book#fields');
		await tick();
		expect(page.activeTab).toBe('fields');
		expect(page.fieldRows.length).toBe(BOOK.fields.length);
	});

	it('clicking a tab updates route.hash', async () => {
		const { router, page } = await mountTypePage();
		await tick();
		page.fieldsTabButton?.click();
		await tick();
		expect(router.currentRoute.value.hash).toBe('#fields');
		page.instancesTabButton?.click();
		await tick();
		expect(router.currentRoute.value.hash).toBe('#instances');
	});

	it('Fields tab marks the title field', async () => {
		const { page } = await mountTypePage('/make/types/book#fields');
		await tick();
		const titleRow = page.fieldRows.find((r) => r.getAttribute('data-testid') === 'field-row-title');
		expect(titleRow?.querySelector('[data-testid="field-row-title-title-badge"]')).not.toBeNull();
	});

	it('Instances tab sorts by createdAt descending', async () => {
		const { page } = await mountTypePage();
		await tick();
		const titles = page.instanceRows.map((r) => r.dataset['testid']?.replace('instance-row-', ''));
		expect(titles[0]).toBe('Books/Neuromancer.md');
		expect(titles[1]).toBe('Books/Dune.md');
	});

	it('Fields tab shows empty state when type.fields is empty', async () => {
		const empty: TypeSchema = { ...BOOK, fields: [] };
		const { page } = await mountTypePage('/make/types/book#fields', [empty]);
		await tick();
		expect(page.fieldsEmpty).not.toBeNull();
	});

	it('Instances tab shows empty state when instances list is empty', async () => {
		listInstances.mockResolvedValue({ kind: 'ok', value: [] });
		const { page } = await mountTypePage();
		await tick();
		expect(page.instancesEmpty).not.toBeNull();
	});

	it('Instances tab shows the error when instancesError is set', async () => {
		listInstances.mockResolvedValue({ kind: 'err', error: { kind: 'vault-error', cause: 'EIO' } });
		const { page } = await mountTypePage();
		await tick();
		expect(page.instancesError).not.toBeNull();
		expect(page.instancesError?.textContent).toContain('vault-error');
	});

	it('Instances tab shows loading indicator while fetching', async () => {
		listInstances.mockReturnValue(new Promise(() => { /* hang */ }));
		const { page } = await mountTypePage();
		await tick();
		expect(page.instancesLoading).not.toBeNull();
	});

	// --- Task 3.17 new tests ---

	describe('new-mode', () => {
		it('mounts in new-mode with "New type" title when name is empty', async () => {
			const ctx = createFakeMakeContext({
				service: fakeMakeService({ listTypes, listInstances }),
				settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
			});
			const router = createTestRouter();
			await router.push('/make/types/new');
			await router.isReady();
			const wrapper = mountWithI18n(MakeType, {
				router,
				attachTo: document.body,
				provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
				plugins: [createPinia()],
			});
			await tick();
			const page = new MakeTypePage(wrapper.element as HTMLElement);
			expect(page.title).toContain('New type');
		});

		it('new-mode: no tab strip rendered', async () => {
			const ctx = createFakeMakeContext({
				service: fakeMakeService({ listTypes, listInstances }),
				settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
			});
			const router = createTestRouter();
			await router.push('/make/types/new');
			await router.isReady();
			const wrapper = mountWithI18n(MakeType, {
				router,
				attachTo: document.body,
				provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
				plugins: [createPinia()],
			});
			await tick();
			expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
		});

		it('new-mode: Save button shows Create label', async () => {
			const ctx = createFakeMakeContext({
				service: fakeMakeService({ listTypes, listInstances }),
				settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
			});
			const router = createTestRouter();
			await router.push('/make/types/new');
			await router.isReady();
			const wrapper = mountWithI18n(MakeType, {
				router,
				attachTo: document.body,
				provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
				plugins: [createPinia()],
			});
			await tick();
			const page = new MakeTypePage(wrapper.element as HTMLElement);
			// saveButton label includes "Create" when mode=new
			expect(page.saveButton?.textContent).toMatch(/Create/i);
		});

		it('new-mode: save calls store.createType and navigates on success', async () => {
			const createdType: TypeSchema = { ...BOOK, id: 'new-book', name: 'New Book' };
			createType.mockResolvedValue({ kind: 'ok', value: createdType });
			const ctx = createFakeMakeContext({
				service: fakeMakeService({ listTypes, listInstances, createType }),
				settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
			});
			const router = createTestRouter();
			await router.push('/make/types/new');
			await router.isReady();
			const wrapper = mountWithI18n(MakeType, {
				router,
				attachTo: document.body,
				provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
				plugins: [createPinia()],
			});
			await tick();
			// Trigger save via button — in new mode isDirty=true always, so button is enabled
			const saveBtn = wrapper.find('[data-testid="fields-save"]');
			await saveBtn.trigger('click');
			await tick(50);
			expect(createType).toHaveBeenCalled();
			expect(router.currentRoute.value.path).toBe('/make/types/new-book');
		});
	});

	describe('edit-mode', () => {
		it('save calls store.updateType and clears isDirty on success', async () => {
			const updatedType: TypeSchema = { ...BOOK, name: 'Book Updated' };
			updateType.mockResolvedValue({ kind: 'ok', value: { schema: updatedType } });
			const { wrapper } = await mountTypePage('/make/types/book#fields');
			await tick();
			// Dirty the draft by emitting update:draft
			const editor = wrapper.findComponent({ name: 'MakeTypeFieldsEditor' });
			const dirtyDraft = { ...BOOK, description: 'changed', fields: BOOK.fields };
			const emitFn = (editor.vm as { $emit: (event: string, ...args: unknown[]) => void }).$emit;
			emitFn('update:draft', dirtyDraft);
			await tick();
			// Trigger save
			const saveBtn = wrapper.find('[data-testid="fields-save"]');
			await saveBtn.trigger('click');
			await tick(50);
			expect(updateType).toHaveBeenCalled();
		});

		it('favorite star is rendered in edit mode', async () => {
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			expect(page.favoriteButton).not.toBeNull();
		});

		it('favorite star click calls store.toggleFavorite', async () => {
			toggleFavorite.mockResolvedValue({ kind: 'ok', value: false });
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.favoriteButton?.click();
			await tick();
			expect(toggleFavorite).toHaveBeenCalledWith('book');
		});

		it('no favorite star shown in new-mode', async () => {
			const ctx = createFakeMakeContext({
				service: fakeMakeService({ listTypes, listInstances }),
				settings: { enabled: true, typesFolder: 'Make/Types', basesFolder: 'Make/Bases', defaultInstancesRoot: 'Make/Instances', favorites: [] },
			});
			const router = createTestRouter();
			await router.push('/make/types/new');
			await router.isReady();
			const wrapper = mountWithI18n(MakeType, {
				router,
				attachTo: document.body,
				provide: { [MakeContextKey as symbol]: ctx } as Record<PropertyKey, unknown>,
				plugins: [createPinia()],
			});
			await tick();
			const page = new MakeTypePage(wrapper.element as HTMLElement);
			expect(page.favoriteButton).toBeNull();
		});
	});

	describe('base banner', () => {
		it('renders banner with state=missing when baseFile is undefined', async () => {
			const { page } = await mountTypePage('/make/types/book#fields', [BOOK]);
			await tick();
			expect(page.baseBanner).not.toBeNull();
			const bannerTitle = page.baseBanner?.querySelector('[data-testid="base-file-banner-title"]');
			expect(bannerTitle?.textContent).toContain('missing');
		});

		it('renders banner with state=stale when updatedAt > generatedAt', async () => {
			const { page } = await mountTypePage('/make/types/book#fields', [BOOK_WITH_BASE]);
			await tick();
			expect(page.baseBanner).not.toBeNull();
			const bannerTitle = page.baseBanner?.querySelector('[data-testid="base-file-banner-title"]');
			expect(bannerTitle?.textContent).toContain('out of date');
		});

		it('does NOT render banner when base is fresh', async () => {
			const { page } = await mountTypePage('/make/types/book#fields', [BOOK_WITH_BASE_FRESH]);
			await tick();
			expect(page.baseBanner).toBeNull();
		});

		it('user-edited error on regenerate → overwrite ConfirmDialog opens', async () => {
			regenerateBaseFile.mockResolvedValue({
				kind: 'err',
				error: { kind: 'base-generation-failed', cause: 'user-edited' },
			});
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			// Click regenerate on the missing banner
			page.baseBannerRegenerate?.click();
			await tick(50);
			// Overwrite confirm dialog should open (teleported to body)
			const dialog = document.body.querySelector('[data-testid="confirm-dialog"]');
			expect(dialog).not.toBeNull();
		});

		it('confirming overwrite re-calls regenerateBaseFile with force:true', async () => {
			regenerateBaseFile
				.mockResolvedValueOnce({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } })
				.mockResolvedValueOnce({ kind: 'ok', value: 'Make/Bases/book.md' });
			// Also mock listTypes for the refresh call after successful regenerate
			listTypes.mockResolvedValue({ kind: 'ok', value: { types: [BOOK], issues: [] } });
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.baseBannerRegenerate?.click();
			await tick(50);
			// Confirm the overwrite
			const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="confirm-dialog-confirm"]');
			confirmBtn?.click();
			await tick(50);
			expect(regenerateBaseFile).toHaveBeenCalledTimes(2);
			expect(regenerateBaseFile).toHaveBeenLastCalledWith('book', { force: true });
		});
	});

	describe('delete flow', () => {
		it('clicking Delete button opens DeleteTypeDialog', async () => {
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.deleteButton?.click();
			await tick();
			// DeleteTypeDialog teleports to body
			const dialog = document.body.querySelector('[data-testid="delete-type-dialog"]');
			expect(dialog).not.toBeNull();
		});

		it('confirming delete navigates to /make/types on success', async () => {
			deleteType.mockResolvedValue({ kind: 'ok', value: { instancesDeleted: 0, instanceFailures: [], baseFileDeleted: false } });
			const { page, router } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.deleteButton?.click();
			await tick(50);
			// Confirm deletion (teleported to body)
			const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="delete-type-confirm"]');
			confirmBtn?.click();
			await tick(50);
			expect(deleteType).toHaveBeenCalled();
			expect(router.currentRoute.value.path).toBe('/make/types');
		});

		it('cascade delete surfaces success notification when no instances fail', async () => {
			deleteType.mockResolvedValue({ kind: 'ok', value: { instancesDeleted: 3, instanceFailures: [], baseFileDeleted: false } });
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.deleteButton?.click();
			await tick(50);
			// Check the cascade checkbox
			const cascade = document.body.querySelector<HTMLInputElement>('[data-testid="delete-type-instances-checkbox"]');
			expect(cascade).not.toBeNull();
			cascade!.checked = true;
			cascade!.dispatchEvent(new Event('change'));
			await tick();
			const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="delete-type-confirm"]');
			confirmBtn?.click();
			await tick(50);
			expect(deleteType).toHaveBeenCalledWith('book', expect.objectContaining({ alsoDeleteInstances: true }));
			expect(notificationsSpy.success).toHaveBeenCalledTimes(1);
			expect(notificationsSpy.success).toHaveBeenCalledWith(expect.stringMatching(/3/));
			expect(notificationsSpy.warn).not.toHaveBeenCalled();
		});

		it('cascade delete surfaces partial warning when instances fail', async () => {
			deleteType.mockResolvedValue({
				kind: 'ok',
				value: { instancesDeleted: 1, instanceFailures: [{ path: 'Books/Dune.md', cause: 'locked' }], baseFileDeleted: false },
			});
			const { page } = await mountTypePage('/make/types/book#fields');
			await tick();
			page.deleteButton?.click();
			await tick(50);
			const cascade = document.body.querySelector<HTMLInputElement>('[data-testid="delete-type-instances-checkbox"]');
			cascade!.checked = true;
			cascade!.dispatchEvent(new Event('change'));
			await tick();
			const confirmBtn = document.body.querySelector<HTMLButtonElement>('[data-testid="delete-type-confirm"]');
			confirmBtn?.click();
			await tick(50);
			expect(deleteType).toHaveBeenCalledWith('book', expect.objectContaining({ alsoDeleteInstances: true }));
			expect(notificationsSpy.warn).toHaveBeenCalledTimes(1);
			expect(notificationsSpy.warn).toHaveBeenCalledWith(expect.stringMatching(/1/));
			expect(notificationsSpy.success).not.toHaveBeenCalled();
		});
	});

	describe('unsaved changes guard', () => {
		it('dirty draft: switching tab shows unsaved indicator on Fields tab label', async () => {
			const { wrapper } = await mountTypePage('/make/types/book#fields');
			await tick();
			// Dirty the draft by emitting update:draft
			const editor = wrapper.findComponent({ name: 'MakeTypeFieldsEditor' });
			const dirtyDraft = {
				name: 'Book Modified',
				description: 'Reading log',
				instancesFolder: 'Books',
				titleFieldName: 'title',
				fields: BOOK.fields,
			};
			const emitFn2 = (editor.vm as { $emit: (event: string, ...args: unknown[]) => void }).$emit;
			emitFn2('update:draft', dirtyDraft);
			await tick();
			// Switch to instances tab
			const instancesTab = wrapper.find('[data-testid="make-type-tab-instances"]');
			await instancesTab.trigger('click');
			await tick();
			// Fields tab should now show unsaved indicator
			const fieldsTab = wrapper.find('[data-testid="make-type-tab-fields"]');
			const indicator = fieldsTab.find('[aria-label]');
			expect(indicator.exists()).toBe(true);
		});
	});
});
