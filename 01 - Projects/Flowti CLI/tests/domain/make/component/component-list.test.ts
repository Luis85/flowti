import { describe, it, expect, vi } from "vitest";

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		readdirSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
	},
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));


import { disk } from "../../../../src/infrastructure/filesystem.js";
import {
	listProjectComponents,
	buildComponentTree,
	enrichComponentRelationships,
	buildAncestryPath,
	findSiblings,
} from "../../../../src/domain/make/component/component-list.js";
import type { ProjectComponent } from "../../../../src/domain/make/component/component-types.js";

describe("listProjectComponents", () => {
	it("returns empty array when components dir does not exist", () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		expect(listProjectComponents("/project")).toEqual([]);
	});

	it("discovers components from markdown frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["auth-service.md", "user-profile.md"] as never);
		vi.mocked(disk.readFileSync).mockImplementation((path: string) => {
			if (path.includes("auth-service")) {
				return "---\ntype: c4-component\nstatus: active\nname: Auth Service\n---\n# Auth Service\n";
			}
			return "---\ntype: component\nstatus: draft\n---\n# User Profile\n";
		});

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(2);

		const auth = components.find((c) => c.name === "Auth Service");
		expect(auth).toBeDefined();
		expect(auth!.kind).toBe("c4-component");
		expect(auth!.status).toBe("active");

		const user = components.find((c) => c.name === "user-profile");
		expect(user).toBeDefined();
		expect(user!.kind).toBe("component");
		expect(user!.status).toBe("draft");
	});

	it("handles files without frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["plain.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("# Just a heading\nNo frontmatter.");

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(1);
		expect(components[0].kind).toBe("component");
		expect(components[0].status).toBe("unknown");
	});

	it("ignores non-markdown files", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["readme.txt", "data.json", "comp.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\nstatus: draft\n---\n");

		const components = listProjectComponents("/project");
		expect(components).toHaveLength(1);
	});

	it("sorts components alphabetically", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["zebra.md", "alpha.md", "middle.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\nstatus: draft\n---\n");

		const components = listProjectComponents("/project");
		expect(components.map((c) => c.name)).toEqual(["alpha", "middle", "zebra"]);
	});

	it("reads containedBy from frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["api-service.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue(
			"---\ntype: c4-component\nstatus: active\ncontainedBy: Backend\nc4Level: 3\n---\n",
		);

		const components = listProjectComponents("/project");
		expect(components[0].containedBy).toBe("Backend");
		expect(components[0].c4Level).toBe(3);
	});

	it("omits containedBy and c4Level when not in frontmatter", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["plain.md"] as never);
		vi.mocked(disk.readFileSync).mockReturnValue("---\ntype: component\nstatus: draft\n---\n");

		const components = listProjectComponents("/project");
		expect(components[0].containedBy).toBeUndefined();
		expect(components[0].c4Level).toBeUndefined();
	});
});

describe("buildComponentTree", () => {
	function comp(overrides: Partial<ProjectComponent> & { name: string }): ProjectComponent {
		return { kind: "component", status: "active", path: "", ...overrides };
	}

	it("returns flat list for non-C4 components", () => {
		const components = [
			comp({ name: "Button" }),
			comp({ name: "Alert" }),
		];
		const tree = buildComponentTree(components);
		expect(tree).toHaveLength(2);
		expect(tree.every((t) => t.depth === 0)).toBe(true);
	});

	it("groups C4 entities by containment with correct depth", () => {
		const components = [
			comp({ name: "API", kind: "c4-component", containedBy: "Backend" }),
			comp({ name: "Backend", kind: "container", containedBy: "Platform" }),
			comp({ name: "Platform", kind: "system" }),
		];
		const tree = buildComponentTree(components);

		expect(tree[0].component.name).toBe("Platform");
		expect(tree[0].depth).toBe(0);

		expect(tree[1].component.name).toBe("Backend");
		expect(tree[1].depth).toBe(1);

		expect(tree[2].component.name).toBe("API");
		expect(tree[2].depth).toBe(2);
	});

	it("places orphaned C4 entries at depth 0", () => {
		const components = [
			comp({ name: "Orphan", kind: "container", containedBy: "Missing System" }),
		];
		const tree = buildComponentTree(components);
		expect(tree).toHaveLength(1);
		expect(tree[0].depth).toBe(0);
	});

	it("places non-C4 after C4 in output order", () => {
		const components = [
			comp({ name: "Button" }),
			comp({ name: "Platform", kind: "system" }),
		];
		const tree = buildComponentTree(components);
		expect(tree[0].component.name).toBe("Platform");
		expect(tree[1].component.name).toBe("Button");
	});

	it("sorts siblings alphabetically within same level", () => {
		const components = [
			comp({ name: "Zebra System", kind: "system" }),
			comp({ name: "Alpha System", kind: "system" }),
		];
		const tree = buildComponentTree(components);
		expect(tree[0].component.name).toBe("Alpha System");
		expect(tree[1].component.name).toBe("Zebra System");
	});

	it("handles multiple roots with children", () => {
		const components = [
			comp({ name: "Sys A", kind: "system" }),
			comp({ name: "Sys B", kind: "system" }),
			comp({ name: "Container A1", kind: "container", containedBy: "Sys A" }),
			comp({ name: "Container B1", kind: "container", containedBy: "Sys B" }),
		];
		const tree = buildComponentTree(components);
		expect(tree.map((t) => t.component.name)).toEqual([
			"Sys A", "Container A1", "Sys B", "Container B1",
		]);
		expect(tree.map((t) => t.depth)).toEqual([0, 1, 0, 1]);
	});
});

