import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/lifecycle/lifecycle-store.js", () => ({
	readLifecycleItem: vi.fn(),
	transitionLifecycleItem: vi.fn(),
	getLifecycleHistory: vi.fn(() => []),
}));
vi.mock("../../../src/domain/lifecycle/lifecycle-engine.js", () => ({
	getTemplate: vi.fn(() => ({ transitions: {} })),
	getValidTransitions: vi.fn(() => []),
}));
vi.mock("../../../src/ui/displays/lifecycle-display.js", () => ({
	renderLifecycleStatus: vi.fn(),
	renderTransitionHistory: vi.fn(),
	renderTransitionResult: vi.fn(),
}));

import { runMenu } from "../../../src/infrastructure/menu.js";
import { readLifecycleItem, transitionLifecycleItem, getLifecycleHistory } from "../../../src/domain/lifecycle/lifecycle-store.js";
import { getTemplate, getValidTransitions } from "../../../src/domain/lifecycle/lifecycle-engine.js";
import { renderLifecycleStatus, renderTransitionHistory, renderTransitionResult } from "../../../src/ui/displays/lifecycle-display.js";
import { lifecycleStatusMenu } from "../../../src/ui/menus/lifecycle-menu.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";
import type { LifecycleRecord } from "../../../src/domain/lifecycle/lifecycle-types.js";

const mockRunMenu = vi.mocked(runMenu);
const mockReadItem = vi.mocked(readLifecycleItem);
const mockTransitionItem = vi.mocked(transitionLifecycleItem);
const mockGetHistory = vi.mocked(getLifecycleHistory);
const mockGetTemplate = vi.mocked(getTemplate);
const mockGetValidTransitions = vi.mocked(getValidTransitions);
const mockRenderStatus = vi.mocked(renderLifecycleStatus);
const mockRenderHistory = vi.mocked(renderTransitionHistory);
const mockRenderResult = vi.mocked(renderTransitionResult);

const BASE_PATH = "/projects/my-project";
const NAME = "My Feature";

function makeDeps(overrides: Partial<MenuDeps> = {}): MenuDeps {
	return {
		disk: {} as any,
		paths: { join: (...args: string[]) => args.join("/"), relative: (f: string, t: string) => t.replace(f + "/", ""), resolve: (...args: string[]) => args.join("/") } as any,
		clock: { now: () => 0, ms: () => 0, iso: () => "2026-03-14T00:00:00.000Z", safeIso: () => "2026-03-14T000000" },
		input: {
			ask: vi.fn(),
			askYesNo: vi.fn(),
			waitForEnter: vi.fn(),
			select: vi.fn(),
		},
		log: vi.fn(),
		...overrides,
	} as any;
}

