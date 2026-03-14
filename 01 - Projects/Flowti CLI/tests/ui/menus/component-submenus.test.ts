import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", YELLOW: "", CYAN: "", RED: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), waitForEnter: vi.fn(), askYesNo: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), writeFileSync: vi.fn(), mkdirSync: vi.fn(), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		sep: "/",
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));
vi.mock("../../../src/domain/make/component/component-library.js", () => ({
	discoverLibraries: vi.fn(() => []),
	importAllLibraryDefinitions: vi.fn(() => ({ total: 0, errors: [] })),
	importLibraryDefinition: vi.fn(() => ({ name: "test", filesWritten: 3, errors: [] })),
}));
vi.mock("../../../src/domain/make/component/data-provider.js", () => ({
	listDataProviders: vi.fn(() => []),
	createDataProvider: vi.fn(),
	regenerateDataDictionary: vi.fn(),
	readDataProvider: vi.fn(),
	inferSchema: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { discoverLibraries, importAllLibraryDefinitions, importLibraryDefinition } from "../../../src/domain/make/component/component-library.js";
import { listDataProviders, createDataProvider, regenerateDataDictionary, readDataProvider, inferSchema } from "../../../src/domain/make/component/data-provider.js";
import { libraryMenu, dataProviderMenu, dataProviderDetailMenu } from "../../../src/ui/menus/component-submenus.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";

const testDeps: MenuDeps = { disk, paths, clock, input, log };

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockDisk = vi.mocked(disk);
const mockDiscoverLibraries = vi.mocked(discoverLibraries);
const mockImportAll = vi.mocked(importAllLibraryDefinitions);
const mockImportDef = vi.mocked(importLibraryDefinition);
const mockListProviders = vi.mocked(listDataProviders);
const mockCreateProvider = vi.mocked(createDataProvider);
const mockRegenDict = vi.mocked(regenerateDataDictionary);
const mockReadProvider = vi.mocked(readDataProvider);
const mockInferSchema = vi.mocked(inferSchema);

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRunMenu.mockResolvedValue("main");
});

// ── libraryMenu ─────────────────────────────────────────────────────

describe("libraryMenu", () => {
	const LIB = {
		name: "my-lib",
		path: "/project/components/.libraries/my-lib",
		definitions: ["button.json", "card.json"],
	};

	it("shows not-found message when library does not exist", async () => {
		mockDiscoverLibraries.mockReturnValue([]);

		await libraryMenu("/project", "missing-lib", testDeps);

		expect(output()).toContain("not found");
	});

	it("displays library name and definition count", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);

		await libraryMenu("/project", "my-lib", testDeps);

		expect(output()).toContain("my-lib");
		expect(output()).toContain("2 definition(s)");
	});

	it("builds menu items from definitions", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);

		await libraryMenu("/project", "my-lib", testDeps);

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toContain("my-lib");
		// 2 definitions + sep + Import All + sep + Back = 6
		expect(items.length).toBe(6);
	});

	it("shows imported status when markdown file exists", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(true);

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("imported");
	});

	it("shows pending status when markdown file missing", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("pending");
	});

	it("definition action calls importLibraryDefinition and shows success", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);
		mockImportDef.mockReturnValue({ name: "button", filesWritten: 3, errors: [] } as any);
		mockInput.waitForEnter.mockResolvedValue();

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockImportDef).toHaveBeenCalledWith("/project", "my-lib", "button.json", testDeps);
		expect(output()).toContain("Imported button");
		expect(output()).toContain("3 file(s)");
	});

	it("definition action shows errors when import fails", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);
		mockImportDef.mockReturnValue({ name: "button", filesWritten: 0, errors: ["Missing schema"] } as any);
		mockInput.waitForEnter.mockResolvedValue();

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(output()).toContain("Missing schema");
	});

	it("Import All action calls importAllLibraryDefinitions", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);
		mockImportAll.mockReturnValue({ total: 5, errors: [] } as any);
		mockInput.waitForEnter.mockResolvedValue();

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const importAllItem = items.find((i: any) => i.key === "a");
		expect(importAllItem).toBeDefined();
		await (importAllItem as any).action();

		expect(mockImportAll).toHaveBeenCalledWith("/project", "my-lib", testDeps);
		expect(output()).toContain("Imported 5 file(s)");
	});

	it("Import All shows errors when present", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);
		mockImportAll.mockReturnValue({ total: 2, errors: ["Bad file"] } as any);
		mockInput.waitForEnter.mockResolvedValue();

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const importAllItem = items.find((i: any) => i.key === "a");
		await (importAllItem as any).action();

		expect(output()).toContain("Bad file");
	});

	it("Back action stops the menu loop", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);

		await libraryMenu("/project", "my-lib", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("exits loop when runMenu returns quit", async () => {
		mockDiscoverLibraries.mockReturnValue([LIB]);
		mockDisk.existsSync.mockReturnValue(false);
		mockRunMenu.mockResolvedValue("quit");

		await libraryMenu("/project", "my-lib", testDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
	});
});

// ── dataProviderMenu ────────────────────────────────────────────────

