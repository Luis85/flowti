import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Infrastructure mocks ────────────────────────────────────────────
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
}));
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(() => ""), askYesNo: vi.fn(() => true), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "", printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock-vault", CLI_PROJECT: "/mock/cli", cliConfig: {}, PROJECTS_DIR: "/mock/projects",
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/infrastructure/deps.js", () => ({
	createDefaultDeps: vi.fn(() => ({ disk: {}, paths: {}, shell: {}, clock: {}, log: vi.fn() })),
}));

// ── Domain / UI mocks for components ────────────────────────────────
const mockComponentMenu = vi.fn();
vi.mock("../../../src/ui/menus/component-makers-menu.js", () => ({
	componentMenu: mockComponentMenu,
}));

const mockListProjectComponents = vi.fn(() => []);
const mockDetectDirtyComponents = vi.fn();
vi.mock("../../../src/domain/make/component/component-list.js", () => ({
	listProjectComponents: mockListProjectComponents,
	detectDirtyComponents: mockDetectDirtyComponents,
}));

const mockRegenerateComponent = vi.fn(() => ({ success: true, filesWritten: 2 }));
vi.mock("../../../src/domain/make/component/component-commands.js", () => ({
	regenerateComponent: mockRegenerateComponent,
}));

const mockGetFramework = vi.fn(() => "html");
const mockSetFramework = vi.fn();
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: mockGetFramework,
	setFramework: mockSetFramework,
}));

const mockIsStorybookInstalled = vi.fn(() => false);
const mockInstallStorybook = vi.fn();
const mockIsStorybookRunning = vi.fn(() => false);
const mockRunStorybookDev = vi.fn();
const mockStopStorybook = vi.fn();
const mockRunStorybookBuild = vi.fn();
const mockGetFrameworkPackages = vi.fn(() => ({ framework: "html" }));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	isStorybookInstalled: mockIsStorybookInstalled,
	installStorybook: mockInstallStorybook,
	isStorybookRunning: mockIsStorybookRunning,
	runStorybookDev: mockRunStorybookDev,
	stopStorybook: mockStopStorybook,
	runStorybookBuild: mockRunStorybookBuild,
	getFrameworkPackages: mockGetFrameworkPackages,
}));

const mockCreateStorybookRenderer = vi.fn(() => ({ render: vi.fn() }));
vi.mock("../../../src/ui/renderers/storybook-renderer-impl.js", () => ({
	createStorybookRenderer: mockCreateStorybookRenderer,
}));

const mockDataProviderMenu = vi.fn();
vi.mock("../../../src/ui/menus/component-submenus.js", () => ({
	dataProviderMenu: mockDataProviderMenu,
}));

const mockActionReferenceMenu = vi.fn();
vi.mock("../../../src/ui/menus/action-reference-menu.js", () => ({
	actionReferenceMenu: mockActionReferenceMenu,
}));

const mockReadComponentInstance = vi.fn(() => ({ name: "TestComp", fields: [] }));
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	readComponentInstance: mockReadComponentInstance,
}));

const mockEditFieldsMenu = vi.fn();
const mockEditPropertiesMenu = vi.fn();
const mockEditActionsMenu = vi.fn();
vi.mock("../../../src/ui/menus/component-detail-menu.js", () => ({
	editFieldsMenu: mockEditFieldsMenu,
	editPropertiesMenu: mockEditPropertiesMenu,
	editActionsMenu: mockEditActionsMenu,
}));

const mockEditChildrenMenu = vi.fn();
const mockEditStoresMenu = vi.fn();
vi.mock("../../../src/ui/menus/component-editor-menus.js", () => ({
	editChildrenMenu: mockEditChildrenMenu,
	editStoresMenu: mockEditStoresMenu,
}));

const mockEditRequirementsMenu = vi.fn();
const mockEditFeaturesMenu = vi.fn();
const mockEditRelationshipsMenu = vi.fn();
vi.mock("../../../src/ui/menus/component-product-menus.js", () => ({
	editRequirementsMenu: mockEditRequirementsMenu,
	editFeaturesMenu: mockEditFeaturesMenu,
	editRelationshipsMenu: mockEditRelationshipsMenu,
}));

// ── Imports ─────────────────────────────────────────────────────────
import { HandlerRegistry } from "../../../src/infrastructure/handler-registry.js";
import { registerComponentHandlers } from "../../../src/ui/handlers/component-handlers.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { clock } from "../../../src/infrastructure/clock.js";

import type { RouterContext } from "../../../src/infrastructure/sitemap-types.js";

