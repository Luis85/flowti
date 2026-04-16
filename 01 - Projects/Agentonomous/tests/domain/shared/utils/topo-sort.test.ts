import { describe, expect, it } from 'vitest';
import { topologicalSort } from '../../../../src/domain/shared/utils/topo-sort.js';
import { isErr, isOk } from '../../../../src/domain/shared/result.js';

type Node = { id: string; dependsOn?: readonly string[] };

describe('topologicalSort', () => {
	it('returns nodes in dependency order', () => {
		const nodes: Node[] = [
			{ id: 'c', dependsOn: ['b'] },
			{ id: 'a' },
			{ id: 'b', dependsOn: ['a'] },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const ids = result.value.map((n) => n.id);
			expect(ids).toEqual(['a', 'b', 'c']);
		}
	});

	it('returns nodes unchanged when no dependencies', () => {
		const nodes: Node[] = [{ id: 'a' }, { id: 'b' }];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
	});

	it('returns err on circular dependency', () => {
		const nodes: Node[] = [
			{ id: 'a', dependsOn: ['b'] },
			{ id: 'b', dependsOn: ['a'] },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error).toMatch(/circular/i);
	});

	it('returns err on unknown dependency', () => {
		const nodes: Node[] = [{ id: 'a', dependsOn: ['nonexistent'] }];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isErr(result)).toBe(true);
		if (isErr(result)) expect(result.error).toMatch(/unknown/i);
	});

	it('handles diamond dependencies', () => {
		const nodes: Node[] = [
			{ id: 'd', dependsOn: ['b', 'c'] },
			{ id: 'b', dependsOn: ['a'] },
			{ id: 'c', dependsOn: ['a'] },
			{ id: 'a' },
		];
		const result = topologicalSort(nodes, (n) => n.id, (n) => n.dependsOn ?? []);
		expect(isOk(result)).toBe(true);
		if (isOk(result)) {
			const ids = result.value.map((n) => n.id);
			expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
			expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
			expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
			expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
		}
	});
});
