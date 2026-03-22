import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	const docs: { path: string }[] = [];
	return {
		Document: {
			create: () => {
				let fm: Record<string, unknown> = {};
				const doc = {
					mergeFrontmatter: (obj: Record<string, unknown>) => { fm = { ...fm, ...obj }; return doc; },
					addBlank: () => doc,
					heading: () => doc,
					text: () => doc,
					save: (path: string) => { docs.push({ path }); },
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

import { timelogStore, createTimeLogEntry, summarizeTimeLog } from "../../../src/domain/timelog/timelog-store.js";

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
	iso: () => "2026-03-12T00:00:00.000Z",
};

const deps = { disk: mockDisk as any, paths: mockPaths as any, clock: mockClock as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("timelogStore.resolveDir", () => {
	it("returns default directory", () => {
		expect(timelogStore.resolveDir(deps, "/project")).toBe("/project/docs/timelog");
	});

	it("respects config dir", () => {
		expect(timelogStore.resolveDir(deps, "/project", { dir: "logs" })).toBe("/project/logs");
	});
});

describe("timelogStore.list", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(timelogStore.list(deps, "/project")).toEqual([]);
	});

	it("parses entries from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["2026-03-12-jane.md"] as never);
		mockDisk.readFileSync.mockReturnValue("---\ndate: 2026-03-12\nperson: Jane\nhours: 4\ncategory: dev\ntask: Feature\n---\nSome notes" as never);

		const entries = timelogStore.list(deps, "/project");

		expect(entries).toHaveLength(1);
		expect(entries[0].person).toBe("Jane");
		expect(entries[0].hours).toBe(4);
		expect(entries[0].task).toBe("Feature");
		expect(entries[0].description).toBe("Some notes");
	});

	it("sorts entries by date descending", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["a.md", "b.md"] as never);
		mockDisk.readFileSync
			.mockReturnValueOnce("---\ndate: 2026-03-10\nperson: A\nhours: 1\ncategory: dev\ntask: Old\n---")
			.mockReturnValueOnce("---\ndate: 2026-03-12\nperson: B\nhours: 2\ncategory: dev\ntask: New\n---");

		const entries = timelogStore.list(deps, "/project");

		expect(entries[0].date).toBe("2026-03-12");
		expect(entries[1].date).toBe("2026-03-10");
	});
});

describe("createTimeLogEntry", () => {
	it("creates a time-log file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createTimeLogEntry(deps, "/project", {
			date: "2026-03-12", person: "Jane Doe", hours: 4, category: "development", task: "Feature X", description: "",
		});

		expect(result).toBe("/project/docs/timelog/2026-03-12-jane-doe.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/timelog", { recursive: true });
	});

	it("appends suffix for duplicate person/date", () => {
		mockDisk.existsSync
			.mockReturnValueOnce(true)   // first path exists
			.mockReturnValueOnce(false); // suffixed path does not exist

		const result = createTimeLogEntry(deps, "/project", {
			date: "2026-03-12", person: "Jane", hours: 2, category: "dev", task: "Task 2", description: "",
		});

		expect(result).toBe("/project/docs/timelog/2026-03-12-jane-1.md");
	});
});

describe("summarizeTimeLog", () => {
	it("returns zeroes for empty entries", () => {
		const result = summarizeTimeLog([]);

		expect(result.totalHours).toBe(0);
		expect(result.byPerson).toEqual({});
		expect(result.byCategory).toEqual({});
	});

	it("sums hours by person and category", () => {
		const entries = [
			{ date: "2026-03-12", person: "Jane", hours: 4, category: "dev", task: "A", description: "" },
			{ date: "2026-03-12", person: "Bob", hours: 3, category: "dev", task: "B", description: "" },
			{ date: "2026-03-11", person: "Jane", hours: 2, category: "review", task: "C", description: "" },
		];

		const result = summarizeTimeLog(entries);

		expect(result.totalHours).toBe(9);
		expect(result.byPerson).toEqual({ Jane: 6, Bob: 3 });
		expect(result.byCategory).toEqual({ dev: 7, review: 2 });
	});
});
