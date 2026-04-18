import { describe, it, expect, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { serializeTypeSchema } from '../../../src/domain/make/type-schema-codec.js';
import { generateBaseYaml } from '../../../src/domain/make/base-file.js';
import type { TypeSchema } from '../../../src/domain/make/type-schema.js';

const BOOK: TypeSchema = {
	id: 'book', name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('makeService — read-only', () => {
	it('listTypes returns empty when folder is empty', async () => {
		const vault = fakeVault();
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		expect(r).toEqual({ kind: 'ok', value: [] });
	});
	it('listTypes returns schemas from the types folder', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') expect(r.value).toHaveLength(1);
	});
	it('listTypes ignores non-json files', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		await vault.create('Make/Types/readme.md', 'hi');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		if (r.kind === 'ok') expect(r.value).toHaveLength(1);
	});
	it('loadType returns type-not-found for missing id', async () => {
		const vault = fakeVault();
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.loadType('book');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'type-not-found', typeId: 'book' } });
	});
	it('loadType returns the parsed schema', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.loadType('book');
		expect(r).toEqual({ kind: 'ok', value: BOOK });
	});
	it('deleteInstance returns not-implemented', async () => {
		const svc = createMakeService(fakeModulePorts(), () => MAKE_DEFAULTS);
		const r = await svc.deleteInstance('some/path.md');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'not-implemented' } });
	});
});

describe('makeService.listInstances', () => {
	async function setupWithBook(vault = fakeVault()) {
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		return { vault, svc };
	}

	it('returns ok([]) when the instances folder does not exist', async () => {
		const { svc } = await setupWithBook();
		const r = await svc.listInstances('book');
		expect(r).toEqual({ kind: 'ok', value: [] });
	});

	it('returns InstanceRefs for each .md file in the instances folder', async () => {
		const { vault, svc } = await setupWithBook();
		await vault.create('Books/Dune.md', '# Dune');
		await vault.create('Books/Neuromancer.md', '# Neuromancer');
		const r = await svc.listInstances('book');
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') {
			const titles = r.value.map((x) => x.title).sort();
			expect(titles).toEqual(['Dune', 'Neuromancer']);
			expect(r.value[0]?.typeId).toBe('book');
			expect(r.value[0]?.path).toMatch(/^Books\//);
			expect(typeof r.value[0]?.createdAt).toBe('string');
			expect(r.value[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		}
	});

	it('ignores non-.md files and subfolder descendants', async () => {
		const { vault, svc } = await setupWithBook();
		await vault.create('Books/Dune.md', '# Dune');
		await vault.create('Books/cover.png', '');
		await vault.create('Books/nested/Skipped.md', '# nested');
		const r = await svc.listInstances('book');
		if (r.kind === 'ok') {
			const titles = r.value.map((x) => x.title);
			expect(titles).toEqual(['Dune']);
		}
	});

	it('returns type-not-found when the typeId has no schema file', async () => {
		const svc = createMakeService(fakeModulePorts({ vault: fakeVault() }), () => MAKE_DEFAULTS);
		const r = await svc.listInstances('missing');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'type-not-found', typeId: 'missing' } });
	});

	it('skips unreadable instance files rather than failing the whole list', async () => {
		const { vault, svc } = await setupWithBook();
		await vault.create('Books/Good.md', '# Good');
		const realRead = vault.read;
		vault.read = vi.fn(async (path: string) => {
			if (path === 'Books/Bad.md') return { kind: 'err' as const, error: 'EIO' };
			return realRead(path);
		});
		await vault.create('Books/Bad.md', '');
		const r = await svc.listInstances('book');
		if (r.kind === 'ok') {
			expect(r.value.map((x) => x.title)).toEqual(['Good']);
		}
	});
});

