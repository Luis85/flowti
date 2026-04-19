import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const RECIPE: TypeSchema = {
	id: 'recipe', name: 'Recipe', instancesFolder: 'Recipes', titleFieldName: 'title',
	fields: [{ kind: 'text', name: 'title', required: true }],
	createdAt: '2026-04-18T00:00:00.000Z', updatedAt: '2026-04-18T00:00:00.000Z',
};

describe('service.getKpis', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
	});

	it('empty vault → all zeros', async () => {
		const svc = createMakeService(fakeModulePorts({ vault: fakeVault() }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis).toEqual({ typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] });
	});

	it('one type, zero instances → typesCount 1, rest zero, perType entry present', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(1);
		expect(kpis.instancesCount).toBe(0);
		expect(kpis.createdThisWeek).toBe(0);
		expect(kpis.perType).toEqual({ book: 0 });
		expect(kpis.recentlyCreated).toEqual([]);
	});

	it('multiple types + instances → correct counts + perType map', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json',   serializeTypeSchema(BOOK));
		await vault.create('Make/Types/recipe.json', serializeTypeSchema(RECIPE));
		await vault.create('Books/Dune.md',          '# Dune');
		await vault.create('Books/Foundation.md',    '# Foundation');
		await vault.create('Recipes/Pizza.md',       '# Pizza');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(2);
		expect(kpis.instancesCount).toBe(3);
		expect(kpis.perType).toEqual({ book: 2, recipe: 1 });
	});

	it('createdThisWeek counts only instances with ctime ≥ now - 7d', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		vi.setSystemTime(new Date('2026-04-13T12:00:00.000Z'));
		await vault.create('Books/Recent.md', '# Recent');
		vi.setSystemTime(new Date('2026-04-10T12:00:00.000Z'));
		await vault.create('Books/Old.md',    '# Old');
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.instancesCount).toBe(2);
		expect(kpis.createdThisWeek).toBe(1);
	});

	it('recentlyCreated sorted descending by createdAt, capped at 10', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json', serializeTypeSchema(BOOK));
		for (let i = 0; i < 12; i++) {
			vi.setSystemTime(new Date(Date.UTC(2026, 3, i + 1, 12, 0, 0)));
			await vault.create(`Books/Book${i}.md`, `# Book${i}`);
		}
		vi.setSystemTime(new Date('2026-04-19T12:00:00.000Z'));
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.recentlyCreated).toHaveLength(10);
		expect(kpis.recentlyCreated[0]!.title).toBe('Book11');
		expect(kpis.recentlyCreated[9]!.title).toBe('Book2');
		for (let i = 0; i < kpis.recentlyCreated.length - 1; i++) {
			expect(kpis.recentlyCreated[i]!.createdAt >= kpis.recentlyCreated[i + 1]!.createdAt).toBe(true);
		}
	});

	it('returns typesCount 0 + empty structure when listTypes has only unparseable files', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/broken.json', '{{not valid json');
		const svc = createMakeService(fakeModulePorts({ vault }), () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(0);
		expect(kpis.instancesCount).toBe(0);
		expect(kpis.perType).toEqual({});
	});

	it('per-type listInstances errors are graceful-degraded (type counts as 0 instances, others unaffected)', async () => {
		const vault = fakeVault();
		await vault.create('Make/Types/book.json',   serializeTypeSchema(BOOK));
		await vault.create('Make/Types/recipe.json', serializeTypeSchema(RECIPE));
		await vault.create('Recipes/Pizza.md',       '# Pizza');
		const ports = fakeModulePorts({ vault });
		const originalList = ports.vault.list;
		ports.vault.list = vi.fn(async (folder: string) => {
			if (folder === 'Books') return { kind: 'err' as const, error: 'scoped' };
			return originalList(folder);
		}) as typeof ports.vault.list;
		const svc = createMakeService(ports, () => MAKE_DEFAULTS);
		const kpis = await svc.getKpis();
		expect(kpis.typesCount).toBe(2);
		expect(kpis.instancesCount).toBe(1);
		expect(kpis.perType).toEqual({ book: 0, recipe: 1 });
	});
});
