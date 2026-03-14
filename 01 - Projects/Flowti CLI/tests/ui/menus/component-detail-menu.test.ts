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
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	readComponentInstance: vi.fn(),
	writeComponentInstance: vi.fn(),
	getEditableFields: vi.fn(() => ["name", "description", "status"]),
	setField: vi.fn(),
	addProperty: vi.fn(),
	removeProperty: vi.fn(),
	addAction: vi.fn(),
	removeAction: vi.fn(),
}));
vi.mock("../../../src/domain/make/component/component-commands.js", () => ({
	regenerateComponent: vi.fn(() => ({ success: true, name: "button", filesWritten: 3 })),
}));
vi.mock("../../../src/domain/make/component/storybook-settings.js", () => ({
	getFramework: vi.fn(() => "html"),
}));
vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	getFrameworkPackages: vi.fn(() => ({ framework: "@storybook/html-vite" })),
}));
vi.mock("../../../src/domain/make/component/component-list.js", () => ({
	buildAncestryPath: vi.fn(() => "System > Button"),
	findSiblings: vi.fn(() => []),
	COMPONENTS_DIR: "components",
}));
vi.mock("../../../src/domain/make/component/action-reference.js", () => ({
	ACTION_REFERENCE: [
		{ category: "Mouse", actions: [{ name: "onClick", description: "Fired when clicked" }] },
		{ category: "Form", actions: [{ name: "onChange", description: "Fired on change" }] },
	],
	searchActions: vi.fn(() => []),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";
import { readComponentInstance } from "../../../src/domain/make/component/component-editor.js";
import { regenerateComponent } from "../../../src/domain/make/component/component-commands.js";
import {
	componentDetailMenu,
	renderOptionalField,
	renderKeyValueSection,
	renderListSection,
	renderChildrenSection,
	renderRelationshipsSection,
	renderStoresSection,
	renderComponentDetail,
	parseValue,
} from "../../../src/ui/menus/component-detail-menu.js";
import type { ProjectComponent } from "../../../src/domain/make/component/component-types.js";
import type { MenuDeps } from "../../../src/infrastructure/deps.js";

const testDeps: MenuDeps = { disk, paths, clock, input, log };

const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockReadInstance = vi.mocked(readComponentInstance);
const mockRegenerate = vi.mocked(regenerateComponent);
const mockInput = vi.mocked(input);

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

const COMPONENT: ProjectComponent = {
	name: "button",
	kind: "ui-component",
	status: "active",
	path: "components/button/button.md",
};

const INSTANCE = {
	name: "Button",
	id: "button",
	type: "ui-component",
	status: "active",
	description: "A clickable button",
	properties: { variant: "default", disabled: false },
	actions: ["onClick", "onFocus"],
	variants: { primary: { variant: "primary" } },
	states: { hover: { variant: "default" } },
};

beforeEach(() => {
	vi.clearAllMocks();
	mockRunMenu.mockResolvedValue("main");
});

describe("componentDetailMenu", () => {
	it("shows no-definition message when JSON missing", async () => {
		mockReadInstance.mockReturnValue(null);
		mockInput.waitForEnter.mockResolvedValue();

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("No definition JSON found");
	});

	it("displays component name and type", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("Button");
		expect(output()).toContain("ui-component");
	});

	it("displays description when present", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("A clickable button");
	});

	it("displays properties", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("Properties:");
		expect(output()).toContain("variant");
		expect(output()).toContain("disabled");
	});

	it("displays actions", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("Actions:");
		expect(output()).toContain("onClick");
		expect(output()).toContain("onFocus");
	});

	it("displays variants", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("Variants:");
		expect(output()).toContain("primary");
	});

	it("displays states", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		expect(output()).toContain("States:");
		expect(output()).toContain("hover");
	});

	it("shows dirty message when isDirty", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty], undefined, testDeps);

		expect(output()).toContain("Definition modified");
	});

	it("includes Edit Fields menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "e")).toBeDefined();
	});

	it("includes Edit Properties menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "p")).toBeDefined();
	});

	it("includes Edit Actions menu item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items.find((i: any) => i.key === "a")).toBeDefined();
	});

	it("includes Regenerate item when dirty", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeDefined();
		expect(regenItem!.label).toContain("Regenerate");
	});

	it("does not include Regenerate item when clean", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		expect(regenItem).toBeUndefined();
	});

	it("Regenerate action prompts for confirmation", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(true);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const regenItem = items.find((i: any) => i.key === "r");
		await (regenItem as any).action();
		expect(mockInput.askYesNo).toHaveBeenCalled();
		expect(mockRegenerate).toHaveBeenCalledWith("button", "/project", expect.any(Object), undefined, "@storybook/html-vite");
	});

	it("Regenerate clears isDirty and shows fresh message", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(true);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "r") as any).action();
		expect(dirty.isDirty).toBe(false);
		expect(output()).toContain("fresh");
	});

	it("Regenerate skips when user declines", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);
		mockInput.askYesNo.mockResolvedValue(false);
		const dirty = { ...COMPONENT, isDirty: true };

		await componentDetailMenu("/project", dirty, [dirty], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items.find((i: any) => i.key === "r") as any).action();
		expect(mockRegenerate).not.toHaveBeenCalled();
		expect(output()).toContain("Cancelled");
	});

	it("includes Back item", async () => {
		mockReadInstance.mockReturnValue(INSTANCE as any);

		await componentDetailMenu("/project", COMPONENT, [COMPONENT], undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});
});