describe('makeService.createType', () => {
	async function fresh() {
		const vault = fakeVault();
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		return { vault, svc };
	}

	it('writes JSON + base file and returns ok with stamped baseFile', async () => {
		const { vault, svc } = await fresh();
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.value.id).toBe('book');
		expect(r.value.baseFile).toBeDefined();
		expect(r.value.baseFile?.path).toBe('Make/Bases/book.base');
		// Both files written to vault.
		expect(await vault.exists('Make/Types/book.json')).toBe(true);
		expect(await vault.exists('Make/Bases/book.base')).toBe(true);
	});

	it('emits make:type-created with the stamped schema', async () => {
		const { vault } = await fresh();
		const received: TypeSchema[] = [];
		// Retrieve the bus from the fake ports factory — reuse the pattern by passing through:
		const eventBus = { emit: vi.fn(), on: vi.fn(), emitAsync: vi.fn(), onAny: vi.fn(), listenerCount: vi.fn() } as never;
		const ports = fakeModulePorts({ vault, eventBus });
		const svc2 = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc2.createType({ name: 'Book', instancesFolder: 'Books', titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }] });
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-created', expect.objectContaining({
			schema: expect.objectContaining({ id: 'book', baseFile: expect.objectContaining({ path: 'Make/Bases/book.base' }) }),
		}));
		void received;
	});

	it('returns invalid-schema when fields fail validation', async () => {
		const { svc } = await fresh();
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: null,
			fields: [{ kind: 'text', name: '', required: true }], // empty name fails
		});
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'invalid-schema' } });
	});

	it('returns invalid-schema for empty type name', async () => {
		const { svc } = await fresh();
		const r = await svc.createType({
			name: '',
			instancesFolder: 'Books',
			titleFieldName: null,
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'invalid-schema' } });
	});

	it('returns duplicate-name on case-insensitive collision', async () => {
		const { vault, svc } = await fresh();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const r = await svc.createType({
			name: 'BOOK',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'duplicate-name', name: 'BOOK' } });
	});

	it('suffixes the slug when id collides on disk (-2, -3…)', async () => {
		const { vault, svc } = await fresh();
		// Pre-seed an orphan type JSON that listTypes won't see (parseable but different name).
		// The name uniqueness check passes; the slug uniqueness check fails on disk.
		await vault.create('Make/Types/book.json', serializeTypeSchema({ ...BOOK, id: 'book', name: 'LegacyBook' }));
		const r = await svc.createType({
			name: 'Book',   // slugifies to 'book' — collides with pre-seeded file
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') {
			expect(r.value.id).toMatch(/^book-\d+$/);
		}
	});

	it('also checks .base file existence in slug collision', async () => {
		const { vault, svc } = await fresh();
		// No type JSON, but a stray .base file matches the default slug.
		await vault.create('Make/Bases/book.base', 'orphan');
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') {
			expect(r.value.id).toMatch(/^book-\d+$/); // -2 because book.base existed
			expect(r.value.baseFile?.path).toBe(`Make/Bases/${r.value.id}.base`);
		}
	});

	it('returns ok with undefined baseFile when base write fails (partial success)', async () => {
		const { vault, svc } = await fresh();
		// Force the base-file write to fail by stubbing vault.create for .base paths.
		const realCreate = vault.create;
		vault.create = vi.fn(async (path: string, content: string) => {
			if (path.endsWith('.base')) return { kind: 'err' as const, error: 'EIO' };
			return realCreate(path, content);
		}) as typeof vault.create;
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') {
			expect(r.value.baseFile).toBeUndefined();
		}
		// Type JSON still exists; .base does not.
		expect(await vault.exists('Make/Types/book.json')).toBe(true);
		expect(await vault.exists('Make/Bases/book.base')).toBe(false);
	});

	it('returns vault-error when type JSON write fails', async () => {
		const { vault, svc } = await fresh();
		const realCreate = vault.create;
		vault.create = vi.fn(async (path: string, content: string) => {
			if (path.endsWith('.json')) return { kind: 'err' as const, error: 'disk full' };
			return realCreate(path, content);
		}) as typeof vault.create;
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'vault-error' } });
	});
});

