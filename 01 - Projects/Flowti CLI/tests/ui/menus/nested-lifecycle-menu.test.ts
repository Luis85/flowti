import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/domain/lifecycle/lifecycle-store.js", () => ({
	listLifecycleItems: vi.fn(() => []),
	createLifecycleFile: vi.fn(),
}));
vi.mock("../../../src/ui/displays/lifecycle-display.js", () => ({
	renderLifecycleList: vi.fn(),
	renderLifecycleCreated: vi.fn(),
}));
vi.mock("../../../src/ui/menus/lifecycle-menu.js", () => ({
	lifecycleStatusMenu: vi.fn(() => "main"),
}));

import { printHeader } from "../../../src/infrastructure/ui.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { listLifecycleItems, createLifecycleFile } from "../../../src/domain/lifecycle/lifecycle-store.js";
import { renderLifecycleList, renderLifecycleCreated } from "../../../src/ui/displays/lifecycle-display.js";
import { lifecycleStatusMenu } from "../../../src/ui/menus/lifecycle-menu.js";
import { nestedItemsMenu } from "../../../src/ui/menus/nested-lifecycle-menu.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";
import type { LifecycleSummary } from "../../../src/domain/lifecycle/lifecycle-types.js";

const mockRunMenu = vi.mocked(runMenu);
const mockListItems = vi.mocked(listLifecycleItems);
const mockCreateFile = vi.mocked(createLifecycleFile);
const mockRenderList = vi.mocked(renderLifecycleList);
const mockRenderCreated = vi.mocked(renderLifecycleCreated);
const mockLifecycleStatusMenu = vi.mocked(lifecycleStatusMenu);

const PROJECT_PATH = "/projects/my-project";

function makeDeps(overrides: Partial<MenuDeps> = {}): MenuDeps {
	return {
		disk: {} as any,
		paths: {
			join: (...args: string[]) => args.join("/"),
			relative: (from: string, to: string) => to.replace(from + "/", ""),
			resolve: (...args: string[]) => args.join("/"),
		} as any,
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

function makeSummary(overrides: Partial<LifecycleSummary> = {}): LifecycleSummary {
	return {
		name: "Auth Feature",
		entityType: "feature",
		currentState: "ideation",
		transitionCount: 0,
		createdDate: "2026-03-14",
		...overrides,
	};
}

beforeEach(() => {
	vi.clearAllMocks();
});

// ── nestedItemsMenu — structure ─────────────────────────────────────

describe("nestedItemsMenu", () => {
	it("builds menu with correct title for features", async () => {
		mockRunMenu.mockResolvedValue("main");

		await nestedItemsMenu(PROJECT_PATH, "feature", makeDeps());

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Features");
		// List + Create + Open + separator + back + quit = 6
		expect(items).toHaveLength(6);
		expect(items[0].label).toBe("List Features");
		expect(items[1].label).toBe("Create Feature");
		expect(items[2].label).toBe("Open Feature");
	});

	it("builds menu with correct title for products", async () => {
		mockRunMenu.mockResolvedValue("main");

		await nestedItemsMenu(PROJECT_PATH, "product", makeDeps());

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Products");
		expect(items[0].label).toBe("List Products");
		expect(items[1].label).toBe("Create Product");
		expect(items[2].label).toBe("Open Product");
	});

	it("back returns 'main'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await nestedItemsMenu(PROJECT_PATH, "feature", makeDeps());

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	it("quit returns 'quit'", async () => {
		mockRunMenu.mockResolvedValue("main");

		await nestedItemsMenu(PROJECT_PATH, "feature", makeDeps());

		const [, items] = mockRunMenu.mock.calls[0];
		const quit = items.find((i: any) => i.key === "q");
		expect(await (quit as any).action()).toBe("quit");
	});

	it("uses default subdir docs/features for features", async () => {
		const deps = makeDeps();
		mockRunMenu.mockResolvedValue(undefined);
		mockListItems.mockReturnValue([]);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockListItems).toHaveBeenCalledWith(deps, PROJECT_PATH, "docs/features");
	});

	it("uses default subdir docs/products for products", async () => {
		const deps = makeDeps();
		mockRunMenu.mockResolvedValue(undefined);
		mockListItems.mockReturnValue([]);

		await nestedItemsMenu(PROJECT_PATH, "product", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockListItems).toHaveBeenCalledWith(deps, PROJECT_PATH, "docs/products");
	});

	it("uses configDir when provided", async () => {
		const deps = makeDeps();
		mockRunMenu.mockResolvedValue(undefined);
		mockListItems.mockReturnValue([]);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps, "custom/dir");

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockListItems).toHaveBeenCalledWith(deps, PROJECT_PATH, "custom/dir");
	});
});

