import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/requirements/requirement-store.js", () => ({
	listRequirements: vi.fn(() => []),
	createRequirement: vi.fn(),
	updateRequirementStatus: vi.fn(),
	nextId: vi.fn(() => "REQ-001"),
	listUseCases: vi.fn(() => []),
	createUseCase: vi.fn(),
	listUserStories: vi.fn(() => []),
	createUserStory: vi.fn(),
}));
vi.mock("../../../src/ui/displays/requirements-display.js", () => ({
	renderRequirementList: vi.fn(),
	renderRequirementAdded: vi.fn(),
	renderRequirementUpdated: vi.fn(),
}));

import { printHeader } from "../../../src/infrastructure/ui.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import {
	listRequirements, createRequirement, updateRequirementStatus, nextId,
	listUseCases, createUseCase,
	listUserStories, createUserStory,
} from "../../../src/domain/requirements/requirement-store.js";
import {
	renderRequirementList,
	renderRequirementAdded,
	renderRequirementUpdated,
} from "../../../src/ui/displays/requirements-display.js";
import {
	addRequirementInteractive,
	addUseCaseInteractive,
	addUserStoryInteractive,
	updateStatusInteractive,
	requirementsMenu,
} from "../../../src/ui/menus/requirements-menu.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";
import type { RequirementsConfig } from "../../../src/infrastructure/types.js";

const mockRunMenu = vi.mocked(runMenu);
const mockListRequirements = vi.mocked(listRequirements);
const mockCreateRequirement = vi.mocked(createRequirement);
const mockUpdateRequirementStatus = vi.mocked(updateRequirementStatus);
const mockNextId = vi.mocked(nextId);
const mockListUseCases = vi.mocked(listUseCases);
const mockCreateUseCase = vi.mocked(createUseCase);
const mockListUserStories = vi.mocked(listUserStories);
const mockCreateUserStory = vi.mocked(createUserStory);
const mockRenderRequirementList = vi.mocked(renderRequirementList);
const mockRenderRequirementAdded = vi.mocked(renderRequirementAdded);
const mockRenderRequirementUpdated = vi.mocked(renderRequirementUpdated);
const mockPrintHeader = vi.mocked(printHeader);

const mockInput = {
	ask: vi.fn(),
	confirm: vi.fn(),
	select: vi.fn(),
	waitForEnter: vi.fn(),
};

const mockDeps: MenuDeps = {
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => ""),
		readdirSync: vi.fn(() => []),
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
	} as any,
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
		resolve: (...args: string[]) => args.join("/"),
	} as any,
	clock: { now: () => Date.now(), ms: () => Date.now(), iso: () => "2026-03-14T00:00:00Z", safeIso: () => "2026-03-14" } as any,
	input: mockInput as any,
	log: vi.fn(),
};

const PROJECT_PATH = "/projects/test-project";
const CONFIG: RequirementsConfig = { directory: "requirements" } as any;

beforeEach(() => {
	vi.clearAllMocks();
	mockNextId.mockReturnValue("REQ-001");
});

// ── addRequirementInteractive ────────────────────────────────────────

