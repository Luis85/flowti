import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/menu.js", () => ({ runMenu: vi.fn() }));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), confirm: vi.fn(), select: vi.fn(), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		relative: (from: string, to: string) => to.replace(from + "/", ""),
	},
}));
vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
}));
vi.mock("../../../src/domain/make/naming.js", () => ({
	toKebab: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
	toPascal: vi.fn((s: string) => s.replace(/(?:^|\s)\w/g, (m: string) => m.trim().toUpperCase()).replace(/\s/g, "")),
	toCamel: vi.fn((s: string) => {
		const p = s.replace(/(?:^|\s)\w/g, (m: string) => m.trim().toUpperCase()).replace(/\s/g, "");
		return p.charAt(0).toLowerCase() + p.slice(1);
	}),
}));
vi.mock("../../../src/domain/make/templates/file-writer.js", () => ({
	createFileWriter: vi.fn(() => ({ write: vi.fn(), created: 3 })),
}));
vi.mock("../../../src/domain/make/component/component-plan.js", () => ({
	buildComponentPlan: vi.fn(() => [
		{ path: "components/my-btn/my-btn.md", content: "# MyBtn" },
		{ path: "components/my-btn/my-btn.json", content: "{}" },
	]),
	resolveNextSteps: vi.fn(() => []),
}));
vi.mock("../../../src/domain/make/component/component-registry.js", () => ({
	loadComponentDefinitions: vi.fn(() => []),
	createComponentTemplateRegistry: vi.fn(() => ({})),
}));
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	getFrameworkPackages: vi.fn(() => ({ framework: "@storybook/html-vite" })),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { createFileWriter } from "../../../src/domain/make/templates/file-writer.js";
import { buildComponentPlan, resolveNextSteps } from "../../../src/domain/make/component/component-plan.js";
import { loadComponentDefinitions } from "../../../src/domain/make/component/component-registry.js";
import { componentMenu } from "../../../src/ui/menus/component-makers-menu.js";
import type { ComponentDefinition } from "../../../src/domain/make/component/component-types.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";

const testDeps: MenuDeps = { disk, paths, clock, input, log };

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);
const mockDisk = vi.mocked(disk);
const mockLoadDefs = vi.mocked(loadComponentDefinitions);
const mockBuildPlan = vi.mocked(buildComponentPlan);
const mockResolveNext = vi.mocked(resolveNextSteps);

const MINIMAL_DEF: ComponentDefinition = {
	id: "button",
	kind: "ui-component",
	label: "Button",
	description: "A button component",
	prompts: [],
	files: [],
	metadata: {},
	properties: [],
	actions: [],
	variants: [],
	states: [],
	nextSteps: [],
};

beforeEach(() => {
	vi.resetAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
});

describe("componentMenu", () => {
	it("builds menu from loaded definitions", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue("main");

		await componentMenu("/project", testDeps);

		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Add Component");
		// 1 def + separator + back + quit = 4
		expect(items).toHaveLength(4);
		expect(items[0].label).toContain("Add Button");
	});

	it("back returns 'main'", async () => {
		mockLoadDefs.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const back = items.find((i: any) => i.key === "b");
		expect(await (back as any).action()).toBe("main");
	});

	it("quit returns 'quit'", async () => {
		mockLoadDefs.mockReturnValue([]);
		mockRunMenu.mockResolvedValue("main");

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const quit = items.find((i: any) => i.key === "q");
		expect(await (quit as any).action()).toBe("quit");
	});

	it("interactive maker: happy path creates files", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")   // component name
			.mockResolvedValueOnce("")         // domain (empty)
			.mockResolvedValueOnce("")         // custom props (exit)
			.mockResolvedValueOnce("Y");       // proceed
		mockDisk.existsSync.mockReturnValue(false);
		mockBuildPlan.mockReturnValue([
			{ path: "components/mybtn/mybtn.md", content: "# MyBtn" },
		]);
		const mockWrite = vi.fn();
		vi.mocked(createFileWriter).mockReturnValue({ write: mockWrite, created: 1 } as any);
		mockResolveNext.mockReturnValue([]);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Created 1 files");
	});

	it("interactive maker: cancels when name is empty", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask.mockResolvedValueOnce("");

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).not.toHaveBeenCalled();
	});

	it("interactive maker: cancels when user declines", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("")         // custom props (exit)
			.mockResolvedValueOnce("n");       // decline
		mockDisk.existsSync.mockReturnValue(false);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).not.toHaveBeenCalled();
	});

	it("interactive maker: aborts when component already exists", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("");        // custom props (exit)
		mockDisk.existsSync.mockReturnValue(true);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Component already exists");
	});

	it("interactive maker: collects definition prompts", async () => {
		const defWithPrompts: ComponentDefinition = {
			...MINIMAL_DEF,
			prompts: [{ variable: "slot", label: "Slot type", default: "default" }],
		};
		mockLoadDefs.mockReturnValue([defWithPrompts]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")    // name
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("primary")  // prompt answer
			.mockResolvedValueOnce("")         // custom props (exit)
			.mockResolvedValueOnce("Y");       // proceed
		mockDisk.existsSync.mockReturnValue(false);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 1 } as any);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).toHaveBeenCalled();
	});

	it("interactive maker: aborts on required prompt empty", async () => {
		const defWithRequired: ComponentDefinition = {
			...MINIMAL_DEF,
			prompts: [{ variable: "slot", label: "Slot type", required: true }],
		};
		mockLoadDefs.mockReturnValue([defWithRequired]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("");        // empty required

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).not.toHaveBeenCalled();
		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Required");
	});

	it("interactive maker: collects property values", async () => {
		const defWithProps: ComponentDefinition = {
			...MINIMAL_DEF,
			properties: [
				{ key: "size", type: "string", default: "md", description: "Button size" },
			],
		};
		mockLoadDefs.mockReturnValue([defWithProps]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")   // name
			.mockResolvedValueOnce("")        // domain
			.mockResolvedValueOnce("lg")      // property value
			.mockResolvedValueOnce("")        // custom props (exit)
			.mockResolvedValueOnce("Y");      // proceed
		mockDisk.existsSync.mockReturnValue(false);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 1 } as any);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockBuildPlan).toHaveBeenCalled();
	});

	it("interactive maker: shows next steps when available", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("")         // custom props (exit)
			.mockResolvedValueOnce("Y");
		mockDisk.existsSync.mockReturnValue(false);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 1 } as any);
		mockResolveNext.mockReturnValue(["Run npm test", "Open docs"]);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Next steps");
		expect(output).toContain("Run npm test");
	});

	it("interactive maker: waits for enter after creation", async () => {
		mockLoadDefs.mockReturnValue([MINIMAL_DEF]);
		mockRunMenu.mockResolvedValue(undefined);
		mockInput.ask
			.mockResolvedValueOnce("MyBtn")
			.mockResolvedValueOnce("")         // domain
			.mockResolvedValueOnce("")         // custom props (exit)
			.mockResolvedValueOnce("Y");
		mockDisk.existsSync.mockReturnValue(false);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 1 } as any);

		await componentMenu("/project", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});
});
