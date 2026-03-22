import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/plugin",
}));

vi.mock("../../../../src/infrastructure/clock.js", () => ({
	clock: {
		now: () => new Date("2026-03-10T12:00:00Z"),
		iso: () => "2026-03-10T12:00:00.000Z",
		safeIso: () => "2026-03-10T12-00-00",
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
});

// ── TypeDoc kind values (from source) ────────────────────────────

const KIND: Record<string, number> = {
	MODULE: 2,
	FUNCTION: 64,
	CLASS: 128,
	INTERFACE: 256,
	CONSTRUCTOR: 512,
	PROPERTY: 1024,
	METHOD: 2048,
	TYPE_ALIAS: 2097152,
	GET_SIGNATURE: 262144,
	REFERENCE: 4194304,
};

import { countByKind } from "../../../../src/domain/reports/generators/codebase-report.js";

interface TypeDocNode { kind?: number; name?: string; schemaVersion?: string; children?: TypeDocNode[] }

function countOf(counts: Record<number, number>, kind: number): number {
	return counts[kind] || 0;
}

describe("codebase-report generator", () => {
	describe("countByKind", () => {
		it("counts kinds in a flat structure", () => {
			const node: TypeDocNode = {
				kind: 1,
				children: [
					{ kind: KIND.CLASS },
					{ kind: KIND.CLASS },
					{ kind: KIND.FUNCTION },
				],
			};
			const counts = countByKind(node);
			expect(countOf(counts, KIND.CLASS)).toBe(2);
			expect(countOf(counts, KIND.FUNCTION)).toBe(1);
		});

		it("counts kinds in nested structure", () => {
			const node: TypeDocNode = {
				kind: KIND.MODULE,
				children: [
					{
						kind: KIND.CLASS,
						children: [
							{ kind: KIND.METHOD },
							{ kind: KIND.METHOD },
							{ kind: KIND.PROPERTY },
						],
					},
					{ kind: KIND.INTERFACE },
				],
			};
			const counts = countByKind(node);
			expect(countOf(counts, KIND.MODULE)).toBe(1);
			expect(countOf(counts, KIND.CLASS)).toBe(1);
			expect(countOf(counts, KIND.METHOD)).toBe(2);
			expect(countOf(counts, KIND.PROPERTY)).toBe(1);
			expect(countOf(counts, KIND.INTERFACE)).toBe(1);
		});

		it("handles empty node", () => {
			const counts = countByKind({});
			expect(Object.keys(counts)).toHaveLength(0);
		});

		it("handles node with no children", () => {
			const counts = countByKind({ kind: KIND.FUNCTION });
			expect(countOf(counts, KIND.FUNCTION)).toBe(1);
		});
	});

	describe("countOf", () => {
		it("returns 0 for missing kind", () => {
			expect(countOf({}, KIND.CLASS)).toBe(0);
		});

		it("returns count for present kind", () => {
			expect(countOf({ [KIND.CLASS]: 5 }, KIND.CLASS)).toBe(5);
		});
	});

	describe("buildCodebaseFm", () => {
		function buildCodebaseFm(data: TypeDocNode, counts: Record<number, number>, date: string): Record<string, string | number> {
			return {
				type: "CodebaseReport",
				date,
				schema_version: data.schemaVersion || "unknown",
				modules: countOf(counts, KIND.MODULE),
				classes: countOf(counts, KIND.CLASS),
				interfaces: countOf(counts, KIND.INTERFACE),
				functions: countOf(counts, KIND.FUNCTION),
				type_aliases: countOf(counts, KIND.TYPE_ALIAS),
				methods: countOf(counts, KIND.METHOD),
				properties: countOf(counts, KIND.PROPERTY),
				constructors: countOf(counts, KIND.CONSTRUCTOR),
			};
		}

		it("builds frontmatter with all counts", () => {
			const data: TypeDocNode = { schemaVersion: "4.0" };
			const counts = { [KIND.MODULE]: 3, [KIND.CLASS]: 5, [KIND.INTERFACE]: 10 };
			const fm = buildCodebaseFm(data, counts, "2026-03-10");
			expect(fm.type).toBe("CodebaseReport");
			expect(fm.schema_version).toBe("4.0");
			expect(fm.modules).toBe(3);
			expect(fm.classes).toBe(5);
			expect(fm.interfaces).toBe(10);
			expect(fm.functions).toBe(0);
		});

		it("uses 'unknown' for missing schema version", () => {
			const fm = buildCodebaseFm({}, {}, "2026-03-10");
			expect(fm.schema_version).toBe("unknown");
		});
	});
});
