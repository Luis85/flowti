import { err, ok, type Result } from '../result.js';

export function topologicalSort<T>(
	nodes: readonly T[],
	getId: (node: T) => string,
	getDeps: (node: T) => readonly string[],
): Result<T[], string> {
	const nodeMap = new Map<string, T>();
	for (const node of nodes) {
		nodeMap.set(getId(node), node);
	}

	const visited = new Set<string>();
	const visiting = new Set<string>();
	const sorted: T[] = [];

	function visit(id: string): string | null {
		if (visited.has(id)) return null;
		if (visiting.has(id)) return `circular dependency involving "${id}"`;
		const node = nodeMap.get(id);
		if (node === undefined) return `unknown dependency "${id}"`;
		visiting.add(id);
		for (const dep of getDeps(node)) {
			const error = visit(dep);
			if (error !== null) return error;
		}
		visiting.delete(id);
		visited.add(id);
		sorted.push(node);
		return null;
	}

	for (const node of nodes) {
		const error = visit(getId(node));
		if (error !== null) return err(error);
	}

	return ok(sorted);
}