describe("dataProviderMenu", () => {
	const PROVIDER = {
		name: "user-accounts",
		recordCount: 42,
		hasDictionary: true,
		path: "/project/data-providers/user-accounts",
	};

	it("shows empty message when no providers exist", async () => {
		mockListProviders.mockReturnValue([]);

		await dataProviderMenu("/project", testDeps);

		expect(output()).toContain("No data providers found");
	});

	it("shows provider count when providers exist", async () => {
		mockListProviders.mockReturnValue([PROVIDER]);

		await dataProviderMenu("/project", testDeps);

		expect(output()).toContain("1 data provider(s)");
	});

	it("builds menu items from providers", async () => {
		mockListProviders.mockReturnValue([PROVIDER]);

		await dataProviderMenu("/project", testDeps);

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Data Providers");
		// 1 provider + sep + Add + sep + Back = 5
		expect(items.length).toBe(5);
	});

	it("shows dict tag for provider with dictionary", async () => {
		mockListProviders.mockReturnValue([PROVIDER]);

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("dict");
		expect(items[0].label).toContain("42 records");
	});

	it("shows no dict tag for provider without dictionary", async () => {
		mockListProviders.mockReturnValue([{ ...PROVIDER, hasDictionary: false }]);

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].label).toContain("no dict");
	});

	it("Add Data Provider asks for name and creates provider", async () => {
		mockListProviders.mockReturnValue([]);
		mockInput.ask.mockResolvedValue("new-provider");
		mockCreateProvider.mockReturnValue({ jsonPath: "data/new-provider.json", mdPath: "data/new-provider.md" } as any);
		mockInput.waitForEnter.mockResolvedValue();

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		await (addItem as any).action();

		expect(mockInput.ask).toHaveBeenCalledWith("Provider name (kebab-case, e.g. user-accounts)");
		expect(mockCreateProvider).toHaveBeenCalledWith("/project", "new-provider", testDeps);
		expect(output()).toContain("Created data/new-provider.json");
	});

	it("Add Data Provider does nothing when name is empty", async () => {
		mockListProviders.mockReturnValue([]);
		mockInput.ask.mockResolvedValue("");

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockCreateProvider).not.toHaveBeenCalled();
	});

	it("Add Data Provider shows already-exists message when create returns null", async () => {
		mockListProviders.mockReturnValue([]);
		mockInput.ask.mockResolvedValue("existing");
		mockCreateProvider.mockReturnValue(null as any);

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(output()).toContain("already exists");
	});

	it("Back action stops the menu loop", async () => {
		mockListProviders.mockReturnValue([]);

		await dataProviderMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("exits loop when runMenu returns quit", async () => {
		mockListProviders.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("quit");

		await dataProviderMenu("/project", testDeps);

		expect(mockRunMenu).toHaveBeenCalledTimes(1);
	});
});

// ── dataProviderDetailMenu ──────────────────────────────────────────

describe("dataProviderDetailMenu", () => {
	it("shows not-found message when provider does not exist", async () => {
		mockReadProvider.mockReturnValue(null as any);

		await dataProviderDetailMenu("/project", "missing", testDeps);

		expect(output()).toContain("not found");
		expect(mockRunMenu).not.toHaveBeenCalled();
	});

	it("displays provider name and record count for array data", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }, { id: 2 }, { id: 3 }] as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "users", testDeps);

		expect(output()).toContain("users");
		expect(output()).toContain("3 record(s)");
	});

	it("displays 1 record for non-array data", async () => {
		mockReadProvider.mockReturnValue({ id: 1, name: "test" } as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "config", testDeps);

		expect(output()).toContain("1 record(s)");
	});

	it("displays schema fields when present", async () => {
		mockReadProvider.mockReturnValue([{ id: 1, name: "Alice" }] as any);
		mockInferSchema.mockReturnValue([
			{ field: "id", type: "number", example: "1" },
			{ field: "name", type: "string", example: "Alice" },
		] as any);

		await dataProviderDetailMenu("/project", "users", testDeps);

		expect(output()).toContain("Schema:");
		expect(output()).toContain("id");
		expect(output()).toContain("number");
		expect(output()).toContain("name");
		expect(output()).toContain("string");
	});

	it("does not display schema header when schema is empty", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "users", testDeps);

		expect(output()).not.toContain("Schema:");
	});

	it("includes Regenerate Data Dictionary menu item", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "users", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeDefined();
		expect(regenItem!.label).toContain("Regenerate Data Dictionary");
	});

	it("Regenerate action shows success when dictionary is regenerated", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);
		mockRegenDict.mockReturnValue(true as any);
		mockInput.waitForEnter.mockResolvedValue();

		await dataProviderDetailMenu("/project", "users", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();

		expect(mockRegenDict).toHaveBeenCalledWith("/project", "users", testDeps);
		expect(output()).toContain("regenerated");
	});

	it("Regenerate action shows failure message when dictionary regeneration fails", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);
		mockRegenDict.mockReturnValue(false as any);
		mockInput.waitForEnter.mockResolvedValue();

		await dataProviderDetailMenu("/project", "users", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();

		expect(output()).toContain("Failed to regenerate");
	});

	it("includes Back item that returns main", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "users", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("passes correct title to runMenu", async () => {
		mockReadProvider.mockReturnValue([{ id: 1 }] as any);
		mockInferSchema.mockReturnValue([]);

		await dataProviderDetailMenu("/project", "users", testDeps);

		const [title] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Provider: users");
	});
});