// ── Helpers ─────────────────────────────────────────────────────────

const mockDeps = {
	disk,
	paths: { join: (...args: string[]) => args.join("/"), resolve: (...args: string[]) => args.join("/"), basename: (p: string) => p.split("/").pop() ?? "", sep: "/" },
	clock,
	input,
	log: vi.fn(),
	warn: vi.fn(),
	shell: { run: vi.fn(() => 0), runSilent: vi.fn(), runCapture: vi.fn(() => ""), runCaptureStatus: vi.fn(() => ({ exitCode: 0, output: "" })) },
	proc: { exit: vi.fn(), argv: [] },
	bus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
};

function mockCtx(overrides: Partial<{ params: Record<string, unknown>; config: Record<string, unknown> }> = {}): RouterContext {
	return {
		deps: mockDeps,
		project: {
			config: {
				components: {},
				management: {},
				reports: { generators: [] },
				docs: { references: [], generators: [] },
				...overrides.config,
			},
			path: "/project",
			scripts: { build: "npm run build", test: "npm test", lint: "npm run lint", check: "npm run check" },
		},
		params: overrides.params ?? {},
	} as RouterContext;
}

function noProjectCtx(): RouterContext {
	return { deps: mockDeps, project: undefined } as unknown as RouterContext;
}

function detailCtx(componentName = "MyComp", domain = "shared"): RouterContext {
	return mockCtx({ params: { componentName, domain } });
}

// ── Suite ───────────────────────────────────────────────────────────

