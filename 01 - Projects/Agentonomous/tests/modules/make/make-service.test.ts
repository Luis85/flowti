import { describe, it, expect, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { serializeTypeSchema } from '../../../src/domain/make/type-schema-codec.js';
import { generateBaseYaml } from '../../../src/domain/make/base-file.js';
import { err } from '../../../src/domain/shared/result.js';
import { createPerTypeQueue } from '../../../src/modules/make/per-type-queue.js';
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
		expect(r).toEqual({ kind: 'ok', value: { types: [], issues: [] } });
	});
	it('listTypes returns schemas from the types folder', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		expect(r.kind).toBe('ok');
		if (r.kind === 'ok') expect(r.value.types).toHaveLength(1);
	});
	it('listTypes ignores non-json files', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		await vault.create('Make/Types/readme.md', 'hi');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		if (r.kind === 'ok') expect(r.value.types).toHaveLength(1);
	});
	it('listTypes returns { types, issues: [] } on happy path (Chunk 4 widened shape)', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.listTypes();
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.types).toHaveLength(1);
		expect(r.value.types[0]?.id).toBe('book');
		expect(r.value.issues).toEqual([]);
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
});

describe('makeService.deleteInstance', () => {
	it('calls vault.delete and emits make:instance-deleted with matched typeId', async () => {
		const vault = fakeVault({
			'Make/Types/book.json': serializeTypeSchema(BOOK), // BOOK has instancesFolder 'Books'
			'Books/Dune.md':        '---\ntype: Book\n---\nx',
		});
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc.listTypes(); // prime any cache that might exist
		const result = await svc.deleteInstance('Books/Dune.md');
		expect(result.kind).toBe('ok');
		expect(vault.delete).toHaveBeenCalledWith('Books/Dune.md');
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instance-deleted', { typeId: 'book', path: 'Books/Dune.md' });
	});

	it('emits make:orphan-deleted (not make:instance-deleted) when no schema matches the parent folder', async () => {
		const vault = fakeVault({ 'Random/Orphan.md': 'x' });
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const result = await svc.deleteInstance('Random/Orphan.md');
		expect(result.kind).toBe('ok');
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:orphan-deleted', { path: 'Random/Orphan.md' });
		expect(ports.eventBus.emit).not.toHaveBeenCalledWith('make:instance-deleted', expect.anything());
	});

	it('uses exact-parent-folder match, not prefix', async () => {
		const CLASSICS: TypeSchema = { ...BOOK, id: 'classics', name: 'Classic', instancesFolder: 'Books/Classics' };
		const vault = fakeVault({
			'Make/Types/book.json':     serializeTypeSchema(BOOK),
			'Make/Types/classics.json': serializeTypeSchema(CLASSICS),
			'Books/Classics/Dune.md':   'x',
		});
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const result = await svc.deleteInstance('Books/Classics/Dune.md');
		expect(result.kind).toBe('ok');
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instance-deleted', { typeId: 'classics', path: 'Books/Classics/Dune.md' });
	});

	it('returns vault-error on vault failure', async () => {
		const vault = fakeVault({}, { deleteError: 'perm denied' });
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.deleteInstance('x.md');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error.kind).toBe('vault-error');
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

	it('ensureFolder is called for typesFolder AND basesFolder before any create (first-type bootstrap)', async () => {
		// Regression: on a fresh vault with no Make/Types or Make/Bases,
		// vault.create('Make/Types/book.json', …) throws ENOENT in Obsidian.
		// The service must call ensureFolder on both folders before writing.
		const { vault, svc } = await fresh();
		await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(vault.ensureFolder).toHaveBeenCalledWith('Make/Types');
		expect(vault.ensureFolder).toHaveBeenCalledWith('Make/Bases');
		// Ensure-calls MUST precede the first create call in invocation order.
		const ensureCalls = (vault.ensureFolder as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder;
		const createCalls = (vault.create as unknown as { mock: { invocationCallOrder: number[] } }).mock.invocationCallOrder;
		expect(Math.min(...ensureCalls)).toBeLessThan(Math.min(...createCalls));
	});

	it('logs vault-error to logger.error when the JSON write fails, so it appears in console', async () => {
		// User-observable outcome: if the type JSON write fails (e.g., ENOENT
		// before ensureFolder is wired, or permissions error), the failure
		// message should land in the Obsidian devtools console via
		// LoggerPort.error — not only in the red UI banner.
		const vault = fakeVault({}, { createError: 'EACCES: permission denied' });
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const r = await svc.createType({
			name: 'Book',
			instancesFolder: 'Books',
			titleFieldName: 'title',
			fields: [{ kind: 'text', name: 'title', required: true }],
		});
		expect(r.kind).toBe('err');
		expect(ports.logger.error).toHaveBeenCalledWith(
			'make-service',
			expect.stringContaining('createType: failed to write'),
			expect.stringContaining('EACCES'),
		);
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
		expect(r.value.schema.description).toBe('Reading log');
		expect(r.value.schema.updatedAt).not.toBe(BOOK.updatedAt);
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

describe('makeService.updateType — folder-move physics (Slice J)', () => {
	async function withBookAndInstances(instanceNames: string[]) {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		for (const name of instanceNames) {
			await vault.create(`Books/${name}.md`, `# ${name}`);
		}
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		return { vault, svc, ports };
	}

	it('folder unchanged: writes JSON, emits make:type-updated, returns ok({schema})', async () => {
		const { vault, svc, ports } = await withBookAndInstances([]);
		const r = await svc.updateType('book', { description: 'Updated log' });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.schema.description).toBe('Updated log');
		expect(r.value.moveReport).toBeUndefined();
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-updated', expect.objectContaining({ schema: expect.any(Object) }));
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') expect(read.value.content).toContain('Updated log');
	});

	it('folder changed, zero instances: writes JSON, no move prompt', async () => {
		const { vault, svc, ports } = await withBookAndInstances([]);
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.schema.instancesFolder).toBe('NewBooks');
		expect(r.value.moveReport).toBeUndefined();
		const emitCalls = (ports.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls;
		const movedCall = emitCalls.find((c) => c[0] === 'make:instances-moved');
		expect(movedCall).toBeUndefined();
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') expect(read.value.content).toContain('NewBooks');
	});

	it('folder changed, N instances, no moveInstances: returns instances-move-required, JSON NOT written', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune', 'Neuromancer']);
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' });
		expect(r).toMatchObject({
			kind: 'err',
			error: { kind: 'instances-move-required', oldFolder: 'Books', newFolder: 'NewBooks', count: 2 },
		});
		// JSON unchanged: original schema still on disk.
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { instancesFolder: string };
			expect(parsed.instancesFolder).toBe('Books');
		}
	});

	it('folder changed, moveInstances: true: renames all, writes JSON, emits move + update events', async () => {
		const { vault, svc, ports } = await withBookAndInstances(['Dune', 'Neuromancer']);
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.schema.instancesFolder).toBe('NewBooks');
		expect(r.value.moveReport).toBeDefined();
		expect(r.value.moveReport?.movedCount).toBe(2);
		expect(r.value.moveReport?.failedMoves).toEqual([]);
		// Files now in new folder.
		expect(await vault.exists('NewBooks/Dune.md')).toBe(true);
		expect(await vault.exists('NewBooks/Neuromancer.md')).toBe(true);
		expect(await vault.exists('Books/Dune.md')).toBe(false);
		// Both events emitted.
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instances-moved', expect.objectContaining({
			typeId: 'book',
			report: expect.objectContaining({ oldFolder: 'Books', newFolder: 'NewBooks', movedCount: 2 }),
		}));
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-updated', expect.objectContaining({ schema: expect.any(Object) }));
	});

	it('folder changed, one rename fails: ok with failedMoves, JSON still written, both events emitted', async () => {
		const { vault, svc, ports } = await withBookAndInstances(['Dune', 'Neuromancer']);
		// Patch rename to fail on exactly one file.
		const originalRename = vault.rename;
		vault.rename = vi.fn(async (oldPath: string, newPath: string) => {
			if (oldPath === 'Books/Dune.md') return { kind: 'err' as const, error: 'locked' };
			return originalRename(oldPath, newPath);
		}) as typeof vault.rename;
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.moveReport?.movedCount).toBe(1);
		expect(r.value.moveReport?.failedMoves).toHaveLength(1);
		expect(r.value.moveReport?.failedMoves[0]?.path).toBe('Books/Dune.md');
		// JSON still reflects the new folder.
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { instancesFolder: string };
			expect(parsed.instancesFolder).toBe('NewBooks');
		}
		// Both events emitted.
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instances-moved', expect.any(Object));
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:type-updated', expect.any(Object));
	});

	it('folder changed, all renames fail: movedCount=0, JSON still written, ok with failedMoves', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune', 'Neuromancer']);
		vault.rename = vi.fn(async () => ({ kind: 'err' as const, error: 'EPERM' })) as typeof vault.rename;
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.moveReport?.movedCount).toBe(0);
		expect(r.value.moveReport?.failedMoves).toHaveLength(2);
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { instancesFolder: string };
			expect(parsed.instancesFolder).toBe('NewBooks');
		}
	});
});

