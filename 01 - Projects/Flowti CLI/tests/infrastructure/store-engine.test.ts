import { describe, it, expect } from "vitest";
import { createStore } from "../../src/infrastructure/store-engine.js";
import type { StoreDescriptor } from "../../src/infrastructure/store-engine.js";
import { createStoreDeps } from "../helpers/store-deps.js";

interface TestSummary {
	name: string;
	status: string;
	count: number;
	file?: string;
}

interface TestDefinition {
	name: string;
	status?: string;
	count?: number;
	description: string;
}

const testDescriptor: StoreDescriptor<TestSummary, TestDefinition> = {
	name: "test-items",
	defaultDir: "docs/test",
	typeTag: "TestItem",
	fields: {
		name: { type: "string", from: "frontmatter", required: true },
		status: { type: "enum", options: ["open", "closed"], default: "open" },
		count: { type: "number", default: 0 },
	},
	buildBody: (def) => `# ${def.name}\n\n${def.description}`,
	sort: (a, b) => a.name.localeCompare(b.name),
};

describe("createStore", () => {
	it("returns object with CRUD methods and __descriptor", () => {
		const store = createStore(testDescriptor);
		expect(store).toHaveProperty("list");
		expect(store).toHaveProperty("read");
		expect(store).toHaveProperty("create");
		expect(store).toHaveProperty("updateField");
		expect(store).toHaveProperty("remove");
		expect(store).toHaveProperty("resolveDir");
		expect(store.__descriptor).toBe(testDescriptor);
	});

	describe("list", () => {
		it("returns parsed items from directory", () => {
			const deps = createStoreDeps({
				files: {
					"/project/docs/test/item-a.md": "---\nname: Item A\nstatus: open\ncount: 5\n---\n# Item A\nBody",
					"/project/docs/test/item-b.md": "---\nname: Item B\nstatus: closed\ncount: 3\n---\n# Item B\nBody",
				},
			});
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items).toHaveLength(2);
			expect(items[0].name).toBe("Item A");
			expect(items[0].status).toBe("open");
			expect(items[0].count).toBe(5);
		});

		it("applies defaults for missing fields", () => {
			const deps = createStoreDeps({
				files: {
					"/project/docs/test/minimal.md": "---\nname: Minimal\n---\nBody",
				},
			});
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items[0].status).toBe("open");
			expect(items[0].count).toBe(0);
		});

		it("returns empty array when directory missing", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items).toEqual([]);
		});
	});

	describe("create", () => {
		it("writes markdown file with frontmatter and body", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			const path = store.create(deps, "/project", {
				name: "New Item",
				status: "open",
				description: "A test item",
			});
			expect(path).toContain("new-item.md");
			const written = deps.disk.files.get("/project/docs/test/new-item.md");
			expect(written).toBeDefined();
			expect(written).toContain("name: New Item");
			expect(written).toContain("type: TestItem");
			expect(written).toContain("# New Item");
		});
	});

	describe("resolveDir", () => {
		it("uses defaultDir when no config", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			expect(store.resolveDir(deps, "/project")).toBe("/project/docs/test");
		});
	});
});
