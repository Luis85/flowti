import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	return {
		Document: {
			create: () => {
				const doc = {
					mergeFrontmatter: () => doc,
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

import {
	lifecycleDir,
	listLifecycleItems,
	readLifecycleItem,
	createLifecycleFile,
	transitionLifecycleItem,
	getLifecycleHistory,
} from "../../../src/domain/lifecycle/lifecycle-store.js";

const mockDisk = {
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(() => []),
	mkdirSync: vi.fn(),
	statSync: vi.fn(() => ({ isDirectory: () => true })),
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

describe("lifecycleDir", () => {
	it("returns basePath when no subdir", () => {
		expect(lifecycleDir(deps, "/project")).toBe("/project/.");
	});

	it("returns basePath + subdir", () => {
		expect(lifecycleDir(deps, "/project", "docs/features")).toBe("/project/docs/features");
	});
});

describe("listLifecycleItems", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(listLifecycleItems(deps, "/project", "docs/features")).toEqual([]);
	});

	it("lists items from subdirectories", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-auth"]);
		mockDisk.statSync.mockReturnValue({ isDirectory: () => true });
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: User Auth\nentityType: feature\ncurrentState: development\ntransitionCount: 2\ncreatedDate: 2026-01-01\n---\nBody",
		);

		const result = listLifecycleItems(deps, "/project", "docs/features");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("User Auth");
		expect(result[0].entityType).toBe("feature");
		expect(result[0].currentState).toBe("development");
		expect(result[0].transitionCount).toBe(2);
	});
});

describe("readLifecycleItem", () => {
	it("returns null when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(readLifecycleItem(deps, "/project", "User Auth", "docs/features")).toBeNull();
	});

	it("reads lifecycle record with history", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: User Auth\nentityType: feature\ncurrentState: development\ncreatedDate: 2026-01-01\nlastTransitionDate: 2026-01-02\n---\n\n# User Auth\n\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|\n| 2026-01-02 | specification | development | Spec approved |\n| 2026-01-01 | ideation | specification | Kickoff |\n",
		);

		const record = readLifecycleItem(deps, "/project", "User Auth", "docs/features");

		expect(record).not.toBeNull();
		expect(record!.name).toBe("User Auth");
		expect(record!.currentState).toBe("development");
		expect(record!.history).toHaveLength(2);
		expect(record!.history[0].from).toBe("specification");
		expect(record!.history[0].to).toBe("development");
	});
});

describe("createLifecycleFile", () => {
	it("returns null if lifecycle file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createLifecycleFile(deps, "/project", "feature", "User Auth", undefined, "docs/features");

		expect(result).toBeNull();
	});

	it("creates lifecycle file with initial state", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createLifecycleFile(deps, "/project", "feature", "User Auth", "Auth feature", "docs/features");

		expect(result).toBe("/project/docs/features/user-auth/lifecycle.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/features/user-auth", { recursive: true });
	});

	it("uses correct initial state per entity type", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const productResult = createLifecycleFile(deps, "/vault", "product", "Platform");
		expect(productResult).toBe("/vault/./platform/lifecycle.md");
	});
});

describe("transitionLifecycleItem", () => {
	it("returns error when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = transitionLifecycleItem(deps, "/project", "User Auth", "specification" as any, "Ready", "docs/features");

		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	it("validates and performs valid transition", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: User Auth\nentityType: feature\ncurrentState: ideation\ntransitionCount: 0\nlastTransitionDate: \n---\n\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|\n",
		);

		const result = transitionLifecycleItem(deps, "/project", "User Auth", "specification" as any, "Spec ready", "docs/features");

		expect(result.success).toBe(true);
		expect(result.from).toBe("ideation");
		expect(result.to).toBe("specification");
		expect(mockDisk.writeFileSync).toHaveBeenCalled();

		const written = mockDisk.writeFileSync.mock.calls[0][1] as string;
		expect(written).toContain("currentState: specification");
		expect(written).toContain("transitionCount: 1");
		expect(written).toContain("| ideation | specification | Spec ready |");
	});

	it("rejects invalid transition", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: User Auth\nentityType: feature\ncurrentState: ideation\ntransitionCount: 0\n---\n",
		);

		const result = transitionLifecycleItem(deps, "/project", "User Auth", "release" as any, "Skip", "docs/features");

		expect(result.success).toBe(false);
		expect(result.error).toContain("Cannot transition");
		expect(mockDisk.writeFileSync).not.toHaveBeenCalled();
	});
});

describe("getLifecycleHistory", () => {
	it("returns empty array when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(getLifecycleHistory(deps, "/project", "User Auth", "docs/features")).toEqual([]);
	});

	it("parses history from markdown table", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue(
			"---\nname: Test\n---\n\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|\n| 2026-01-02 | ideation | specification | Done |\n",
		);

		const history = getLifecycleHistory(deps, "/project", "Test", "docs/features");

		expect(history).toHaveLength(1);
		expect(history[0].from).toBe("ideation");
		expect(history[0].to).toBe("specification");
		expect(history[0].reason).toBe("Done");
	});
});