// ── parseValue ──────────────────────────────────────────────────────

describe("parseValue", () => {
	it("parses 'true' to boolean true", () => {
		expect(parseValue("true")).toBe(true);
	});

	it("parses 'false' to boolean false", () => {
		expect(parseValue("false")).toBe(false);
	});

	it("parses integer string to number", () => {
		expect(parseValue("42")).toBe(42);
	});

	it("parses float string to number", () => {
		expect(parseValue("3.14")).toBe(3.14);
	});

	it("parses negative number string", () => {
		expect(parseValue("-7")).toBe(-7);
	});

	it("parses zero", () => {
		expect(parseValue("0")).toBe(0);
	});

	it("returns plain string as-is", () => {
		expect(parseValue("hello")).toBe("hello");
	});

	it("returns empty string as-is", () => {
		expect(parseValue("")).toBe("");
	});

	it("returns whitespace-only string as-is", () => {
		expect(parseValue("   ")).toBe("   ");
	});
});

// ── renderOptionalField ─────────────────────────────────────────────

describe("renderOptionalField", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs formatted output when value is present", () => {
		renderOptionalField("Owner", "Alice", mockFn);

		expect(mockFn).toHaveBeenCalledTimes(1);
		const line = mockFn.mock.calls[0][0] as string;
		expect(line).toContain("Owner:");
		expect(line).toContain("Alice");
	});

	it("does not log when value is undefined", () => {
		renderOptionalField("Owner", undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when value is empty string", () => {
		renderOptionalField("Owner", "", mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("respects custom width parameter", () => {
		renderOptionalField("X", "val", mockFn, 20);

		expect(mockFn).toHaveBeenCalledTimes(1);
		const line = mockFn.mock.calls[0][0] as string;
		expect(line).toContain("X:");
		expect(line).toContain("val");
	});
});

// ── renderKeyValueSection ───────────────────────────────────────────

describe("renderKeyValueSection", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs title and each key-value pair", () => {
		renderKeyValueSection("Properties", { color: "red", size: 12 }, mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Properties:"))).toBe(true);
		expect(lines.some((l) => l.includes("color:") && l.includes('"red"'))).toBe(true);
		expect(lines.some((l) => l.includes("size:") && l.includes("12"))).toBe(true);
	});

	it("does not log when entries is undefined", () => {
		renderKeyValueSection("Properties", undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when entries is empty object", () => {
		renderKeyValueSection("Properties", {}, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

// ── renderListSection ───────────────────────────────────────────────

describe("renderListSection", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs title and each item", () => {
		renderListSection("Actions", ["onClick", "onHover"], mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Actions:"))).toBe(true);
		expect(lines.some((l) => l.includes("onClick"))).toBe(true);
		expect(lines.some((l) => l.includes("onHover"))).toBe(true);
	});

	it("does not log when items is undefined", () => {
		renderListSection("Actions", undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when items is empty array", () => {
		renderListSection("Actions", [], mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

// ── renderChildrenSection ───────────────────────────────────────────

describe("renderChildrenSection", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs children with name", () => {
		renderChildrenSection([{ name: "Icon" }], mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Children:"))).toBe(true);
		expect(lines.some((l) => l.includes("Icon"))).toBe(true);
	});

	it("shows slot annotation when present", () => {
		renderChildrenSection([{ name: "Icon", slot: "leading" }], mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("[leading]"))).toBe(true);
	});

	it("shows optional annotation when true", () => {
		renderChildrenSection([{ name: "Badge", optional: true }], mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("(optional)"))).toBe(true);
	});

	it("shows slot and optional together", () => {
		renderChildrenSection([{ name: "Icon", slot: "leading", optional: true }], mockFn);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		const childLine = lines.find((l) => l.includes("Icon"));
		expect(childLine).toContain("[leading]");
		expect(childLine).toContain("(optional)");
	});

	it("does not log when children is undefined", () => {
		renderChildrenSection(undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when children is empty array", () => {
		renderChildrenSection([], mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

// ── renderRelationshipsSection ──────────────────────────────────────

describe("renderRelationshipsSection", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs relationships with target and type", () => {
		renderRelationshipsSection(
			[{ target: "UserService", type: "uses" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Relationships:"))).toBe(true);
		expect(lines.some((l) => l.includes("UserService") && l.includes("(uses)"))).toBe(true);
	});

	it("shows technology annotation when present", () => {
		renderRelationshipsSection(
			[{ target: "API", type: "calls", technology: "REST" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("[REST]"))).toBe(true);
	});

	it("omits technology annotation when absent", () => {
		renderRelationshipsSection(
			[{ target: "DB", type: "reads" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		const relLine = lines.find((l) => l.includes("DB"));
		expect(relLine).not.toContain("[");
	});

	it("does not log when rels is undefined", () => {
		renderRelationshipsSection(undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when rels is empty array", () => {
		renderRelationshipsSection([], mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

// ── renderStoresSection ─────────────────────────────────────────────

describe("renderStoresSection", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	it("logs stores with name", () => {
		renderStoresSection(
			[{ name: "UserStore" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Stores:"))).toBe(true);
		expect(lines.some((l) => l.includes("UserStore"))).toBe(true);
	});

	it("shows technology annotation when present", () => {
		renderStoresSection(
			[{ name: "Cache", technology: "Redis" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("[Redis]"))).toBe(true);
	});

	it("shows description when present", () => {
		renderStoresSection(
			[{ name: "SessionStore", description: "Holds session data" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		expect(lines.some((l) => l.includes("Holds session data"))).toBe(true);
	});

	it("shows technology and description together", () => {
		renderStoresSection(
			[{ name: "DB", technology: "PostgreSQL", description: "Main database" }],
			mockFn,
		);

		const lines = mockFn.mock.calls.map((c) => c[0] as string);
		const storeLine = lines.find((l) => l.includes("DB"));
		expect(storeLine).toContain("[PostgreSQL]");
		expect(storeLine).toContain("Main database");
	});

	it("does not log when stores is undefined", () => {
		renderStoresSection(undefined, mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});

	it("does not log when stores is empty array", () => {
		renderStoresSection([], mockFn);

		expect(mockFn).not.toHaveBeenCalled();
	});
});

// ── renderComponentDetail ───────────────────────────────────────────

describe("renderComponentDetail", () => {
	let mockFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		mockFn = vi.fn();
	});

	function allOutput(): string {
		return mockFn.mock.calls.map((c) => c[0] ?? "").join("\n");
	}

	it("renders name and type", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "components/card/card.md" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Card");
		expect(allOutput()).toContain("ui-component");
	});

	it("renders ID and status", () => {
		const instance = { name: "Card", id: "card-01", type: "ui-component", status: "draft" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "draft", path: "components/card/card.md" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("card-01");
		expect(allOutput()).toContain("draft");
	});

	it("renders description when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", description: "A card component" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("A card component");
	});

	it("renders properties section when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", properties: { elevation: 2 } } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Properties:");
		expect(allOutput()).toContain("elevation");
	});

	it("renders actions section when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", actions: ["onClick"] } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Actions:");
		expect(allOutput()).toContain("onClick");
	});

	it("renders children section when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", children: [{ name: "CardBody" }] } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Children:");
		expect(allOutput()).toContain("CardBody");
	});

	it("renders stores section when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", stores: [{ name: "CardStore" }] } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Stores:");
		expect(allOutput()).toContain("CardStore");
	});

	it("renders relationships section when present", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active", relationships: [{ target: "List", type: "contains" }] } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Relationships:");
		expect(allOutput()).toContain("List");
	});

	it("shows dirty message when component isDirty", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p", isDirty: true };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).toContain("Definition modified");
	});

	it("does not show dirty message when component is clean", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		expect(allOutput()).not.toContain("Definition modified");
	});

	it("renders minimal instance without optional fields", () => {
		const instance = { name: "Card", id: "card", type: "ui-component", status: "active" } as any;
		const comp: ProjectComponent = { name: "card", kind: "ui-component", status: "active", path: "p" };

		renderComponentDetail(instance, comp, [comp], mockFn);

		// Should not contain section headers for empty optional sections
		expect(allOutput()).not.toContain("Properties:");
		expect(allOutput()).not.toContain("Actions:");
		expect(allOutput()).not.toContain("Children:");
		expect(allOutput()).not.toContain("Stores:");
		expect(allOutput()).not.toContain("Relationships:");
	});
});
