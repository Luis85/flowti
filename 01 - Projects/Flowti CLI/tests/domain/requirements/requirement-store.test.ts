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

import {
	requirementStore, useCaseStore, userStoryStore,
	createRequirement, createUseCase, createUserStory, nextId,
} from "../../../src/domain/requirements/requirement-store.js";

const REQ_DEFAULT_DIR = "docs/requirements";

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

describe("requirementStore.resolveDir", () => {
	it("returns default directory", () => {
		expect(requirementStore.resolveDir(deps, "/project")).toBe("/project/docs/requirements");
	});

	it("respects config dir", () => {
		expect(requirementStore.resolveDir(deps, "/project", { dir: "specs" })).toBe("/project/specs");
	});
});

describe("nextId", () => {
	it("returns 001 when no existing IDs", () => {
		expect(nextId("REQ", [])).toBe("REQ-001");
	});

	it("increments from highest existing ID", () => {
		expect(nextId("REQ", ["REQ-001", "REQ-003", "REQ-002"])).toBe("REQ-004");
	});

	it("ignores non-matching IDs", () => {
		expect(nextId("UC", ["REQ-001", "UC-005"])).toBe("UC-006");
	});
});

describe("requirementStore.list", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(requirementStore.list(deps, "/project")).toEqual([]);
	});

	it("parses requirements from directory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-auth.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\ntype: Requirement\nname: User Auth\nid: REQ-001\nrequirementType: functional\nstatus: approved\npriority: must\n---\nDescription",
		);

		const result = requirementStore.list(deps, "/project");

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("User Auth");
		expect(result[0].id).toBe("REQ-001");
		expect(result[0].requirementType).toBe("functional");
		expect(result[0].priority).toBe("must");
	});

	it("skips non-Requirement type files", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["readme.md"]);
		mockDisk.readFileSync.mockReturnValue("---\ntype: Other\nname: Readme\n---");

		const result = requirementStore.list(deps, "/project");
		expect(result).toHaveLength(0);
	});
});

describe("createRequirement", () => {
	it("returns null if file already exists", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = createRequirement(deps, "/project", {
			name: "Test", requirementType: "functional", id: "REQ-001",
			status: "draft", priority: "should", description: "",
		});

		expect(result).toBeNull();
	});

	it("creates a requirement file", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createRequirement(deps, "/project", {
			name: "User Auth", requirementType: "functional", id: "REQ-001",
			status: "draft", priority: "must", source: "Workshop",
			rationale: "Legal requirement", description: "Auth system",
		});

		expect(result).toBe("/project/docs/requirements/user-auth.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/requirements", { recursive: true });
	});
});

describe("requirementStore.updateField (status)", () => {
	it("returns false when file does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(requirementStore.updateField(deps, "/project", "Test", "status", "approved")).toBe(false);
	});

	it("updates status in file content", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readFileSync.mockReturnValue("---\nstatus: draft\npriority: must\n---\nBody");

		const result = requirementStore.updateField(deps, "/project", "Test", "status", "approved");

		expect(result).toBe(true);
		expect(mockDisk.writeFileSync).toHaveBeenCalledWith(
			"/project/docs/requirements/test.md",
			"---\nstatus: approved\npriority: must\n---\nBody",
			"utf-8",
		);
	});
});

describe("useCaseStore.list", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(useCaseStore.list(deps, "/project", { dir: `${REQ_DEFAULT_DIR}/use-cases` })).toEqual([]);
	});

	it("parses use cases from subdirectory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["user-login.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\ntype: UseCase\nname: User Login\nid: UC-001\nactor: End User\n---\nFlow",
		);

		const result = useCaseStore.list(deps, "/project", { dir: `${REQ_DEFAULT_DIR}/use-cases` });

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("User Login");
		expect(result[0].id).toBe("UC-001");
		expect(result[0].actor).toBe("End User");
	});
});

describe("createUseCase", () => {
	it("creates a use case file in use-cases subdir", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createUseCase(deps, "/project", {
			name: "User Login", id: "UC-001", actor: "End User", description: "Login flow",
		});

		expect(result).toBe("/project/docs/requirements/use-cases/user-login.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/requirements/use-cases", { recursive: true });
	});
});

describe("userStoryStore.list", () => {
	it("returns empty array when directory does not exist", () => {
		mockDisk.existsSync.mockReturnValue(false);
		expect(userStoryStore.list(deps, "/project", { dir: `${REQ_DEFAULT_DIR}/user-stories` })).toEqual([]);
	});

	it("parses user stories from subdirectory", () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["login-story.md"]);
		mockDisk.readFileSync.mockReturnValue(
			"---\ntype: UserStory\nname: Login Story\nid: US-001\nrole: User\nstatus: backlog\nstoryPoints: 5\n---\nCriteria",
		);

		const result = userStoryStore.list(deps, "/project", { dir: `${REQ_DEFAULT_DIR}/user-stories` });

		expect(result).toHaveLength(1);
		expect(result[0].name).toBe("Login Story");
		expect(result[0].id).toBe("US-001");
		expect(result[0].storyPoints).toBe(5);
	});
});

describe("createUserStory", () => {
	it("creates a user story file in user-stories subdir", () => {
		mockDisk.existsSync.mockReturnValue(false);

		const result = createUserStory(deps, "/project", {
			name: "Login Story", id: "US-001", role: "User",
			goal: "log in", benefit: "access dashboard",
			storyPoints: 5, status: "backlog", description: "Given... When... Then...",
		});

		expect(result).toBe("/project/docs/requirements/user-stories/login-story.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/requirements/user-stories", { recursive: true });
	});
});
