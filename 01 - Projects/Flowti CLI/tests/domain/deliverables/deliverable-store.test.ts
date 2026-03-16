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

import { deliverableStore, createDeliverableFile, updateDeliverableStatus } from "../../../src/domain/deliverables/deliverable-store.js";

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

describe("deliverableStore.resolveDir", () => {
	it("returns default directory", () => {
		expect(deliverableStore.resolveDir(deps, "/project")).toBe("/project/docs/deliverables");
	});

	it("respects config dir", () => {
		expect(deliverableStore.resolveDir(deps, "/project", { dir: "deliverables" })).toBe("/project/deliverables");
	});
});

describe("deliverableStore.list", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(deliverableStore.list(deps, "/project")).toEqual([]);
	});

	it("parses deliverables from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["mvp.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: MVP Release\nstatus: in-progress\ndueDate: 2026-04-01\nassignee: Jane\ncompletionPct: 65\n---\nDescription",
		);

		const result = deliverableStore.list(deps, "/project");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("MVP Release");
		expect(result[0].status).toBe("in-progress");
		expect(result[0].dueDate).toBe("2026-04-01");
		expect(result[0].completionPct).toBe(65);
	});
});

describe("createDeliverableFile", () => {
	it("returns null if file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createDeliverableFile(deps, "/project", {
			name: "MVP", status: "planned", description: "",
		});

		expect(result).toBeNull();
	});

	it("creates a deliverable file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createDeliverableFile(deps, "/project", {
			name: "MVP Release", status: "planned", dueDate: "2026-04-01",
			assignee: "Jane", priority: "high", completionPct: 0, description: "First release",
		});

		expect(result).toBe("/project/docs/deliverables/mvp-release.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/deliverables", { recursive: true });
	});
});

describe("updateDeliverableStatus", () => {
	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(updateDeliverableStatus(deps, "/project", "MVP", "done")).toBe(false);
	});

	it("updates status and completion in file content", () => {
		mockDisk.existsSync.mockReturnValue(true);
		let stored = "---\nstatus: planned\ncompletionPct: 0\n---\nBody";
		mockDisk.readFileSync.mockImplementation(() => stored);
		mockDisk.writeFileSync.mockImplementation((_p: string, content: string) => { stored = content; });

		const result = updateDeliverableStatus(deps, "/project", "MVP", "done", 100);

		expect(result).toBe(true);
		expect(stored).toBe("---\nstatus: done\ncompletionPct: 100\n---\nBody");
	});

	it("updates only status when completionPct not provided", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: planned\ncompletionPct: 50\n---\nBody");

		updateDeliverableStatus(deps, "/project", "MVP", "in-progress");

		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/project/docs/deliverables/mvp.md",
			"---\nstatus: in-progress\ncompletionPct: 50\n---\nBody",
			"utf-8",
		);
	});
});