describe("addRequirementInteractive", () => {
	it("creates a functional requirement on happy path", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Login validation")   // name
			.mockResolvedValueOnce("REQ-001")             // id
			.mockResolvedValueOnce("must")                // priority
			.mockResolvedValueOnce("security")            // category
			.mockResolvedValueOnce("Product owner")       // source
			.mockResolvedValueOnce("Needed for auth")     // rationale
			.mockResolvedValueOnce("Validate user input");// description
		mockCreateRequirement.mockReturnValue("/projects/test-project/requirements/REQ-001.md");

		await addRequirementInteractive("functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Add Functional Requirement");
		expect(mockCreateRequirement).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({
				name: "Login validation",
				requirementType: "functional",
				id: "REQ-001",
				status: "draft",
				priority: "must",
				category: "security",
				source: "Product owner",
				rationale: "Needed for auth",
				description: "Validate user input",
			}),
			CONFIG,
		);
		expect(mockRenderRequirementAdded).toHaveBeenCalled();
	});

	it("prints correct header for non-functional type", async () => {
		mockInput.ask.mockResolvedValueOnce(""); // empty name → cancel

		await addRequirementInteractive("non-functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Add Non-Functional Requirement");
	});

	it("prints correct header for constraint type", async () => {
		mockInput.ask.mockResolvedValueOnce(""); // empty name → cancel

		await addRequirementInteractive("constraint", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Add Constraint");
	});

	it("returns early when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await addRequirementInteractive("functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateRequirement).not.toHaveBeenCalled();
	});

	it("suggests next id from existing requirements", async () => {
		mockListRequirements.mockReturnValue([{ id: "REQ-001", name: "Existing", status: "draft", priority: "should", requirementType: "functional" }] as any);
		mockNextId.mockReturnValue("REQ-002");
		mockInput.ask
			.mockResolvedValueOnce("New Req")
			.mockResolvedValueOnce("REQ-002")
			.mockResolvedValueOnce("should")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockCreateRequirement.mockReturnValue("/projects/test-project/requirements/REQ-002.md");

		await addRequirementInteractive("functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockNextId).toHaveBeenCalledWith("REQ", ["REQ-001"]);
		expect(mockInput.ask).toHaveBeenCalledWith("ID", "REQ-002");
	});

	it("does not render when createRequirement returns falsy", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Req")
			.mockResolvedValueOnce("REQ-001")
			.mockResolvedValueOnce("should")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockCreateRequirement.mockReturnValue(undefined as any);

		await addRequirementInteractive("functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockRenderRequirementAdded).not.toHaveBeenCalled();
	});

	it("passes undefined for empty optional fields", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Req")
			.mockResolvedValueOnce("REQ-001")
			.mockResolvedValueOnce("should")
			.mockResolvedValueOnce("")   // category → empty
			.mockResolvedValueOnce("")   // source → empty
			.mockResolvedValueOnce("")   // rationale → empty
			.mockResolvedValueOnce("desc");
		mockCreateRequirement.mockReturnValue("/path/to/file.md");

		await addRequirementInteractive("functional", PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateRequirement).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({
				category: undefined,
				source: undefined,
				rationale: undefined,
			}),
			CONFIG,
		);
	});
});

// ── addUseCaseInteractive ────────────────────────────────────────────

describe("addUseCaseInteractive", () => {
	it("creates a use case on happy path", async () => {
		mockNextId.mockReturnValue("UC-001");
		mockInput.ask
			.mockResolvedValueOnce("Place Order")     // name
			.mockResolvedValueOnce("UC-001")           // id
			.mockResolvedValueOnce("Customer")         // actor
			.mockResolvedValueOnce("Submit order")     // description
			.mockResolvedValueOnce("REQ-001, REQ-002");// linked reqs
		mockCreateUseCase.mockReturnValue("/projects/test-project/requirements/UC-001.md");

		await addUseCaseInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Add Use Case");
		expect(mockCreateUseCase).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({
				name: "Place Order",
				id: "UC-001",
				actor: "Customer",
				description: "Submit order",
				linkedRequirements: ["REQ-001", "REQ-002"],
			}),
			CONFIG,
		);
		expect(mockRenderRequirementAdded).toHaveBeenCalled();
	});

	it("returns early when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await addUseCaseInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUseCase).not.toHaveBeenCalled();
	});

	it("returns early when actor is empty", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Place Order")
			.mockResolvedValueOnce("UC-001")
			.mockResolvedValueOnce("");  // empty actor

		await addUseCaseInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUseCase).not.toHaveBeenCalled();
	});

	it("passes undefined linkedRequirements when empty", async () => {
		mockNextId.mockReturnValue("UC-001");
		mockInput.ask
			.mockResolvedValueOnce("Place Order")
			.mockResolvedValueOnce("UC-001")
			.mockResolvedValueOnce("Customer")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce(""); // empty linked reqs
		mockCreateUseCase.mockReturnValue("/path/to/uc.md");

		await addUseCaseInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUseCase).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({ linkedRequirements: undefined }),
			CONFIG,
		);
	});

	it("does not render when createUseCase returns falsy", async () => {
		mockNextId.mockReturnValue("UC-001");
		mockInput.ask
			.mockResolvedValueOnce("UC Name")
			.mockResolvedValueOnce("UC-001")
			.mockResolvedValueOnce("Actor")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockCreateUseCase.mockReturnValue(undefined as any);

		await addUseCaseInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockRenderRequirementAdded).not.toHaveBeenCalled();
	});
});

// ── addUserStoryInteractive ──────────────────────────────────────────

