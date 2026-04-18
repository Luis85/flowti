import { describe, it, expect } from 'vitest';
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