describe("enrichComponentRelationships", () => {
	function comp(overrides: Partial<ProjectComponent> & { name: string }): ProjectComponent {
		return { kind: "component", status: "active", path: "", ...overrides };
	}

	it("populates contains[] from containedBy", () => {
		const components = [
			comp({ name: "Platform", kind: "system" }),
			comp({ name: "Backend", kind: "container", containedBy: "Platform" }),
			comp({ name: "Frontend", kind: "container", containedBy: "Platform" }),
			comp({ name: "API", kind: "c4-component", containedBy: "Backend" }),
		];
		enrichComponentRelationships(components);

		const platform = components.find((c) => c.name === "Platform")!;
		expect(platform.contains).toEqual(["Backend", "Frontend"]);

		const backend = components.find((c) => c.name === "Backend")!;
		expect(backend.contains).toEqual(["API"]);
	});

	it("assigns empty contains[] to components with no children", () => {
		const components = [
			comp({ name: "Leaf", kind: "c4-component", containedBy: "Parent" }),
			comp({ name: "Standalone" }),
		];
		enrichComponentRelationships(components);

		expect(components[0].contains).toEqual([]);
		expect(components[1].contains).toEqual([]);
	});

	it("handles empty array", () => {
		const components: ProjectComponent[] = [];
		enrichComponentRelationships(components);
		expect(components).toEqual([]);
	});

	it("is called automatically by listProjectComponents", () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readdirSync).mockReturnValue(["parent.md", "child.md"] as never);
		vi.mocked(disk.readFileSync).mockImplementation((path: string) => {
			if (path.includes("parent")) {
				return "---\ntype: system\nstatus: active\nname: Parent\n---\n";
			}
			return "---\ntype: container\nstatus: active\nname: Child\ncontainedBy: Parent\n---\n";
		});

		const components = listProjectComponents("/project");
		const parent = components.find((c) => c.name === "Parent")!;
		expect(parent.contains).toEqual(["Child"]);
	});
});

describe("buildAncestryPath", () => {
	function comp(overrides: Partial<ProjectComponent> & { name: string }): ProjectComponent {
		return { kind: "component", status: "active", path: "", ...overrides };
	}

	it("returns single name for root component", () => {
		const root = comp({ name: "Platform", kind: "system" });
		expect(buildAncestryPath(root, [root])).toBe("Platform");
	});

	it("builds full path for deeply nested component", () => {
		const components = [
			comp({ name: "Platform", kind: "system" }),
			comp({ name: "Backend", kind: "container", containedBy: "Platform" }),
			comp({ name: "API", kind: "c4-component", containedBy: "Backend" }),
		];
		const api = components[2];
		expect(buildAncestryPath(api, components)).toBe("Platform > Backend > API");
	});

	it("handles orphan with missing parent gracefully", () => {
		const orphan = comp({ name: "Orphan", kind: "container", containedBy: "Missing" });
		expect(buildAncestryPath(orphan, [orphan])).toBe("Orphan");
	});

	it("handles circular containment without infinite loop", () => {
		const components = [
			comp({ name: "A", kind: "container", containedBy: "B" }),
			comp({ name: "B", kind: "container", containedBy: "A" }),
		];
		const path = buildAncestryPath(components[0], components);
		expect(path).toContain("A");
		expect(path).toContain("B");
	});
});

describe("findSiblings", () => {
	function comp(overrides: Partial<ProjectComponent> & { name: string }): ProjectComponent {
		return { kind: "component", status: "active", path: "", ...overrides };
	}

	it("returns siblings with the same parent", () => {
		const components = [
			comp({ name: "Platform", kind: "system" }),
			comp({ name: "Backend", kind: "container", containedBy: "Platform" }),
			comp({ name: "Frontend", kind: "container", containedBy: "Platform" }),
			comp({ name: "Mobile", kind: "container", containedBy: "Platform" }),
		];
		const siblings = findSiblings(components[1], components);
		expect(siblings.map((c) => c.name)).toEqual(["Frontend", "Mobile"]);
	});

	it("returns empty array when no siblings exist", () => {
		const components = [
			comp({ name: "Platform", kind: "system" }),
			comp({ name: "Backend", kind: "container", containedBy: "Platform" }),
		];
		expect(findSiblings(components[1], components)).toEqual([]);
	});

	it("groups root-level components as siblings (containedBy undefined)", () => {
		const components = [
			comp({ name: "Sys A", kind: "system" }),
			comp({ name: "Sys B", kind: "system" }),
			comp({ name: "Sys C", kind: "system" }),
		];
		const siblings = findSiblings(components[0], components);
		expect(siblings.map((c) => c.name)).toEqual(["Sys B", "Sys C"]);
	});
});