describe("addUserStoryInteractive", () => {
	it("creates a user story on happy path", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Login story")      // name
			.mockResolvedValueOnce("US-001")            // id
			.mockResolvedValueOnce("user")              // role
			.mockResolvedValueOnce("log in")            // goal
			.mockResolvedValueOnce("access dashboard")  // benefit
			.mockResolvedValueOnce("3")                 // story points
			.mockResolvedValueOnce("REQ-001")           // linked reqs
			.mockResolvedValueOnce("Given I am on login page"); // description
		mockCreateUserStory.mockReturnValue("/projects/test-project/requirements/US-001.md");

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockPrintHeader).toHaveBeenCalledWith("Add User Story");
		expect(mockCreateUserStory).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({
				name: "Login story",
				id: "US-001",
				role: "user",
				goal: "log in",
				benefit: "access dashboard",
				storyPoints: 3,
				status: "backlog",
				linkedRequirements: ["REQ-001"],
				description: "Given I am on login page",
			}),
			CONFIG,
		);
		expect(mockRenderRequirementAdded).toHaveBeenCalled();
	});

	it("returns early when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUserStory).not.toHaveBeenCalled();
	});

	it("returns early when role is empty", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Story")
			.mockResolvedValueOnce("US-001")
			.mockResolvedValueOnce(""); // empty role

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUserStory).not.toHaveBeenCalled();
	});

	it("returns early when goal is empty", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Story")
			.mockResolvedValueOnce("US-001")
			.mockResolvedValueOnce("user")
			.mockResolvedValueOnce(""); // empty goal

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUserStory).not.toHaveBeenCalled();
	});

	it("returns early when benefit is empty", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Story")
			.mockResolvedValueOnce("US-001")
			.mockResolvedValueOnce("user")
			.mockResolvedValueOnce("goal")
			.mockResolvedValueOnce(""); // empty benefit

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUserStory).not.toHaveBeenCalled();
	});

	it("handles NaN story points as undefined", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Story")
			.mockResolvedValueOnce("US-001")
			.mockResolvedValueOnce("user")
			.mockResolvedValueOnce("goal")
			.mockResolvedValueOnce("benefit")
			.mockResolvedValueOnce("abc")  // non-numeric story points
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockCreateUserStory.mockReturnValue("/path/to/us.md");

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockCreateUserStory).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH,
			expect.objectContaining({ storyPoints: undefined }),
			CONFIG,
		);
	});

	it("does not render when createUserStory returns falsy", async () => {
		mockNextId.mockReturnValue("US-001");
		mockInput.ask
			.mockResolvedValueOnce("Story")
			.mockResolvedValueOnce("US-001")
			.mockResolvedValueOnce("user")
			.mockResolvedValueOnce("goal")
			.mockResolvedValueOnce("benefit")
			.mockResolvedValueOnce("0")
			.mockResolvedValueOnce("")
			.mockResolvedValueOnce("");
		mockCreateUserStory.mockReturnValue(undefined as any);

		await addUserStoryInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockRenderRequirementAdded).not.toHaveBeenCalled();
	});
});

// ── updateStatusInteractive ──────────────────────────────────────────