describe('makeService.updateType move preconditions', () => {
	async function withBookAndInstances(instanceNames: string[]) {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		for (const name of instanceNames) {
			await vault.create(`Books/${name}.md`, `# ${name}`);
		}
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		return { vault, svc, ports };
	}

	it('target-exists collision: the colliding file reports as failed, others move, JSON written', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune', 'Neuromancer']);
		// Pre-seed a blocking file at the destination so Dune.md collides on rename.
		await vault.create('NewBooks/Dune.md', '# other');
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.moveReport?.movedCount).toBe(1);
		expect(r.value.moveReport?.failedMoves).toHaveLength(1);
		expect(r.value.moveReport?.failedMoves[0]?.path).toBe('Books/Dune.md');
		expect(r.value.moveReport?.failedMoves[0]?.cause).toContain('target-exists');
		// Dune stays at old path (rename was rejected); Neuromancer moves.
		expect(await vault.exists('Books/Dune.md')).toBe(true);
		expect(await vault.exists('NewBooks/Neuromancer.md')).toBe(true);
		// Pre-existing NewBooks/Dune.md untouched.
		const existing = await vault.read('NewBooks/Dune.md');
		if (existing.kind === 'ok') expect(existing.value.content).toBe('# other');
		// JSON still reflects new folder.
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { instancesFolder: string };
			expect(parsed.instancesFolder).toBe('NewBooks');
		}
	});

	it('TOCTOU: instance removed between listInstancesInFolder and rename is reported as failed, loop continues', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune', 'Neuromancer']);
		// Patch rename: on the FIRST rename attempt, remove the OTHER file from the vault
		// to simulate a concurrent delete while the loop is running.
		const originalRename = vault.rename;
		let firstCall = true;
		vault.rename = vi.fn(async (oldPath: string, newPath: string) => {
			if (firstCall) {
				firstCall = false;
				// Before the first rename happens, remove the second file from under us.
				await vault.delete('Books/Neuromancer.md');
			}
			return originalRename(oldPath, newPath);
		}) as typeof vault.rename;
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.moveReport?.movedCount).toBe(1);
		expect(r.value.moveReport?.failedMoves).toHaveLength(1);
		expect(r.value.moveReport?.failedMoves[0]?.path).toBe('Books/Neuromancer.md');
		expect(r.value.moveReport?.failedMoves[0]?.cause).toContain('not-found');
		// JSON still reflects new folder (write-regardless semantics).
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { instancesFolder: string };
			expect(parsed.instancesFolder).toBe('NewBooks');
		}
	});

	it('partial-move is returned as ok (not err) when any renames fail — regression guard for Polish #2', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune']);
		// Force all renames to fail.
		vault.rename = vi.fn(async () => ({ kind: 'err' as const, error: 'EBUSY' })) as typeof vault.rename;
		const r = await svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.moveReport?.failedMoves).toHaveLength(1);
		// Semantics: no 'err' with kind 'partial-move' on MakeError anymore.
		// The caller must inspect moveReport.failedMoves.length > 0.
	});

	it('concurrent updateType calls serialize per typeId (no stale-write race)', async () => {
		const { vault, svc } = await withBookAndInstances(['Dune']);
		// Gate the first rename on a manually-resolved promise so the folder-move
		// is definitively in-flight when the second updateType call arrives.
		let releaseFirstRename: () => void = () => {};
		const firstRenameWait = new Promise<void>((r) => { releaseFirstRename = r; });
		const originalRename = vault.rename;
		let renameCallCount = 0;
		vault.rename = vi.fn(async (oldPath: string, newPath: string) => {
			renameCallCount += 1;
			if (renameCallCount === 1) await firstRenameWait;
			return originalRename(oldPath, newPath);
		}) as typeof vault.rename;

		// Call 1: folder-move (suspends on firstRenameWait).
		const r1 = svc.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true });
		// Call 2: description change, started while call 1 is mid-rename.
		const r2 = svc.updateType('book', { description: 'Updated via second call' });

		// Release call 1 to complete.
		releaseFirstRename();
		const [res1, res2] = await Promise.all([r1, r2]);
		expect(res1.kind).toBe('ok');
		expect(res2.kind).toBe('ok');

		// With serialization, call 2 loads the post-call-1 schema and preserves the
		// folder move while applying its description. Without it, call 2 would have
		// loaded stale state and clobbered the folder change.
		const read = await vault.read('Make/Types/book.json');
		if (read.kind === 'ok') {
			const parsed = JSON.parse(read.value.content) as { description: string; instancesFolder: string };
			expect(parsed.instancesFolder).toBe('NewBooks');
			expect(parsed.description).toBe('Updated via second call');
		}
	});

	it('shared per-type-queue: an external enqueue on the same typeId FIFO-waits behind in-flight updateType', async () => {
		// Guards the contract that the queue is shared — the upcoming deleteInstances
		// (Chunk 3) will FIFO behind updateType for the same typeId via this queue.
		const queue = createPerTypeQueue();
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		await vault.create('Books/Dune.md', '# Dune');
		// Gate the folder rename so updateType is still in flight when we enqueue the external.
		let releaseRename: () => void = () => {};
		const renameWait = new Promise<void>((r) => { releaseRename = r; });
		const originalRename = vault.rename;
		vault.rename = vi.fn(async (oldPath: string, newPath: string) => {
			await renameWait;
			return originalRename(oldPath, newPath);
		}) as typeof vault.rename;
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS, queue);

		const order: string[] = [];
		const updatePromise = svc
			.updateType('book', { instancesFolder: 'NewBooks' }, { moveInstances: true })
			.then(() => { order.push('updateType'); });
		const externalPromise = queue.enqueue('book', async () => { order.push('external'); });
		releaseRename();
		await Promise.all([updatePromise, externalPromise]);

		expect(order).toEqual(['updateType', 'external']);
	});
});