// ── List action ─────────────────────────────────────────────────────

describe("List action", () => {
	it("renders lifecycle list and waits for enter", async () => {
		const deps = makeDeps();
		const summaries = [makeSummary()];
		mockListItems.mockReturnValue(summaries);
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[0] as any).action();

		expect(mockRenderList).toHaveBeenCalledWith(summaries, deps.log);
		expect(deps.input.waitForEnter).toHaveBeenCalled();
		expect(result).toBe("main");
	});
});

// ── Create action ───────────────────────────────────────────────────

describe("Create action", () => {
	it("cancels when name is empty", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask).mockResolvedValueOnce("");
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(mockCreateFile).not.toHaveBeenCalled();
	});

	it("creates item on happy path with description", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Auth")         // name
			.mockResolvedValueOnce("Login flow");  // description
		mockCreateFile.mockReturnValue("/projects/my-project/docs/features/Auth/lifecycle.json" as any);
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(printHeader).toHaveBeenCalledWith("Create Feature");
		expect(mockCreateFile).toHaveBeenCalledWith(deps, PROJECT_PATH, "feature", "Auth", "Login flow", "docs/features");
		expect(mockRenderCreated).toHaveBeenCalled();
	});

	it("creates item with undefined description when empty", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Auth")  // name
			.mockResolvedValueOnce("");     // empty description
		mockCreateFile.mockReturnValue("/path/lifecycle.json" as any);
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(mockCreateFile).toHaveBeenCalledWith(deps, PROJECT_PATH, "feature", "Auth", undefined, "docs/features");
	});

	it("logs message when item already exists", async () => {
		const deps = makeDeps();
		vi.mocked(deps.input.ask)
			.mockResolvedValueOnce("Auth")
			.mockResolvedValueOnce("Desc");
		mockCreateFile.mockReturnValue(null as any);
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[1] as any).action();

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("already exists"));
		expect(mockRenderCreated).not.toHaveBeenCalled();
	});
});

// ── Open action ─────────────────────────────────────────────────────

describe("Open action", () => {
	it("logs message when no items exist", async () => {
		const deps = makeDeps();
		mockListItems.mockReturnValue([]);
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(deps.log).toHaveBeenCalledWith(expect.stringContaining("No features found"));
		expect(deps.input.waitForEnter).toHaveBeenCalled();
		expect(result).toBe("main");
	});

	it("returns 'main' on invalid selection", async () => {
		const deps = makeDeps();
		mockListItems.mockReturnValue([makeSummary()]);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("abc");
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(result).toBe("main");
		expect(mockLifecycleStatusMenu).not.toHaveBeenCalled();
	});

	it("opens lifecycle status menu for selected item", async () => {
		const deps = makeDeps();
		const summary = makeSummary({ name: "Auth Feature" });
		mockListItems.mockReturnValue([summary]);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("1");
		mockLifecycleStatusMenu.mockResolvedValue("main");
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(mockLifecycleStatusMenu).toHaveBeenCalledWith(PROJECT_PATH, "Auth Feature", "feature", deps, "docs/features");
		expect(result).toBe("main");
	});

	it("returns 'main' on out-of-range selection", async () => {
		const deps = makeDeps();
		mockListItems.mockReturnValue([makeSummary()]);
		vi.mocked(deps.input.ask).mockResolvedValueOnce("5");
		mockRunMenu.mockResolvedValue(undefined);

		await nestedItemsMenu(PROJECT_PATH, "feature", deps);

		const [, items] = mockRunMenu.mock.calls[0];
		const result = await (items[2] as any).action();

		expect(result).toBe("main");
		expect(mockLifecycleStatusMenu).not.toHaveBeenCalled();
	});
});