describe('makeService.updateType', () => {
	async function withBook() {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		return { vault, svc };
	}

	it('merges patch and writes updated schema with new updatedAt', async () => {
		const { vault, svc } = await withBook();
		const r = await svc.updateType('book', { description: 'Reading log' });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.value.description).toBe('Reading log');
		expect(r.value.updatedAt).not.toBe(BOOK.updatedAt);
		// Disk reflects it.
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { description: string };
			expect(parsed.description).toBe('Reading log');
		}
	});

	it('emits make:type-updated with the new schema', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc.updateType('book', { description: 'Reading log' });
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-updated', expect.objectContaining({
			schema: expect.objectContaining({ description: 'Reading log' }),
		}));
	});

	it('returns type-not-found when loadType fails', async () => {
		const vault = fakeVault();
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.updateType('missing', { description: 'x' });
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'type-not-found' } });
	});

	it('returns invalid-schema with field-rename-warning when a field name changes and acknowledgeRenames is not set', async () => {
		const { svc } = await withBook();
		const r = await svc.updateType('book', {
			fields: [{ kind: 'text', name: 'full-title', required: true }], // renamed from 'title'
		});
		expect(r).toMatchObject({
			kind: 'err',
			error: { kind: 'invalid-schema', issues: expect.arrayContaining([
				expect.objectContaining({ kind: 'field-rename-warning', renames: expect.any(Array), affectedCount: 0 }),
			]) },
		});
	});

	it('commits the rename when acknowledgeRenames: true', async () => {
		const { svc } = await withBook();
		const r = await svc.updateType('book', {
			fields: [{ kind: 'text', name: 'full-title', required: true }],
		}, { acknowledgeRenames: true });
		expect(r.kind).toBe('ok');
	});

	it('reports affectedCount > 0 when instances exist', async () => {
		const { vault, svc } = await withBook();
		await vault.create('Books/Dune.md', '# Dune');
		await vault.create('Books/Neuromancer.md', '# Neuromancer');
		const r = await svc.updateType('book', {
			fields: [{ kind: 'text', name: 'full-title', required: true }],
		});
		if (r.kind === 'err' && r.error.kind === 'invalid-schema') {
			const issue = r.error.issues.find((i) => i.kind === 'field-rename-warning');
			expect(issue).toBeDefined();
			if (issue?.kind === 'field-rename-warning') {
				expect(issue.affectedCount).toBe(2);
			}
		}
	});

	it('returns duplicate-name when new name collides with another type', async () => {
		const { vault, svc } = await withBook();
		const RECIPE: TypeSchema = { ...BOOK, id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes' };
		await vault.create('Make/Types/recipe.json', serializeTypeSchema(RECIPE));
		const r = await svc.updateType('book', { name: 'Recipe' });
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'duplicate-name' } });
	});

	it('does NOT regenerate the base file on update', async () => {
		const { vault, svc } = await withBook();
		// Write a known base-file content first.
		await vault.create('Make/Bases/book.base', 'sentinel-content');
		await svc.updateType('book', { description: 'x' });
		const read = await vault.read('Make/Bases/book.base');
		if (read.kind === 'ok') expect(read.value.content).toBe('sentinel-content');
	});
});

describe('makeService.deleteType', () => {
	async function withBook() {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Make/Bases/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		await vault.create('Make/Bases/book.base', 'yaml');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		return { vault, svc, stamped };
	}

	it('deletes the type JSON and returns ok with report (base not deleted)', async () => {
		const { vault, svc } = await withBook();
		const r = await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: false });
		expect(r).toMatchObject({ kind: 'ok', value: { instancesDeleted: 0, baseFileDeleted: false } });
		expect(await vault.exists('Make/Types/book.json')).toBe(false);
		expect(await vault.exists('Make/Bases/book.base')).toBe(true);
	});

	it('deletes the base file when alsoDeleteBaseFile is true', async () => {
		const { vault, svc } = await withBook();
		const r = await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
		expect(r).toMatchObject({ kind: 'ok', value: { baseFileDeleted: true } });
		expect(await vault.exists('Make/Bases/book.base')).toBe(false);
	});

	it('returns not-implemented with feature when alsoDeleteInstances is true', async () => {
		const { svc } = await withBook();
		const r = await svc.deleteType('book', { alsoDeleteInstances: true, alsoDeleteBaseFile: false });
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'not-implemented', feature: 'instance-cascade' } });
	});

	it('emits make:type-deleted', async () => {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Make/Bases/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: false });
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-deleted', { typeId: 'book', name: 'Book' });
	});

	it('returns type-not-found when typeId has no schema file', async () => {
		const svc = createMakeService(fakeModulePorts({ vault: fakeVault() }), () => MAKE_DEFAULTS);
		const r = await svc.deleteType('missing', { alsoDeleteInstances: false, alsoDeleteBaseFile: false });
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'type-not-found' } });
	});

	it('skips base delete if schema.baseFile.path is outside current basesFolder', async () => {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Custom/Elsewhere/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		await vault.create('Custom/Elsewhere/book.base', 'orphan');
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const r = await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: true });
		expect(r).toMatchObject({ kind: 'ok', value: { baseFileDeleted: false } });
		expect(await vault.exists('Custom/Elsewhere/book.base')).toBe(true);
		expect(ports.notifications.info).toHaveBeenCalled();
	});
});

