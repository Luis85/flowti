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

import { capaDir, listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../../../src/domain/capa/capa-store.js";

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

describe("capaDir", () => {
	it("returns default directory", () => {
		expect(capaDir(deps, "/project")).toBe("/project/docs/capa");
	});

	it("respects config dir", () => {
		expect(capaDir(deps, "/project", { dir: "custom/capa" })).toBe("/project/custom/capa");
	});
});

describe("nextCapaId", () => {
	it("returns CAPA-001 for empty list", () => {
		expect(nextCapaId([])).toBe("CAPA-001");
	});

	it("increments from highest existing ID", () => {
		expect(nextCapaId(["CAPA-001", "CAPA-003"])).toBe("CAPA-004");
	});

	it("handles non-CAPA IDs gracefully", () => {
		expect(nextCapaId(["CAPA-002", "OTHER-005"])).toBe("CAPA-003");
	});
});

describe("listCAPAItems", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listCAPAItems(deps, "/project")).toEqual([]);
	});

	it("parses CAPA items from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["process-failure.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Process Failure\nid: CAPA-001\ncapaType: corrective\nstatus: open\nseverity: high\nsource: audit\nowner: Jane\ndueDate: 2026-04-01\n---\nDescription",
		);

		const result = listCAPAItems(deps, "/project");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Process Failure");
		expect(result[0].id).toBe("CAPA-001");
		expect(result[0].capaType).toBe("corrective");
		expect(result[0].status).toBe("open");
		expect(result[0].severity).toBe("high");
		expect(result[0].source).toBe("audit");
		expect(result[0].owner).toBe("Jane");
	});

	it("sorts items alphabetically", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["z-item.md", "a-item.md"]);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\nname: Zeta\nid: CAPA-002\ncapaType: corrective\nstatus: open\nseverity: low\n---")
			.mockReturnValueOnce("---\nname: Alpha\nid: CAPA-001\ncapaType: preventive\nstatus: open\nseverity: medium\n---");

		const result = listCAPAItems(deps, "/project");

		expect(result[0].name).toBe("Alpha");
		expect(result[1].name).toBe("Zeta");
	});
});

describe("createCAPAItem", () => {
	it("returns null if file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createCAPAItem(deps, "/project", {
			name: "Test Issue", id: "CAPA-001", capaType: "corrective", status: "open", severity: "medium", source: "observation", description: "",
		});

		expect(result).toBeNull();
	});

	it("creates a CAPA item file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createCAPAItem(deps, "/project", {
			name: "Process Failure", id: "CAPA-001", capaType: "corrective", status: "open", severity: "high",
			source: "audit", owner: "Jane", dueDate: "2026-04-01", rootCause: "Missing validation", description: "Process failed during audit",
		});

		expect(result).toBe("/project/docs/capa/process-failure.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/capa", { recursive: true });
	});
});

describe("updateCAPAStatus", () => {
	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(updateCAPAStatus(deps, "/project", "Test Issue", "investigating")).toBe(false);
	});

	it("updates status in file content", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: open\nseverity: high\n---\nBody");

		const result = updateCAPAStatus(deps, "/project", "Test Issue", "investigating");

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/project/docs/capa/test-issue.md",
			"---\nstatus: investigating\nseverity: high\n---\nBody",
			"utf-8",
		);
	});
});
