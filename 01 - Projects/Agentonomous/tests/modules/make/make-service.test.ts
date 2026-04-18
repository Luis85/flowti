import { describe, it, expect, vi } from 'vitest';
import { createMakeService } from '../../../src/modules/make/make-service.js';
import { MAKE_DEFAULTS } from '../../../src/modules/make/make-settings.js';
import { fakeModulePorts, fakeVault } from '../../__fakes__/fake-ports.js';
import { serializeTypeSchema } from '../../../src/domain/make/type-schema-codec.js';
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
	it('write methods return not-implemented', async () => {
		const svc = createMakeService(fakeModulePorts(), () => MAKE_DEFAULTS);
		const draftR = await svc.createType({ name: 'X', instancesFolder: 'X', titleFieldName: null, fields: [] });
		expect(draftR).toMatchObject({ kind: 'err', error: { kind: 'not-implemented' } });
		const updateR = await svc.updateType('book', {});
		expect(updateR).toMatchObject({ kind: 'err', error: { kind: 'not-implemented' } });
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