describe("updateStatusInteractive", () => {
	it("updates status on happy path", async () => {
		const reqs = [
			{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" },
		] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask
			.mockResolvedValueOnce("1")          // select requirement
			.mockResolvedValueOnce("approved");   // new status
		mockUpdateRequirementStatus.mockReturnValue(true);

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("REQ-001"));
		expect(mockUpdateRequirementStatus).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH, "Login", "approved", CONFIG,
		);
		expect(mockRenderRequirementUpdated).toHaveBeenCalledWith("Login", "approved", mockDeps.log);
	});

	it("logs message and returns when no requirements exist", async () => {
		mockListRequirements.mockReturnValue([]);

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("No requirements to update"));
		expect(mockInput.ask).not.toHaveBeenCalled();
	});

	it("returns early for invalid selection (NaN)", async () => {
		const reqs = [{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" }] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask.mockResolvedValueOnce("abc");

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockUpdateRequirementStatus).not.toHaveBeenCalled();
	});

	it("returns early for out-of-range selection", async () => {
		const reqs = [{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" }] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask.mockResolvedValueOnce("5");

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockUpdateRequirementStatus).not.toHaveBeenCalled();
	});

	it("returns early for invalid status", async () => {
		const reqs = [{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" }] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("invalid-status");

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockUpdateRequirementStatus).not.toHaveBeenCalled();
	});

	it("does not render when updateRequirementStatus returns falsy", async () => {
		const reqs = [{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" }] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("approved");
		mockUpdateRequirementStatus.mockReturnValue(false);

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockRenderRequirementUpdated).not.toHaveBeenCalled();
	});

	it("lists multiple requirements with index", async () => {
		const reqs = [
			{ id: "REQ-001", name: "Login", status: "draft", priority: "must", requirementType: "functional" },
			{ id: "REQ-002", name: "Logout", status: "approved", priority: "should", requirementType: "functional" },
		] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockInput.ask
			.mockResolvedValueOnce("2")
			.mockResolvedValueOnce("implemented");
		mockUpdateRequirementStatus.mockReturnValue(true);

		await updateStatusInteractive(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("1."));
		expect(mockDeps.log).toHaveBeenCalledWith(expect.stringContaining("2."));
		expect(mockUpdateRequirementStatus).toHaveBeenCalledWith(
			mockDeps, PROJECT_PATH, "Logout", "implemented", CONFIG,
		);
	});
});

// ── requirementsMenu ────────────────────────────────────────────────

describe("requirementsMenu", () => {
	it("calls runMenu with correct title and 9 items", async () => {
		mockRunMenu.mockResolvedValue("main");

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Requirements");
		// 7 actions + separator + back + quit = 10
		expect(items).toHaveLength(10);
	});

	it("has correct menu item labels", async () => {
		mockRunMenu.mockResolvedValue("main");

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0]).toMatchObject({ key: "1", label: "List Requirements" });
		expect(items[1]).toMatchObject({ key: "2", label: "Add Functional Requirement" });
		expect(items[2]).toMatchObject({ key: "3", label: "Add Non-Functional Requirement" });
		expect(items[3]).toMatchObject({ key: "4", label: "Add Constraint" });
		expect(items[4]).toMatchObject({ key: "5", label: "Add Use Case" });
		expect(items[5]).toMatchObject({ key: "6", label: "Add User Story" });
		expect(items[6]).toMatchObject({ key: "7", label: "Update Requirement Status" });
		expect(items[7]).toMatchObject({ separator: true });
		expect(items[8]).toMatchObject({ key: "b", label: "Back" });
		expect(items[9]).toMatchObject({ key: "q", label: "Quit" });
	});

	it("back action returns 'main'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	it("quit action returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const quit = items.find((i: any) => i.key === "q");
		expect(await (quit as any).action()).toBe("quit");
	});

	it("list action calls renderRequirementList and returns 'main'", async () => {
		const reqs = [{ id: "REQ-001", name: "Test", status: "draft" }] as any;
		mockListRequirements.mockReturnValue(reqs);
		mockRunMenu.mockResolvedValue(undefined);

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[0] as any).action();

		expect(result).toBe("main");
		expect(mockRenderRequirementList).toHaveBeenCalledWith(reqs, mockDeps.log);
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("add functional action calls addRequirementInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValue(""); // cancel on name

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[1] as any).action();

		expect(result).toBe("main");
		expect(mockPrintHeader).toHaveBeenCalledWith("Add Functional Requirement");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("add non-functional action calls addRequirementInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValue(""); // cancel on name

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(result).toBe("main");
		expect(mockPrintHeader).toHaveBeenCalledWith("Add Non-Functional Requirement");
	});

	it("add constraint action calls addRequirementInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValue(""); // cancel on name

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[3] as any).action();

		expect(result).toBe("main");
		expect(mockPrintHeader).toHaveBeenCalledWith("Add Constraint");
	});

	it("add use case action calls addUseCaseInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValue(""); // cancel on name

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[4] as any).action();

		expect(result).toBe("main");
		expect(mockPrintHeader).toHaveBeenCalledWith("Add Use Case");
	});

	it("add user story action calls addUserStoryInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValue(""); // cancel on name

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[5] as any).action();

		expect(result).toBe("main");
		expect(mockPrintHeader).toHaveBeenCalledWith("Add User Story");
	});

	it("update status action calls updateStatusInteractive and returns 'main'", async () => {
		mockRunMenu.mockResolvedValue(undefined);
		mockListRequirements.mockReturnValue([]); // no reqs → early return

		await requirementsMenu(PROJECT_PATH, CONFIG, mockDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[6] as any).action();

		expect(result).toBe("main");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});
});
