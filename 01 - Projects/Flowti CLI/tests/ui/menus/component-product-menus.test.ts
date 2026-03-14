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
vi.mock("../../../src/domain/make/component/component-editor.js", () => ({
	addRequirement: vi.fn(),
	removeRequirement: vi.fn(),
	addFeature: vi.fn(),
	removeFeature: vi.fn(),
	addRelationship: vi.fn(),
	removeRelationship: vi.fn(),
	writeComponentInstance: vi.fn(),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import {
	addRequirement, removeRequirement,
	addFeature, removeFeature,
	addRelationship, removeRelationship,
	writeComponentInstance,
} from "../../../src/domain/make/component/component-editor.js";
import { editRequirementsMenu, editFeaturesMenu, editRelationshipsMenu } from "../../../src/ui/menus/component-product-menus.js";
import type { ProductMenuDeps } from "../../../src/infrastructure/deps.js";
import type { ComponentInstance } from "../../../src/domain/make/component/component-editor.js";

const mockDisk = vi.mocked(disk);
const mockInput = vi.mocked(input);
const mockLog = vi.mocked(log);
const mockRunMenu = vi.mocked(runMenu);
const mockAddRequirement = vi.mocked(addRequirement);
const mockRemoveRequirement = vi.mocked(removeRequirement);
const mockAddFeature = vi.mocked(addFeature);
const mockRemoveFeature = vi.mocked(removeFeature);
const mockAddRelationship = vi.mocked(addRelationship);
const mockRemoveRelationship = vi.mocked(removeRelationship);
const mockWriteInstance = vi.mocked(writeComponentInstance);

const testDeps: ProductMenuDeps = { disk, paths, input, log };

function makeInstance(overrides: Partial<ComponentInstance> = {}): ComponentInstance {
	return {
		name: "Button",
		id: "button",
		type: "ui-component",
		status: "active",
		description: "A clickable button",
		...overrides,
	} as ComponentInstance;
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRunMenu.mockResolvedValue("main");
});

// ── editRequirementsMenu ────────────────────────────────────────────

describe("editRequirementsMenu", () => {
	it("calls runMenu with 'Edit Requirements' title", async () => {
		const instance = makeInstance();

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		expect(mockRunMenu).toHaveBeenCalledWith("Edit Requirements", expect.any(Array));
	});

	it("lists existing requirements as menu items", async () => {
		const instance = makeInstance({ requirements: ["REQ-001", "REQ-002"] });

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].key).toBe("1");
		expect(items[0].label).toBe("REQ-001");
		expect(items[1].key).toBe("2");
		expect(items[1].label).toBe("REQ-002");
	});

	it("shows Add Requirement item with key 'n'", async () => {
		const instance = makeInstance();

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		expect(addItem!.label).toBe("Add Requirement");
	});

	it("shows Back item with key 'b' that returns 'main'", async () => {
		const instance = makeInstance();

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("removes a requirement when user confirms", async () => {
		const instance = makeInstance({ requirements: ["REQ-001"] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue();

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockInput.askYesNo).toHaveBeenCalledWith('Remove requirement "REQ-001"?');
		expect(mockRemoveRequirement).toHaveBeenCalledWith(instance, "REQ-001");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, undefined);
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("does not remove a requirement when user declines", async () => {
		const instance = makeInstance({ requirements: ["REQ-001"] });
		mockInput.askYesNo.mockResolvedValue(false);

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveRequirement).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("adds a requirement when user provides an ID", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValue("REQ-042");
		mockInput.waitForEnter.mockResolvedValue();

		await editRequirementsMenu("/project", "button", instance, "core", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockInput.ask).toHaveBeenCalledWith("Requirement ID (e.g. REQ-001)");
		expect(mockAddRequirement).toHaveBeenCalledWith(instance, "REQ-042");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, "core");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("does not add a requirement when user provides empty input", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValue("");

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddRequirement).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("handles empty requirements array", async () => {
		const instance = makeInstance({ requirements: [] });

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		// separator + Add Requirement + separator + Back = 4 items (no requirement entries)
		const nonSeparatorItems = items.filter((i: any) => !i.separator);
		expect(nonSeparatorItems).toHaveLength(2); // Add Requirement + Back
	});

	it("handles undefined requirements", async () => {
		const instance = makeInstance();
		// requirements is undefined by default in makeInstance

		await editRequirementsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const nonSeparatorItems = items.filter((i: any) => !i.separator);
		expect(nonSeparatorItems).toHaveLength(2);
	});
});

// ── editFeaturesMenu ────────────────────────────────────────────────

describe("editFeaturesMenu", () => {
	it("calls runMenu with 'Edit Features' title", async () => {
		const instance = makeInstance();

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		expect(mockRunMenu).toHaveBeenCalledWith("Edit Features", expect.any(Array));
	});

	it("lists existing features as menu items", async () => {
		const instance = makeInstance({ features: ["dark-mode", "responsive"] });

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].key).toBe("1");
		expect(items[0].label).toBe("dark-mode");
		expect(items[1].key).toBe("2");
		expect(items[1].label).toBe("responsive");
	});

	it("shows Add Feature item with key 'n'", async () => {
		const instance = makeInstance();

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		expect(addItem!.label).toBe("Add Feature");
	});

	it("shows Back item with key 'b' that returns 'main'", async () => {
		const instance = makeInstance();

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("removes a feature when user confirms", async () => {
		const instance = makeInstance({ features: ["dark-mode"] });
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue();

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockInput.askYesNo).toHaveBeenCalledWith('Remove feature "dark-mode"?');
		expect(mockRemoveFeature).toHaveBeenCalledWith(instance, "dark-mode");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, undefined);
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("does not remove a feature when user declines", async () => {
		const instance = makeInstance({ features: ["dark-mode"] });
		mockInput.askYesNo.mockResolvedValue(false);

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveFeature).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("adds a feature when user provides a name", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValue("dark-mode");
		mockInput.waitForEnter.mockResolvedValue();

		await editFeaturesMenu("/project", "button", instance, "ui", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockInput.ask).toHaveBeenCalledWith("Feature tag (e.g. dark-mode)");
		expect(mockAddFeature).toHaveBeenCalledWith(instance, "dark-mode");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, "ui");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("does not add a feature when user provides empty input", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValue("");

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddFeature).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("handles undefined features", async () => {
		const instance = makeInstance();

		await editFeaturesMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const nonSeparatorItems = items.filter((i: any) => !i.separator);
		expect(nonSeparatorItems).toHaveLength(2); // Add Feature + Back
	});
});

// ── editRelationshipsMenu ───────────────────────────────────────────

describe("editRelationshipsMenu", () => {
	it("calls runMenu with 'Edit Relationships' title", async () => {
		const instance = makeInstance();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		expect(mockRunMenu).toHaveBeenCalledWith("Edit Relationships", expect.any(Array));
	});

	it("lists existing relationships as menu items", async () => {
		const instance = makeInstance({
			relationships: [
				{ target: "input", type: "uses" },
				{ target: "api", type: "calls", technology: "REST" },
			],
		});

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		expect(items[0].key).toBe("1");
		expect(items[0].label).toContain("input");
		expect(items[0].label).toContain("uses");
		expect(items[1].key).toBe("2");
		expect(items[1].label).toContain("api");
		expect(items[1].label).toContain("calls");
		expect(items[1].label).toContain("REST");
	});

	it("shows Add Relationship item with key 'n'", async () => {
		const instance = makeInstance();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		expect(addItem).toBeDefined();
		expect(addItem!.label).toBe("Add Relationship");
	});

	it("shows Back item with key 'b' that returns 'main'", async () => {
		const instance = makeInstance();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const backItem = items.find((i: any) => i.key === "b");
		expect(backItem).toBeDefined();
		expect(backItem!.action()).toBe("main");
	});

	it("removes a relationship when user confirms", async () => {
		const instance = makeInstance({
			relationships: [{ target: "input", type: "uses" }],
		});
		mockInput.askYesNo.mockResolvedValue(true);
		mockInput.waitForEnter.mockResolvedValue();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockInput.askYesNo).toHaveBeenCalledWith('Remove relationship to "input" (uses)?');
		expect(mockRemoveRelationship).toHaveBeenCalledWith(instance, "input", "uses");
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, undefined);
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("does not remove a relationship when user declines", async () => {
		const instance = makeInstance({
			relationships: [{ target: "input", type: "uses" }],
		});
		mockInput.askYesNo.mockResolvedValue(false);

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		await (items[0] as any).action();

		expect(mockRemoveRelationship).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("adds a relationship with type and no technology", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("input")   // target
			.mockResolvedValueOnce("1")       // type: uses
			.mockResolvedValueOnce("");        // technology: empty
		mockInput.waitForEnter.mockResolvedValue();

		await editRelationshipsMenu("/project", "button", instance, "core", testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockInput.ask).toHaveBeenCalledWith("Target component name");
		expect(mockInput.ask).toHaveBeenCalledWith("Type number (1-5)", "1");
		expect(mockInput.ask).toHaveBeenCalledWith("Technology (optional, e.g. REST, gRPC)", "");
		expect(mockAddRelationship).toHaveBeenCalledWith(instance, { target: "input", type: "uses" });
		expect(mockWriteInstance).toHaveBeenCalledWith("/project", "button", instance, testDeps, "core");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("adds a relationship with technology", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("api-service")  // target
			.mockResolvedValueOnce("2")            // type: calls
			.mockResolvedValueOnce("gRPC");        // technology
		mockInput.waitForEnter.mockResolvedValue();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddRelationship).toHaveBeenCalledWith(instance, { target: "api-service", type: "calls", technology: "gRPC" });
		expect(mockWriteInstance).toHaveBeenCalled();
	});

	it("does not add a relationship when target is empty", async () => {
		const instance = makeInstance();
		mockInput.ask.mockResolvedValueOnce("");  // empty target

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddRelationship).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("does not add a relationship when type number is invalid (0)", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("input")   // target
			.mockResolvedValueOnce("0");      // invalid type

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddRelationship).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("does not add a relationship when type number is out of range (6)", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("input")   // target
			.mockResolvedValueOnce("6");      // out of range

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		expect(mockAddRelationship).not.toHaveBeenCalled();
		expect(mockWriteInstance).not.toHaveBeenCalled();
	});

	it("selects correct relationship type for each valid number", async () => {
		const expectedTypes = ["uses", "calls", "depends-on", "sends-data-to", "receives-data-from"];

		for (let i = 0; i < expectedTypes.length; i++) {
			vi.clearAllMocks();
			mockRunMenu.mockResolvedValue("main");

			const instance = makeInstance();
			mockInput.ask
				.mockResolvedValueOnce("target")        // target
				.mockResolvedValueOnce(String(i + 1))   // type number
				.mockResolvedValueOnce("");             // no technology
			mockInput.waitForEnter.mockResolvedValue();

			await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

			const [, items] = mockRunMenu.mock.calls[0];
			const addItem = items.find((it: any) => it.key === "n");
			await (addItem as any).action();

			expect(mockAddRelationship).toHaveBeenCalledWith(instance, { target: "target", type: expectedTypes[i] });
		}
	});

	it("logs relationship types when adding", async () => {
		const instance = makeInstance();
		mockInput.ask
			.mockResolvedValueOnce("input")
			.mockResolvedValueOnce("1")
			.mockResolvedValueOnce("");
		mockInput.waitForEnter.mockResolvedValue();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const addItem = items.find((i: any) => i.key === "n");
		await (addItem as any).action();

		const output = mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
		expect(output).toContain("Relationship types");
		expect(output).toContain("uses");
		expect(output).toContain("calls");
		expect(output).toContain("depends-on");
	});

	it("handles undefined relationships", async () => {
		const instance = makeInstance();

		await editRelationshipsMenu("/project", "button", instance, undefined, testDeps);

		const [, items] = mockRunMenu.mock.calls[0];
		const nonSeparatorItems = items.filter((i: any) => !i.separator);
		expect(nonSeparatorItems).toHaveLength(2); // Add Relationship + Back
	});
});
