import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	return {
		Document: {
			create: () => {
				let fm: Record<string, unknown> = {};
				const doc = {
					mergeFrontmatter: (obj: Record<string, unknown>) => { fm = { ...fm, ...obj }; return doc; },
					addBlank: () => doc,
					heading: () => doc,
					text: () => doc,
					save: () => {},
				};
				return doc;
			},
		},
	};
});

vi.mock("../../../src/infrastructure/frontmatter.js", () => ({
	parseFrontmatterStrings: vi.fn((content: string) => {
		const fm: Record<string, string> = {};
		const match = content.match(/^---\n([\s\S]*?)\n---/);
		if (match) {
			for (const line of match[1].split("\n")) {
				const kv = line.match(/^([\w]+):\s*(.*)$/);
				if (kv) fm[kv[1]] = kv[2];
			}
		}
		return fm;
	}),
}));

import { raidDir, listRAIDItems, createRAIDItem, updateRAIDStatus } from "../../../src/domain/raid/raid-store.js";

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

describe("raidDir", () => {
	it("returns default directory", () => {
		expect(raidDir(deps, "/project")).toBe("/project/docs/raid");
	});

	it("respects config dir", () => {
		expect(raidDir(deps, "/project", { dir: "custom/raid" })).toBe("/project/custom/raid");
	});
});

describe("listRAIDItems", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listRAIDItems(deps, "/project")).toEqual([]);
	});

	it("parses RAID items from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["db-migration-risk.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: DB Migration Risk\nitemType: risk\nstatus: open\nseverity: high\nowner: Jane\ndueDate: 2026-04-01\n---\nDescription",
		);

		const result = listRAIDItems(deps, "/project");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("DB Migration Risk");
		expect(result[0].itemType).toBe("risk");
		expect(result[0].status).toBe("open");
		expect(result[0].severity).toBe("high");
		expect(result[0].owner).toBe("Jane");
	});

	it("sorts items alphabetically", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["z-item.md", "a-item.md"]);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\nname: Zeta\nitemType: risk\nstatus: open\nseverity: low\n---")
			.mockReturnValueOnce("---\nname: Alpha\nitemType: issue\nstatus: open\nseverity: medium\n---");

		const result = listRAIDItems(deps, "/project");

		expect(result[0].name).toBe("Alpha");
		expect(result[1].name).toBe("Zeta");
	});
});

describe("createRAIDItem", () => {
	it("returns null if file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createRAIDItem(deps, "/project", {
			name: "Test Risk", itemType: "risk", status: "open", severity: "medium", description: "",
		});

		expect(result).toBeNull();
	});

	it("creates a RAID item file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createRAIDItem(deps, "/project", {
			name: "DB Migration Risk", itemType: "risk", status: "open", severity: "high",
			owner: "Jane", dueDate: "2026-04-01", category: "technical", description: "Risk of data loss",
		});

		expect(result).toBe("/project/docs/raid/db-migration-risk.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/raid", { recursive: true });
	});
});

describe("updateRAIDStatus", () => {
	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(updateRAIDStatus(deps, "/project", "Test Risk", "mitigated")).toBe(false);
	});

	it("updates status in file content", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: open\nseverity: high\n---\nBody");

		const result = updateRAIDStatus(deps, "/project", "Test Risk", "mitigated");

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/project/docs/raid/test-risk.md",
			"---\nstatus: mitigated\nseverity: high\n---\nBody",
			"utf-8",
		);
	});
});