describe("registerComponentHandlers", () => {
	let registry: HandlerRegistry;

	beforeEach(() => {
		vi.clearAllMocks();
		registry = new HandlerRegistry();
		registerComponentHandlers(registry);
	});

	// ── Registration ────────────────────────────────────────────────

	describe("registration", () => {
		it("registers all expected component actions", () => {
			const expectedActions = [
				"comp:add",
				"comp:regen-dirty",
				"comp:sb-install",
				"comp:sb-start",
				"comp:sb-stop",
				"comp:sb-build",
				"comp:sb-import",
				"comp:sb-scaffold",
				"comp:data-providers",
				"comp:action-ref",
				"comp-detail:edit-fields",
				"comp-detail:edit-props",
				"comp-detail:edit-actions",
				"comp-detail:edit-children",
				"comp-detail:edit-stores",
				"comp-detail:edit-reqs",
				"comp-detail:edit-features",
				"comp-detail:edit-rels",
			];
			for (const id of expectedActions) {
				expect(registry.hasAction(id)).toBe(true);
			}
		});

		it("registers exactly 18 actions", () => {
			expect(registry.actionCount).toBe(18);
		});
	});

	// ── comp:add ────────────────────────────────────────────────────

	describe("comp:add", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:add");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls componentMenu with project path and deps", async () => {
			const handler = registry.getAction("comp:add");
			await handler(mockCtx());
			expect(mockComponentMenu).toHaveBeenCalledWith("/project", mockDeps);
		});
	});

	// ── comp:regen-dirty ────────────────────────────────────────────

	describe("comp:regen-dirty", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:regen-dirty");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message and waits when no dirty components", async () => {
			mockListProjectComponents.mockReturnValue([]);
			const handler = registry.getAction("comp:regen-dirty");
			await handler(mockCtx());
			expect(mockListProjectComponents).toHaveBeenCalled();
			expect(mockDetectDirtyComponents).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("regenerates dirty components when confirmed", async () => {
			const dirtyComp = { name: "Btn", isDirty: true, domain: "shared" };
			mockListProjectComponents.mockReturnValue([dirtyComp]);
			vi.mocked(input.askYesNo).mockResolvedValueOnce(true);
			const handler = registry.getAction("comp:regen-dirty");
			await handler(mockCtx());
			expect(mockGetFramework).toHaveBeenCalled();
			expect(mockGetFrameworkPackages).toHaveBeenCalled();
			expect(mockRegenerateComponent).toHaveBeenCalledWith("Btn", "/project", expect.anything(), "shared", "html");
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("cancels when user declines confirmation", async () => {
			const dirtyComp = { name: "Btn", isDirty: true, domain: "shared" };
			mockListProjectComponents.mockReturnValue([dirtyComp]);
			vi.mocked(input.askYesNo).mockResolvedValueOnce(false);
			const handler = registry.getAction("comp:regen-dirty");
			await handler(mockCtx());
			expect(mockRegenerateComponent).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── comp:sb-install ─────────────────────────────────────────────

	describe("comp:sb-install", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:sb-install");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when storybook already installed", async () => {
			mockIsStorybookInstalled.mockReturnValue(true);
			const handler = registry.getAction("comp:sb-install");
			await handler(mockCtx());
			expect(mockInstallStorybook).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("installs storybook with selected framework", async () => {
			mockIsStorybookInstalled.mockReturnValue(false);
			vi.mocked(input.ask).mockResolvedValueOnce("1");
			const handler = registry.getAction("comp:sb-install");
			await handler(mockCtx());
			expect(mockSetFramework).toHaveBeenCalledWith("/project", "html", expect.anything());
			expect(mockInstallStorybook).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("cancels on invalid framework choice", async () => {
			mockIsStorybookInstalled.mockReturnValue(false);
			vi.mocked(input.ask).mockResolvedValueOnce("9");
			const handler = registry.getAction("comp:sb-install");
			await handler(mockCtx());
			expect(mockSetFramework).not.toHaveBeenCalled();
			expect(mockInstallStorybook).not.toHaveBeenCalled();
		});
	});

	// ── comp:sb-start ───────────────────────────────────────────────

	describe("comp:sb-start", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:sb-start");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when storybook not installed", async () => {
			mockIsStorybookInstalled.mockReturnValue(false);
			const handler = registry.getAction("comp:sb-start");
			await handler(mockCtx());
			expect(mockRunStorybookDev).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("logs message when storybook already running", async () => {
			mockIsStorybookInstalled.mockReturnValue(true);
			mockIsStorybookRunning.mockReturnValue(true);
			const handler = registry.getAction("comp:sb-start");
			await handler(mockCtx());
			expect(mockRunStorybookDev).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("starts storybook when installed and not running", async () => {
			mockIsStorybookInstalled.mockReturnValue(true);
			mockIsStorybookRunning.mockReturnValue(false);
			const handler = registry.getAction("comp:sb-start");
			await handler(mockCtx());
			expect(mockRunStorybookDev).toHaveBeenCalled();
		});
	});

	// ── comp:sb-stop ────────────────────────────────────────────────

	describe("comp:sb-stop", () => {
		it("logs message when storybook not running", async () => {
			mockIsStorybookRunning.mockReturnValue(false);
			const handler = registry.getAction("comp:sb-stop");
			await handler(mockCtx());
			expect(mockStopStorybook).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("stops storybook when running", async () => {
			mockIsStorybookRunning.mockReturnValue(true);
			const handler = registry.getAction("comp:sb-stop");
			await handler(mockCtx());
			expect(mockStopStorybook).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("does not require project", async () => {
			mockIsStorybookRunning.mockReturnValue(false);
			const handler = registry.getAction("comp:sb-stop");
			const result = await handler(noProjectCtx());
			expect(result).toBeUndefined();
		});
	});

	// ── comp:sb-build ───────────────────────────────────────────────

	describe("comp:sb-build", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:sb-build");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("logs message when storybook not installed", async () => {
			mockIsStorybookInstalled.mockReturnValue(false);
			const handler = registry.getAction("comp:sb-build");
			await handler(mockCtx());
			expect(mockRunStorybookBuild).not.toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});

		it("runs storybook build when installed", async () => {
			mockIsStorybookInstalled.mockReturnValue(true);
			const handler = registry.getAction("comp:sb-build");
			await handler(mockCtx());
			expect(mockRunStorybookBuild).toHaveBeenCalled();
			expect(input.waitForEnter).toHaveBeenCalled();
		});
	});

	// ── comp:data-providers ─────────────────────────────────────────

	describe("comp:data-providers", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp:data-providers");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("calls dataProviderMenu with project path and deps", async () => {
			const handler = registry.getAction("comp:data-providers");
			await handler(mockCtx());
			expect(mockDataProviderMenu).toHaveBeenCalledWith("/project", mockDeps);
		});
	});

	// ── comp:action-ref ─────────────────────────────────────────────

	describe("comp:action-ref", () => {
		it("calls actionReferenceMenu with deps", async () => {
			const handler = registry.getAction("comp:action-ref");
			await handler(mockCtx());
			expect(mockActionReferenceMenu).toHaveBeenCalledWith(mockDeps);
		});

		it("does not require project", async () => {
			const handler = registry.getAction("comp:action-ref");
			await handler(noProjectCtx());
			expect(mockActionReferenceMenu).toHaveBeenCalledWith(mockDeps);
		});
	});

	// ── comp-detail:edit-fields ─────────────────────────────────────

	describe("comp-detail:edit-fields", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-fields");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-fields");
			const ctx = mockCtx({ params: {} });
			expect(await handler(ctx)).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-fields");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editFieldsMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-fields");
			await handler(detailCtx("MyComp", "shared"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "MyComp", expect.anything(), "shared");
			expect(mockEditFieldsMenu).toHaveBeenCalledWith("/project", "MyComp", expect.anything(), "shared", mockDeps);
		});
	});

	// ── comp-detail:edit-props ──────────────────────────────────────

	describe("comp-detail:edit-props", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-props");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-props");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-props");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editPropertiesMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-props");
			await handler(detailCtx("Card", "ui"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Card", expect.anything(), "ui");
			expect(mockEditPropertiesMenu).toHaveBeenCalledWith("/project", "Card", expect.anything(), "ui", mockDeps);
		});
	});

	// ── comp-detail:edit-actions ────────────────────────────────────

	describe("comp-detail:edit-actions", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-actions");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-actions");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-actions");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editActionsMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-actions");
			await handler(detailCtx("Form", "domain"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Form", expect.anything(), "domain");
			expect(mockEditActionsMenu).toHaveBeenCalledWith("/project", "Form", expect.anything(), "domain", mockDeps);
		});
	});

	// ── comp-detail:edit-children ───────────────────────────────────

	describe("comp-detail:edit-children", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-children");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-children");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-children");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editChildrenMenu with correct args including allComponents", async () => {
			const allComps = [{ name: "A" }, { name: "B" }];
			mockListProjectComponents.mockReturnValue(allComps);
			const handler = registry.getAction("comp-detail:edit-children");
			await handler(detailCtx("Panel", "shared"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Panel", expect.anything(), "shared");
			expect(mockListProjectComponents).toHaveBeenCalledWith("/project", expect.anything());
			expect(mockEditChildrenMenu).toHaveBeenCalledWith("/project", "Panel", expect.anything(), allComps, "shared", mockDeps);
		});
	});

	// ── comp-detail:edit-stores ─────────────────────────────────────

	describe("comp-detail:edit-stores", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-stores");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-stores");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-stores");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editStoresMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-stores");
			await handler(detailCtx("Table", "data"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Table", expect.anything(), "data");
			expect(mockEditStoresMenu).toHaveBeenCalledWith("/project", "Table", expect.anything(), "data", mockDeps);
		});
	});

	// ── comp-detail:edit-reqs ───────────────────────────────────────

	describe("comp-detail:edit-reqs", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-reqs");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-reqs");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-reqs");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editRequirementsMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-reqs");
			await handler(detailCtx("Modal", "ui"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Modal", expect.anything(), "ui");
			expect(mockEditRequirementsMenu).toHaveBeenCalledWith("/project", "Modal", expect.anything(), "ui", mockDeps);
		});
	});

	// ── comp-detail:edit-features ───────────────────────────────────

	describe("comp-detail:edit-features", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-features");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-features");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-features");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editFeaturesMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-features");
			await handler(detailCtx("Nav", "layout"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Nav", expect.anything(), "layout");
			expect(mockEditFeaturesMenu).toHaveBeenCalledWith("/project", "Nav", expect.anything(), "layout", mockDeps);
		});
	});

	// ── comp-detail:edit-rels ───────────────────────────────────────

	describe("comp-detail:edit-rels", () => {
		it("returns undefined when no project", async () => {
			const handler = registry.getAction("comp-detail:edit-rels");
			expect(await handler(noProjectCtx())).toBeUndefined();
		});

		it("returns undefined when no componentName param", async () => {
			const handler = registry.getAction("comp-detail:edit-rels");
			expect(await handler(mockCtx({ params: {} }))).toBeUndefined();
		});

		it("returns undefined when component instance not found", async () => {
			mockReadComponentInstance.mockReturnValueOnce(undefined as never);
			const handler = registry.getAction("comp-detail:edit-rels");
			expect(await handler(detailCtx())).toBeUndefined();
		});

		it("calls editRelationshipsMenu with correct args", async () => {
			const handler = registry.getAction("comp-detail:edit-rels");
			await handler(detailCtx("Sidebar", "layout"));
			expect(mockReadComponentInstance).toHaveBeenCalledWith("/project", "Sidebar", expect.anything(), "layout");
			expect(mockEditRelationshipsMenu).toHaveBeenCalledWith("/project", "Sidebar", expect.anything(), "layout", mockDeps);
		});
	});
});