function makeRecord(overrides: Partial<LifecycleRecord> = {}): LifecycleRecord {
	return {
		name: NAME,
		entityType: "feature",
		currentState: "ideation",
		history: [],
		createdDate: "2026-03-14",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── lifecycleStatusMenu ─────────────────────────────────────────────

describe("lifecycleStatusMenu", () => {
	it("builds menu with correct title and items", async () => {
		mockRunMenu.mockResolvedValue("main");

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", makeDeps());

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Lifecycle");
		// 3 actions + separator + back + quit = 6
		expect(items).toHaveLength(6);
		expect(items[0].label).toBe("View Current State");
		expect(items[1].label).toBe("Transition State");
		expect(items[2].label).toBe("View History");
	});

	it("back returns 'main'", async () => {
		mockRunMenu.mockResolvedValue("main");
		const deps = makeDeps();

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	it("quit returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue("main");
		const deps = makeDeps();

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const quit = items.find((i: any) => i.key === "q");
		expect(await (quit as any).action()).toBe("quit");
	});
});

// ── View Current State action ───────────────────────────────────────

describe("View Current State action", () => {
	it("renders status when lifecycle record exists", async () => {
		const deps = makeDeps();
		const record = makeRecord();
		mockReadItem.mockReturnValue(record);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[0] as any).action();

		expect(mockReadItem).toHaveBeenCalledWith(deps, BASE_PATH, NAME, undefined);
		expect(mockRenderStatus).toHaveBeenCalledWith(record, deps.log);
		expect(deps.input.waitForEnter).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("logs message when lifecycle not initialized", async () => {
		const deps = makeDeps();
		mockReadItem.mockReturnValue(null);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
		expect(mockRenderStatus).not.toHaveBeenCalled();
	});

	it("passes subdir to readLifecycleItem", async () => {
		const deps = makeDeps();
		mockReadItem.mockReturnValue(makeRecord());
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps, "docs/features");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockReadItem).toHaveBeenCalledWith(deps, BASE_PATH, NAME, "docs/features");
	});
});

// ── Transition State action ─────────────────────────────────────────

describe("Transition State action", () => {
	it("logs message when lifecycle not initialized", async () => {
		const deps = makeDeps();
		mockReadItem.mockReturnValue(null);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("not initialized"));
		expect(mockTransitionItem).not.toHaveBeenCalled();
	});

	it("logs terminal state when no valid transitions", async () => {
		const deps = makeDeps();
		const record = makeRecord({ currentState: "deprecated" });
		mockReadItem.mockReturnValue(record);
		mockGetTemplate.mockReturnValue({ transitions: {} } as any);
		mockGetValidTransitions.mockReturnValue([]);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("terminal state"));
		expect(mockTransitionItem).not.toHaveBeenCalled();
	});

	it("does nothing on invalid choice", async () => {
		const deps = makeDeps();
		const record = makeRecord();
		mockReadItem.mockReturnValue(record);
		mockGetTemplate.mockReturnValue({ transitions: {} } as any);
		mockGetValidTransitions.mockReturnValue(["specification"]);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("abc");
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(mockTransitionItem).not.toHaveBeenCalled();
	});

	it("does nothing when reason is empty", async () => {
		const deps = makeDeps();
		const record = makeRecord();
		mockReadItem.mockReturnValue(record);
		mockGetTemplate.mockReturnValue({ transitions: {} } as any);
		mockGetValidTransitions.mockReturnValue(["specification"]);
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("1")   // choice
			.mockResolvedValueOnce("");   // reason empty
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(mockTransitionItem).not.toHaveBeenCalled();
	});

	it("transitions on happy path", async () => {
		const deps = makeDeps();
		const record = makeRecord();
		mockReadItem.mockReturnValue(record);
		mockGetTemplate.mockReturnValue({ transitions: {} } as any);
		mockGetValidTransitions.mockReturnValue(["specification", "development"]);
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("2")            // choose "development"
			.mockResolvedValueOnce("Ready to dev"); // reason
		const transResult = { success: true, from: "ideation", to: "development" };
		mockTransitionItem.mockReturnValue(transResult as any);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[1] as any).action();

		expect(mockTransitionItem).toHaveBeenCalledWith(deps, BASE_PATH, NAME, "development", "Ready to dev", undefined);
		expect(mockRenderResult).toHaveBeenCalledWith(transResult, deps.log);
		expect(deps.input.waitForEnter).toHaveBeenCalled();
		expect(result).toBe("main");
	});
});

// ── View History action ─────────────────────────────────────────────

describe("View History action", () => {
	it("renders transition history", async () => {
		const deps = makeDeps();
		const history = [{ date: "2026-03-14", from: "ideation", to: "specification", reason: "Ready" }];
		mockGetHistory.mockReturnValue(history as any);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(mockGetHistory).toHaveBeenCalledWith(deps, BASE_PATH, NAME, undefined);
		expect(mockRenderHistory).toHaveBeenCalledWith(history, deps.log);
		expect(deps.input.waitForEnter).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("passes subdir to getLifecycleHistory", async () => {
		const deps = makeDeps();
		mockGetHistory.mockReturnValue([]);
		mockRunMenu.mockResolvedValue(undefined);

		await lifecycleStatusMenu(BASE_PATH, NAME, "feature", deps, "docs/features");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[2] as any).action();

		expect(mockGetHistory).toHaveBeenCalledWith(deps, BASE_PATH, NAME, "docs/features");
	});
});
