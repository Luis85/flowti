import { describe, it, expect } from "vitest";
import { suggestRelationships, extractImports } from "../../../../src/domain/make/component/component-suggest.js";
import type { ProjectComponent } from "../../../../src/domain/make/component/component-types.js";

function makeComp(overrides: Partial<ProjectComponent> = {}): ProjectComponent {
	return {
		name: "Comp", kind: "component", status: "active",
		path: "components/comp/comp.md",
		...overrides,
	} as ProjectComponent;
}

function makeDisk(files: Record<string, string>) {
	return {
		existsSync: (p: string) => Object.keys(files).some((k) => p.replace(/\\/g, "/").endsWith(k)),
		readFileSync: (p: string) => {
			const key = Object.keys(files).find((k) => p.replace(/\\/g, "/").endsWith(k));
			return key ? files[key] : "";
		},
		readdirSync: (p: string) => {
			const norm = p.replace(/\\/g, "/");
			const entries = new Set<string>();
			for (const key of Object.keys(files)) {
				if (key.startsWith(norm.split("/").pop()! + "/") || key.includes(norm.split("/").pop()! + "/")) {
					const rel = key.split("/").pop()!;
					entries.add(rel);
				}
			}
			// Return .ts files in the directory
			return Object.keys(files)
				.filter((k) => {
					const dir = k.substring(0, k.lastIndexOf("/"));
					return norm.endsWith(dir) || norm.replace(/\\/g, "/").endsWith(dir);
				})
				.map((k) => k.split("/").pop()!);
		},
	};
}

const mockPaths = {
	join: (...a: string[]) => a.join("/"),
	dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	basename: (p: string) => p.split("/").pop() || "",
	resolve: (...a: string[]) => a.join("/"),
	sep: "/",
};

describe("extractImports", () => {
	it("extracts import paths from source", () => {
		const source = `
import { Foo } from "./foo.js";
import { Bar } from "../bar/bar.js";
export { Baz } from "@scope/baz";
`;
		const imports = extractImports(source);
		expect(imports).toContain("./foo.js");
		expect(imports).toContain("../bar/bar.js");
		expect(imports).toContain("@scope/baz");
	});

	it("returns empty for no imports", () => {
		expect(extractImports("const x = 1;")).toEqual([]);
	});
});

describe("suggestRelationships", () => {
	it("returns empty for components with no ts files", () => {
		const components = [makeComp({ name: "A", path: "components/a/a.md" })];
		const disk = {
			existsSync: () => true,
			readFileSync: () => "",
			readdirSync: () => [],
		};
		const suggestions = suggestRelationships(components, "/project", { disk, paths: mockPaths } as any);
		expect(suggestions).toEqual([]);
	});

	it("returns empty for no components", () => {
		const suggestions = suggestRelationships([], "/project", { disk: { existsSync: () => false } as any, paths: mockPaths } as any);
		expect(suggestions).toEqual([]);
	});

	it("does not suggest already-existing relationships", () => {
		const components = [
			makeComp({
				name: "A",
				path: "components/a/a.md",
				relationships: [{ target: "B", type: "uses" }],
			}),
			makeComp({ name: "B", path: "components/b/b.md" }),
		];
		const disk = {
			existsSync: () => true,
			readFileSync: () => 'import { x } from "../b/b.js";',
			readdirSync: () => ["a.ts"],
		};
		const suggestions = suggestRelationships(components, "/project", { disk, paths: mockPaths } as any);
		expect(suggestions).toEqual([]);
	});
});
