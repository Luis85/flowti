import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	const docs: { path: string; content: string }[] = [];
	return {
		Document: {
			create: (name: string) => {
				let fm: Record<string, unknown> = {};
				let body = "";
				const doc = {
					mergeFrontmatter: (obj: Record<string, unknown>) => { fm = { ...fm, ...obj }; return doc; },
					addBlank: () => doc,
					heading: (_l: number, _t: string) => doc,
					text: (t: string) => { body += t; return doc; },
					save: (path: string) => {
						const lines = ["---"];
						for (const [k, v] of Object.entries(fm)) lines.push(`${k}: ${v}`);
						lines.push("---", "", body);
						docs.push({ path, content: lines.join("\n") });
					},
				};
				return doc;
			},
		},
		_docs: docs,
	};
});

vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterStrings: vi.fn((content: string) => {
		const fm: Record<string, string> = {};
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (match) {
			for (const line of match[1].split("\n")) {
				const kv = line.match(/^(\w+):\s*(.*)$/);
				if (kv) fm[kv[1]] = kv[2];
			}
		}
		return fm;
	}),
}));

import { resourcesDir, listResources, createResourceFile, updateConsumption } from "../../../src/domain/resources/resource-store.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(() => []),
	mkdirSync: vi.fn(),
};

const mockPaths = {
	join: (...args: string[]) => args.join("/"),
};

const mockClock = {
	iso: () => "2026-01-01T00:00:00.000Z",
};

const deps = { disk: mockDisk as any, paths: mockPaths as any, clock: mockClock as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("resourcesDir", () => {
	it("returns default directory", () => {
		expect(resourcesDir(deps, "/project")).toBe("/project/docs/resources");
	});

	it("respects config dir", () => {
		expect(resourcesDir(deps, "/project", { dir: "custom/res" })).toBe("/project/custom/res");
	});
});

describe("listResources", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listResources(deps, "/project")).toEqual([]);
	});

	it("parses resource files from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["jane-doe.md", "server.md"]);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\nname: Jane Doe\nresourceType: human\nprice: 100\namount: 1\nconsumed: 0.5\n---")
			.mockReturnValueOnce("---\nname: Server\nresourceType: material\nprice: 500\namount: 3\nconsumed: 1\n---");

		const result = listResources(deps, "/project");

		expect(result).toHaveLength(2);
		expect(result[0].name).toBe("Jane Doe");
		expect(result[0].resourceType).toBe("human");
		expect(result[0].price).toBe(100);
		expect(result[0].totalCost).toBe(100);
		expect(result[0].consumedCost).toBe(50);
		expect(result[0].remaining).toBe(0.5);
	});

	it("sorts resources alphabetically", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["z-resource.md", "a-resource.md"]);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\nname: Zeta\nresourceType: human\nprice: 0\namount: 0\nconsumed: 0\n---")
			.mockReturnValueOnce("---\nname: Alpha\nresourceType: human\nprice: 0\namount: 0\nconsumed: 0\n---");

		const result = listResources(deps, "/project");

		expect(result[0].name).toBe("Alpha");
		expect(result[1].name).toBe("Zeta");
	});
});

describe("createResourceFile", () => {
	it("returns null if file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createResourceFile(deps, "/project", {
			name: "Jane", resourceType: "human", price: 100, amount: 1, consumed: 0, status: "active", description: "",
		});

		expect(result).toBeNull();
	});

	it("creates a human resource file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createResourceFile(deps, "/project", {
			name: "Jane Doe", resourceType: "human", role: "Developer", price: 120, amount: 1, consumed: 0, status: "active", description: "Lead dev",
		});

		expect(result).toBe("/project/docs/resources/jane-doe.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/resources", { recursive: true });
	});

	it("creates a role resource with hourlyRate", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createResourceFile(deps, "/project", {
			name: "Senior Dev", resourceType: "role", price: 150, hourlyRate: 150, amount: 2, consumed: 0, status: "active", description: "",
		});

		expect(result).toBe("/project/docs/resources/senior-dev.md");
	});
});

describe("updateConsumption", () => {
	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(updateConsumption(deps, "/project", "Jane", 1)).toBe(false);
	});

	it("updates consumed field in file content", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nconsumed: 0.5\n---\nNotes");

		const result = updateConsumption(deps, "/project", "Jane", 1.5);

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/project/docs/resources/jane.md",
			"---\nconsumed: 1.5\n---\nNotes",
			"utf-8",
		);
	});
});