describe('makeService.regenerateBaseFile', () => {
	async function withBook(baseContent: string | null = null) {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Make/Bases/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		if (baseContent !== null) await vault.create('Make/Bases/book.base', baseContent);
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		return { vault, svc };
	}

	it('regenerates when no base file exists', async () => {
		const { vault, svc } = await withBook(null);
		const r = await svc.regenerateBaseFile('book');
		expect(r.kind).toBe('ok');
		expect(await vault.exists('Make/Bases/book.base')).toBe(true);
	});

	it('overwrites when existing base file matches generated content (no divergence)', async () => {
		const { svc } = await withBook();
		const yaml = generateBaseYaml(BOOK); // import generateBaseYaml at top of test file
		await svc.regenerateBaseFile('book'); // first call creates it
		void yaml;
		const r = await svc.regenerateBaseFile('book');
		expect(r.kind).toBe('ok');
	});

	it('returns base-generation-failed user-edited when content diverges from canonical', async () => {
		const { svc } = await withBook('# user-edited content');
		const r = await svc.regenerateBaseFile('book');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'base-generation-failed', cause: 'user-edited' } });
	});

	it('overwrites with force: true even when content diverges', async () => {
		const { vault, svc } = await withBook('# user-edited');
		const r = await svc.regenerateBaseFile('book', { force: true });
		expect(r.kind).toBe('ok');
		const read = await vault.read('Make/Bases/book.base');
		if (read.kind === 'ok') expect(read.value.content).not.toBe('# user-edited');
	});

	it('updates schema.baseFile.generatedAt on success', async () => {
		const { vault, svc } = await withBook();
		await svc.regenerateBaseFile('book', { force: true });
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { baseFile: { generatedAt: string } };
			expect(parsed.baseFile.generatedAt).not.toBe(BOOK.createdAt);
		}
	});
});

describe('makeService.toggleFavorite', () => {
	it('adds typeId to favorites + emits event on first click', async () => {
		const ports = fakeModulePorts();
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const r = await svc.toggleFavorite('book');
		expect(r).toMatchObject({ kind: 'ok', value: true });
		expect(ports.settings.saveSection).toHaveBeenCalledWith('make', expect.objectContaining({ favorites: ['book'] }));
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:favorite-toggled', { typeId: 'book', favorited: true });
	});

	it('removes typeId from favorites on second click', async () => {
		const ports = fakeModulePorts();
		const svc = createMakeService(ports, () => ({ ...MAKE_DEFAULTS, favorites: ['book'] }));
		const r = await svc.toggleFavorite('book');
		expect(r).toMatchObject({ kind: 'ok', value: false });
		expect(ports.settings.saveSection).toHaveBeenCalledWith('make', expect.objectContaining({ favorites: [] }));
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:favorite-toggled', { typeId: 'book', favorited: false });
	});

	it('returns vault-error when saveSection fails', async () => {
		const ports = fakeModulePorts();
		ports.settings.saveSection = vi.fn(async () => ({ kind: 'err' as const, error: 'quota exceeded' }));
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const r = await svc.toggleFavorite('book');
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'vault-error' } });
		expect(ports.notifications.warn).toHaveBeenCalled();
	});
});

describe('makeService.loadType — orphan-base reconciliation', () => {
	it('stamps baseFile from disk when JSON has no baseFile but .base exists', async () => {
		const vault = fakeVault();
		const unstamped: TypeSchema = { ...BOOK }; // no baseFile field
		await vault.create('Make/Types/book.json', serializeTypeSchema(unstamped));
		await vault.create('Make/Bases/book.base', 'yaml');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.loadType('book');
		if (r.kind === 'ok') {
			expect(r.value.baseFile).toBeDefined();
			expect(r.value.baseFile?.path).toBe('Make/Bases/book.base');
		}
	});

	it('leaves baseFile undefined when no .base exists', async () => {
		const vault = fakeVault();
		const unstamped: TypeSchema = { ...BOOK };
		await vault.create('Make/Types/book.json', serializeTypeSchema(unstamped));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.loadType('book');
		if (r.kind === 'ok') expect(r.value.baseFile).toBeUndefined();
	});
});