describe('makeService.retryFailedMoves', () => {
	async function withBookUpdatedToNewBooks() {
		const vault = fakeVault();
		const updated: TypeSchema = { ...BOOK, instancesFolder: 'NewBooks' };
		await vault.create('Make/Types/book.json', serializeTypeSchema(updated));
		// Two orphaned instance files left at the OLD folder after a prior partial-move.
		await vault.create('Books/Dune.md', '---\ntitle: Dune\n---');
		await vault.create('Books/Neuromancer.md', '---\ntitle: Neuromancer\n---');
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		return { vault, svc, ports };
	}

	it('retries failed paths, renames to current instancesFolder, reports movedCount', async () => {
		const { vault, svc, ports } = await withBookUpdatedToNewBooks();
		const r = await svc.retryFailedMoves('book', ['Books/Dune.md', 'Books/Neuromancer.md']);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.movedCount).toBe(2);
		expect(r.value.failedMoves).toEqual([]);
		expect(r.value.newFolder).toBe('NewBooks');
		expect(await vault.exists('NewBooks/Dune.md')).toBe(true);
		expect(await vault.exists('NewBooks/Neuromancer.md')).toBe(true);
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instances-moved',
			expect.objectContaining({ typeId: 'book' }));
	});

	it('still-failing paths come back in failedMoves; movedCount reflects the successful subset', async () => {
		const { vault, svc } = await withBookUpdatedToNewBooks();
		vault.rename = vi.fn(async (oldPath: string, newPath: string) => {
			if (oldPath === 'Books/Dune.md') return { kind: 'err' as const, error: 'still-locked' };
			// For Neuromancer, still perform the rename via underlying create+delete to mimic success.
			const content = await vault.read(oldPath);
			if (content.kind === 'err') return { kind: 'err' as const, error: content.error };
			const create = await vault.create(newPath, content.value.content);
			if (create.kind === 'err') return { kind: 'err' as const, error: create.error };
			return vault.delete(oldPath);
		}) as typeof vault.rename;
		const r = await svc.retryFailedMoves('book', ['Books/Dune.md', 'Books/Neuromancer.md']);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.movedCount).toBe(1);
		expect(r.value.failedMoves).toHaveLength(1);
		expect(r.value.failedMoves[0]?.path).toBe('Books/Dune.md');
	});

	it('unknown typeId returns type-not-found', async () => {
		const { svc } = await withBookUpdatedToNewBooks();
		const r = await svc.retryFailedMoves('ghost', ['Books/Dune.md']);
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'type-not-found', typeId: 'ghost' } });
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

	it('cascade happy path: alsoDeleteInstances+alsoDeleteBaseFile deletes instances+base+JSON and reports counts', async () => {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Make/Bases/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		await vault.create('Make/Bases/book.base', 'yaml');
		await vault.create('Books/Dune.md', '# Dune');
		await vault.create('Books/Neuromancer.md', '# Neuro');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.deleteType('book', { alsoDeleteInstances: true, alsoDeleteBaseFile: true });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.instancesDeleted).toBe(2);
		expect(r.value.instanceFailures).toEqual([]);
		expect(r.value.baseFileDeleted).toBe(true);
		expect(await vault.exists('Books/Dune.md')).toBe(false);
		expect(await vault.exists('Books/Neuromancer.md')).toBe(false);
		expect(await vault.exists('Make/Bases/book.base')).toBe(false);
		expect(await vault.exists('Make/Types/book.json')).toBe(false);
	});

	it('cascade with per-instance failure: reports partial success without aborting', async () => {
		const vault = fakeVault();
		const stamped: TypeSchema = { ...BOOK, baseFile: { path: 'Make/Bases/book.base', generatedAt: BOOK.createdAt } };
		await vault.create('Make/Types/book.json', serializeTypeSchema(stamped));
		await vault.create('Books/Dune.md', '# Dune');
		await vault.create('Books/Neuromancer.md', '# Neuro');
		// Patch vault.delete so exactly one instance fails.
		const originalDelete = vault.delete;
		vault.delete = vi.fn(async (path: string) => {
			if (path === 'Books/Dune.md') return { kind: 'err' as const, error: 'locked' };
			return originalDelete(path);
		}) as typeof vault.delete;
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.deleteType('book', { alsoDeleteInstances: true, alsoDeleteBaseFile: false });
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') throw new Error('unreachable');
		expect(r.value.instancesDeleted).toBe(1);
		expect(r.value.instanceFailures).toHaveLength(1);
		expect(r.value.instanceFailures[0]?.path).toBe('Books/Dune.md');
	});

	it('no cascade: vault.delete called once (for type JSON), never for instances', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		await vault.create('Books/Dune.md', '# Dune');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: false });
		expect(vault.delete).toHaveBeenCalledTimes(1);
		expect(vault.delete).toHaveBeenCalledWith('Make/Types/book.json');
	});

	it('emits make:type-deleted exactly once after cascade succeeds', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		await vault.create('Books/Dune.md', '# Dune');
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc.deleteType('book', { alsoDeleteInstances: true, alsoDeleteBaseFile: false });
		const typeDeletedCalls = (ports.eventBus.emit as ReturnType<typeof vi.fn>).mock.calls
			.filter((c) => c[0] === 'make:type-deleted');
		expect(typeDeletedCalls).toHaveLength(1);
		expect(typeDeletedCalls[0]?.[1]).toEqual({ typeId: 'book', name: 'Book' });
	});

	it('returns vault-error on type JSON delete failure', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		// Rig vault.delete to fail only on the JSON path.
		const originalDelete = vault.delete;
		vault.delete = vi.fn(async (path: string) => {
			if (path === 'Make/Types/book.json') return { kind: 'err' as const, error: 'EIO' };
			return originalDelete(path);
		}) as typeof vault.delete;
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.deleteType('book', { alsoDeleteInstances: false, alsoDeleteBaseFile: false });
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'vault-error' } });
	});

	it('emits make:type-deleted (no cascade)', async () => {
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

describe('listTypes error handling', () => {
	it('returns ok({ types: [], issues: [] }) when types folder does not exist', async () => {
		const ports = fakeModulePorts();
		vi.spyOn(ports.vault, 'exists').mockResolvedValue(false);
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		expect(result.kind).toBe('ok');
		if (result.kind === 'ok') expect(result.value).toEqual({ types: [], issues: [] });
	});

	it('returns vault-error when folder exists but list fails', async () => {
		const ports = fakeModulePorts();
		vi.spyOn(ports.vault, 'exists').mockResolvedValue(true);
		vi.spyOn(ports.vault, 'list').mockResolvedValue(err('EACCES: permission denied'));
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		expect(result.kind).toBe('err');
		if (result.kind === 'err') {
			expect(result.error.kind).toBe('vault-error');
			if (result.error.kind === 'vault-error') {
				expect(result.error.cause).toContain('EACCES');
			}
		}
	});

	it('surfaces malformed JSON as issues with invalid-json SchemaError', async () => {
		const vault = fakeVault({
			'Make/Types/book.json':   serializeTypeSchema(BOOK),
			'Make/Types/broken.json': '{ malformed json',
		});
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		if (result.kind !== 'ok') throw new Error('unreachable');
		expect(result.value.types).toHaveLength(1);
		expect(result.value.issues).toHaveLength(1);
		expect(result.value.issues[0]?.filename).toBe('broken.json');
		expect(result.value.issues[0]?.error.kind).toBe('invalid-json');
	});

	it('surfaces read failure as issues with io-error', async () => {
		const vault = fakeVault({
			'Make/Types/book.json':   serializeTypeSchema(BOOK),
			'Make/Types/secret.json': { __readError: 'permission denied' },
		});
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		if (result.kind !== 'ok') throw new Error('unreachable');
		expect(result.value.types).toHaveLength(1);
		expect(result.value.issues).toHaveLength(1);
		expect(result.value.issues[0]?.filename).toBe('secret.json');
		expect(result.value.issues[0]?.error.kind).toBe('io-error');
	});

	it('separates valid, corrupt, and io-failing files into correct buckets', async () => {
		const vault = fakeVault({
			'Make/Types/book.json':   serializeTypeSchema(BOOK),
			'Make/Types/broken.json': '{ malformed',
			'Make/Types/secret.json': { __readError: 'permission denied' },
		});
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		if (result.kind !== 'ok') throw new Error('unreachable');
		expect(result.value.types).toHaveLength(1);
		expect(result.value.issues).toHaveLength(2);
		const kinds = result.value.issues.map((i) => i.error.kind).sort();
		expect(kinds).toEqual(['invalid-json', 'io-error']);
	});

	it('returns outer vault-error when folder listing itself fails', async () => {
		const vault = fakeVault(
			{ 'Make/Types/book.json': serializeTypeSchema(BOOK) },
			{ listError: 'permission denied on Make/Types/' },
		);
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.listTypes();
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error.kind).toBe('vault-error');
	});
});

describe('makeService.createInstance', () => {
	async function withBook(extra?: Record<string, string | { __readError: string }>) {
		const seed: Record<string, string | { __readError: string }> = {
			'Make/Types/book.json': serializeTypeSchema(BOOK),
			...(extra ?? {}),
		};
		const vault = fakeVault(seed);
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		return { vault, ports, svc };
	}

	it('happy path: writes file, emits make:instance-created, returns InstanceRef', async () => {
		const { vault, ports, svc } = await withBook();
		const r = await svc.createInstance('book', { title: 'Dune' }, null);
		expect(r.kind).toBe('ok');
		if (r.kind !== 'ok') return;
		expect(r.value.typeId).toBe('book');
		expect(r.value.path).toBe('Books/Dune.md');
		expect(r.value.title).toBe('Dune');
		expect(r.value.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(r.value.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(await vault.exists('Books/Dune.md')).toBe(true);
		expect(ports.eventBus.emit).toHaveBeenCalledWith('make:instance-created', { typeId: 'book', path: 'Books/Dune.md' });
	});

	it('returns invalid-values when validation fails (missing required title)', async () => {
		const { svc } = await withBook();
		const r = await svc.createInstance('book', {}, null);
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'invalid-values' } });
		if (r.kind === 'err' && r.error.kind === 'invalid-values') {
			expect(r.error.issues[0]?.kind).toBe('required-missing');
		}
	});

	it('returns no-title-field when titleFieldName is null and no explicitFilename is given', async () => {
		const NO_TITLE: TypeSchema = { ...BOOK, titleFieldName: null };
		const vault = fakeVault({ 'Make/Types/book.json': serializeTypeSchema(NO_TITLE) });
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.createInstance('book', { title: 'Dune' }, null);
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'no-title-field' } });
	});

	it('returns invalid-values with __filename__ when explicitFilename sanitizes to empty', async () => {
		const { svc } = await withBook();
		const r = await svc.createInstance('book', { title: 'Dune' }, '/////');
		expect(r).toMatchObject({
			kind: 'err',
			error: {
				kind: 'invalid-values',
				issues: expect.arrayContaining([
					expect.objectContaining({ kind: 'invalid-text', fieldName: '__filename__' }),
				]),
			},
		});
	});

	it('returns instance-exists on collision when overwrite is not true', async () => {
		const { svc } = await withBook({ 'Books/Dune.md': '# existing' });
		const r = await svc.createInstance('book', { title: 'Dune' }, null);
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'instance-exists', path: 'Books/Dune.md' } });
	});

	it('succeeds on collision when overwrite: true (uses vault.update)', async () => {
		const { vault, svc } = await withBook({ 'Books/Dune.md': '# existing' });
		const r = await svc.createInstance('book', { title: 'Dune' }, null, { overwrite: true });
		expect(r.kind).toBe('ok');
		expect(vault.update).toHaveBeenCalledWith('Books/Dune.md', expect.stringContaining('type: "Book"'));
		expect(vault.create).not.toHaveBeenCalledWith('Books/Dune.md', expect.any(String));
	});

	it('returns vault-error when write fails', async () => {
		const vault = fakeVault({ 'Make/Types/book.json': serializeTypeSchema(BOOK) }, { createError: 'EIO' });
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.createInstance('book', { title: 'Dune' }, null);
		expect(r).toMatchObject({ kind: 'err', error: { kind: 'vault-error' } });
	});

	it('returns vault-error when overwrite update fails', async () => {
		const vault = fakeVault(
			{
				'Make/Types/book.json': serializeTypeSchema(BOOK),
				'Books/Dune.md':        '# existing',
			},
			{ updateError: 'EIO' },
		);
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const r = await svc.createInstance('book', { title: 'Dune' }, null, { overwrite: true });
		expect(r.kind).toBe('err');
		if (r.kind !== 'err') throw new Error('unreachable');
		expect(r.error.kind).toBe('vault-error');
	});
});

describe('makeService.deleteCorruptFile', () => {
	it('deletes the file via vault.delete and returns ok', async () => {
		const vault = fakeVault({ 'Make/Types/broken.json': '{ malformed' });
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.deleteCorruptFile('Make/Types/broken.json');
		expect(result.kind).toBe('ok');
		const existsAfter = await vault.exists('Make/Types/broken.json');
		expect(existsAfter).toBe(false);
	});

	it('returns vault-error when delete fails', async () => {
		const vault = fakeVault({}, { deleteError: 'permission denied' });
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const result = await svc.deleteCorruptFile('Make/Types/x.json');
		expect(result.kind).toBe('err');
		if (result.kind !== 'err') throw new Error('unreachable');
		expect(result.error.kind).toBe('vault-error');
	});

	it('does not emit events', async () => {
		const vault = fakeVault({ 'Make/Types/broken.json': '{ ' });
		const ports = fakeModulePorts({ vault });
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		await svc.deleteCorruptFile('Make/Types/broken.json');
		expect(ports.eventBus.emit).not.toHaveBeenCalled();
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
