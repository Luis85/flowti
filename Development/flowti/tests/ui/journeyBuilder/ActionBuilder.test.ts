// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { ActionList } from "../../../src/ui/journeyBuilder/ActionList";
import { ToolPicker } from "../../../src/ui/journeyBuilder/ToolPicker";
import { ActionForm } from "../../../src/ui/journeyBuilder/ActionForm";
import { TOOL_SCHEMAS, TOOL_CATEGORIES } from "../../../src/domain/journeyBuilder/toolSchemas";
import type { JourneyAction, JourneyToolName } from "../../../src/domain/journeyBuilder/types";

// ── Helpers ──────────────────────────────────────────────

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function allByTestId(root: HTMLElement, id: string): HTMLElement[] {
	return Array.from(root.querySelectorAll(`[data-test-id="${id}"]`));
}

function createContainer(): HTMLElement {
	return document.createElement("div");
}

// ── ActionList ───────────────────────────────────────────

describe("ActionList", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders empty list with add button when no actions", () => {
		new ActionList(container, {
			actions: [],
			selectedIndex: -1,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		expect(byTestId(container, "jb-action-list")).toBeTruthy();
		expect(allByTestId(container, "jb-action-card")).toHaveLength(0);
		expect(byTestId(container, "jb-add-action-btn")).toBeTruthy();
	});

	it("renders action cards for each action", () => {
		const actions: JourneyAction[] = [
			{ tool: "click", selector: ".btn" },
			{ tool: "wait", ms: 500 },
			{ tool: "assert", type: "visible", selector: ".result" },
		];

		new ActionList(container, {
			actions,
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		expect(allByTestId(container, "jb-action-card")).toHaveLength(3);
	});

	it("shows tool badge with schema label", () => {
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".btn" }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const badge = byTestId(container, "jb-action-tool-badge");
		expect(badge!.textContent).toBe("Click");
	});

	it("shows summary from first required field value", () => {
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".my-button" }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const card = byTestId(container, "jb-action-card")!;
		const summary = card.querySelector(".ft-jb-action-summary");
		expect(summary!.textContent).toBe(".my-button");
	});

	it("shows description as summary when present", () => {
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".btn", description: "Click the submit button" }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const card = byTestId(container, "jb-action-card")!;
		const summary = card.querySelector(".ft-jb-action-summary");
		expect(summary!.textContent).toBe("Click the submit button");
	});

	it("marks selected action with is-selected class", () => {
		const actions: JourneyAction[] = [
			{ tool: "click", selector: ".a" },
			{ tool: "wait", ms: 100 },
		];

		new ActionList(container, {
			actions,
			selectedIndex: 1,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const cards = allByTestId(container, "jb-action-card");
		expect(cards[0].classList.contains("is-selected")).toBe(false);
		expect(cards[1].classList.contains("is-selected")).toBe(true);
	});

	it("disables up button on first action", () => {
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".a" }, { tool: "wait", ms: 100 }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const upBtns = allByTestId(container, "jb-action-move-up");
		expect(upBtns[0].classList.contains("is-disabled")).toBe(true);
		expect(upBtns[0].getAttribute("tabindex")).toBe("-1");
		expect(upBtns[1].classList.contains("is-disabled")).toBe(false);
	});

	it("disables down button on last action", () => {
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".a" }, { tool: "wait", ms: 100 }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const downBtns = allByTestId(container, "jb-action-move-down");
		expect(downBtns[0].classList.contains("is-disabled")).toBe(false);
		expect(downBtns[1].classList.contains("is-disabled")).toBe(true);
		expect(downBtns[1].getAttribute("tabindex")).toBe("-1");
	});

	it("calls onAddAction when add button is clicked", () => {
		const onAddAction = vi.fn();
		new ActionList(container, {
			actions: [],
			selectedIndex: -1,
			onAddAction,
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		byTestId(container, "jb-add-action-btn")!.click();
		expect(onAddAction).toHaveBeenCalledOnce();
	});

	it("calls onAddAction on keyboard Enter", () => {
		const onAddAction = vi.fn();
		new ActionList(container, {
			actions: [],
			selectedIndex: -1,
			onAddAction,
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		byTestId(container, "jb-add-action-btn")!.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		expect(onAddAction).toHaveBeenCalledOnce();
	});

	it("calls onRemoveAction with correct index", () => {
		const onRemoveAction = vi.fn();
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".a" }, { tool: "wait", ms: 100 }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction,
			onMoveAction: vi.fn(),
			onSelectAction: vi.fn(),
		}).render();

		const removeBtns = allByTestId(container, "jb-action-remove");
		removeBtns[1].click();
		expect(onRemoveAction).toHaveBeenCalledWith(1);
	});

	it("calls onMoveAction with correct index and direction", () => {
		const onMoveAction = vi.fn();
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".a" }, { tool: "wait", ms: 100 }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction,
			onSelectAction: vi.fn(),
		}).render();

		// Move second action up
		const upBtns = allByTestId(container, "jb-action-move-up");
		upBtns[1].click();
		expect(onMoveAction).toHaveBeenCalledWith(1, "up");

		// Move first action down
		const downBtns = allByTestId(container, "jb-action-move-down");
		downBtns[0].click();
		expect(onMoveAction).toHaveBeenCalledWith(0, "down");
	});

	it("calls onSelectAction when card is clicked", () => {
		const onSelectAction = vi.fn();
		new ActionList(container, {
			actions: [{ tool: "click", selector: ".a" }, { tool: "wait", ms: 100 }],
			selectedIndex: 0,
			onAddAction: vi.fn(),
			onRemoveAction: vi.fn(),
			onMoveAction: vi.fn(),
			onSelectAction,
		}).render();

		const cards = allByTestId(container, "jb-action-card");
		cards[1].click();
		expect(onSelectAction).toHaveBeenCalledWith(1);
	});
});

// ── ToolPicker ───────────────────────────────────────────

describe("ToolPicker", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders a select element", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		expect(select).toBeTruthy();
		expect(select.tagName.toLowerCase()).toBe("select");
	});

	it("has a disabled placeholder option", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		const firstOption = select.options[0];
		expect(firstOption.textContent).toContain("Select a tool");
		expect(firstOption.disabled).toBe(true);
	});

	it("has optgroup for each category", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		const groups = select.querySelectorAll("optgroup");
		expect(groups).toHaveLength(TOOL_CATEGORIES.length);
	});

	it("optgroups are labeled by category", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		const groups = Array.from(select.querySelectorAll("optgroup"));
		const labels = groups.map((g) => g.label);
		expect(labels).toEqual(TOOL_CATEGORIES.map((c) => c.label));
	});

	it("has options for all 34 tools", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		// total options = 1 placeholder + 34 tools
		const toolOptions = Array.from(select.querySelectorAll("optgroup option"));
		expect(toolOptions).toHaveLength(34);
	});

	it("option values match tool names", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		const toolOptions = Array.from(select.querySelectorAll("optgroup option"));
		const values = new Set(toolOptions.map((o) => (o as HTMLOptionElement).value));
		for (const name of Object.keys(TOOL_SCHEMAS)) {
			expect(values.has(name), `missing option for ${name}`).toBe(true);
		}
	});

	it("calls onToolSelected when a tool is chosen", () => {
		const onToolSelected = vi.fn();
		new ToolPicker(container, { onToolSelected }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		select.value = "click";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(onToolSelected).toHaveBeenCalledWith("click");
	});

	it("resets to empty value after selection", () => {
		new ToolPicker(container, { onToolSelected: vi.fn() }).render();

		const select = byTestId(container, "jb-tool-select") as HTMLSelectElement;
		select.value = "wait";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(select.value).toBe("");
	});
});

// ── ActionForm ───────────────────────────────────────────

describe("ActionForm", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders form container with test-id", () => {
		new ActionForm(container, {
			action: { tool: "command", id: "" },
			schema: TOOL_SCHEMAS.command,
			onFieldChanged: vi.fn(),
		}).render();

		expect(byTestId(container, "jb-action-form")).toBeTruthy();
	});

	it("renders a field for each schema field", () => {
		new ActionForm(container, {
			action: { tool: "click", selector: "" },
			schema: TOOL_SCHEMAS.click,
			onFieldChanged: vi.fn(),
		}).render();

		// click has 1 field (selector) + 1 description = 2 fields total
		expect(byTestId(container, "jb-action-field-selector")).toBeTruthy();
		expect(byTestId(container, "jb-action-field-description")).toBeTruthy();
	});

	it("renders text inputs for text fields", () => {
		new ActionForm(container, {
			action: { tool: "command", id: "" },
			schema: TOOL_SCHEMAS.command,
			onFieldChanged: vi.fn(),
		}).render();

		const input = byTestId(container, "jb-action-field-id") as HTMLInputElement;
		expect(input.tagName.toLowerCase()).toBe("input");
		expect(input.type).toBe("text");
	});

	it("renders number inputs for number fields", () => {
		new ActionForm(container, {
			action: { tool: "wait", ms: 500 },
			schema: TOOL_SCHEMAS.wait,
			onFieldChanged: vi.fn(),
		}).render();

		const input = byTestId(container, "jb-action-field-ms") as HTMLInputElement;
		expect(input.tagName.toLowerCase()).toBe("input");
		expect(input.type).toBe("number");
	});

	it("renders select for select fields", () => {
		new ActionForm(container, {
			action: { tool: "assert-number", operator: "eq" },
			schema: TOOL_SCHEMAS["assert-number"],
			onFieldChanged: vi.fn(),
		}).render();

		const select = byTestId(container, "jb-action-field-operator") as HTMLSelectElement;
		expect(select.tagName.toLowerCase()).toBe("select");
	});

	it("renders textarea for textarea fields", () => {
		new ActionForm(container, {
			action: { tool: "eval", code: "" },
			schema: TOOL_SCHEMAS.eval,
			onFieldChanged: vi.fn(),
		}).render();

		const textarea = byTestId(container, "jb-action-field-code") as HTMLTextAreaElement;
		expect(textarea.tagName.toLowerCase()).toBe("textarea");
	});

	it("pre-fills field values from action", () => {
		new ActionForm(container, {
			action: { tool: "click", selector: ".my-button" },
			schema: TOOL_SCHEMAS.click,
			onFieldChanged: vi.fn(),
		}).render();

		const input = byTestId(container, "jb-action-field-selector") as HTMLInputElement;
		expect(input.value).toBe(".my-button");
	});

	it("shows asterisk on required field labels", () => {
		new ActionForm(container, {
			action: { tool: "click", selector: "" },
			schema: TOOL_SCHEMAS.click,
			onFieldChanged: vi.fn(),
		}).render();

		const label = byTestId(container, "jb-action-label-selector");
		expect(label!.textContent).toContain("*");
	});

	it("always appends description field", () => {
		new ActionForm(container, {
			action: { tool: "close-modals", description: "Close all" },
			schema: TOOL_SCHEMAS["close-modals"],
			onFieldChanged: vi.fn(),
		}).render();

		// close-modals has 0 schema fields, but description should still appear
		const descInput = byTestId(container, "jb-action-field-description") as HTMLInputElement;
		expect(descInput).toBeTruthy();
		expect(descInput.value).toBe("Close all");
	});

	it("calls onFieldChanged when text input changes", () => {
		const onFieldChanged = vi.fn();
		new ActionForm(container, {
			action: { tool: "click", selector: "" },
			schema: TOOL_SCHEMAS.click,
			onFieldChanged,
		}).render();

		const input = byTestId(container, "jb-action-field-selector") as HTMLInputElement;
		input.value = ".new-selector";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(onFieldChanged).toHaveBeenCalledWith("selector", ".new-selector");
	});

	it("calls onFieldChanged with number for number input", () => {
		const onFieldChanged = vi.fn();
		new ActionForm(container, {
			action: { tool: "wait", ms: 0 },
			schema: TOOL_SCHEMAS.wait,
			onFieldChanged,
		}).render();

		const input = byTestId(container, "jb-action-field-ms") as HTMLInputElement;
		input.value = "1000";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(onFieldChanged).toHaveBeenCalledWith("ms", 1000);
	});

	it("calls onFieldChanged when select changes", () => {
		const onFieldChanged = vi.fn();
		new ActionForm(container, {
			action: { tool: "assert-number", operator: "" },
			schema: TOOL_SCHEMAS["assert-number"],
			onFieldChanged,
		}).render();

		const select = byTestId(container, "jb-action-field-operator") as HTMLSelectElement;
		select.value = "gt";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(onFieldChanged).toHaveBeenCalledWith("operator", "gt");
	});

	it("calls onFieldChanged when description changes", () => {
		const onFieldChanged = vi.fn();
		new ActionForm(container, {
			action: { tool: "click", selector: "" },
			schema: TOOL_SCHEMAS.click,
			onFieldChanged,
		}).render();

		const input = byTestId(container, "jb-action-field-description") as HTMLInputElement;
		input.value = "Click the submit button";
		input.dispatchEvent(new Event("input", { bubbles: true }));
		expect(onFieldChanged).toHaveBeenCalledWith("description", "Click the submit button");
	});

	// ── Conditional field visibility (visibleWhen) ───────

	describe("conditional field visibility", () => {
		it("shows only selector when assert type is visible", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "visible" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-selector")).toBeTruthy();
			expect(byTestId(container, "jb-action-field-contains")).toBeNull();
			expect(byTestId(container, "jb-action-field-event")).toBeNull();
			expect(byTestId(container, "jb-action-field-code")).toBeNull();
		});

		it("shows selector and contains when assert type is text", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "text" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-selector")).toBeTruthy();
			expect(byTestId(container, "jb-action-field-contains")).toBeTruthy();
			expect(byTestId(container, "jb-action-field-event")).toBeNull();
		});

		it("shows only event field when assert type is event", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "event" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-event-suggest-input")).toBeNull();
			expect(byTestId(container, "jb-action-field-selector")).toBeNull();
			// event field rendered but without suggest (no getEventCatalog)
			const eventFields = container.querySelectorAll(".ft-jb-form-group");
			expect(eventFields.length).toBeGreaterThan(0);
		});

		it("shows event field with jb-event-suggest-input test-id when getEventCatalog provided", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "event" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
				getEventCatalog: () => [
					{ type: "hub.opened", category: "Hub", description: "Hub was opened" },
					{ type: "user.created", category: "User", description: "User was created" },
				],
			}).render();

			expect(byTestId(container, "jb-event-suggest-input")).toBeTruthy();
		});

		it("shows code and expected when assert type is eval", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "eval" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-code")).toBeTruthy();
			expect(byTestId(container, "jb-action-field-expected")).toBeTruthy();
			expect(byTestId(container, "jb-action-field-selector")).toBeNull();
		});

		it("shows no conditional fields when assert type is empty", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-selector")).toBeNull();
			expect(byTestId(container, "jb-action-field-event")).toBeNull();
			expect(byTestId(container, "jb-action-field-code")).toBeNull();
		});

		it("does not affect tools without visibleWhen rules", () => {
			new ActionForm(container, {
				action: { tool: "click", selector: "" },
				schema: TOOL_SCHEMAS.click,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-selector")).toBeTruthy();
		});
	});

	// ── Assert type picker ──────────────────────────────

	describe("assert type picker", () => {
		it("renders type picker with all 8 types", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			const picker = byTestId(container, "jb-assert-type-picker");
			expect(picker).toBeTruthy();
			const btns = picker!.querySelectorAll(".ft-jb-assert-type-btn");
			expect(btns.length).toBe(8);
		});

		it("renders individual type buttons with correct test-ids", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-assert-type-visible")).toBeTruthy();
			expect(byTestId(container, "jb-assert-type-event")).toBeTruthy();
			expect(byTestId(container, "jb-assert-type-eval")).toBeTruthy();
			expect(byTestId(container, "jb-assert-type-attr")).toBeTruthy();
		});

		it("marks active type with is-active class", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "event" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			const eventBtn = byTestId(container, "jb-assert-type-event");
			expect(eventBtn!.classList.contains("is-active")).toBe(true);
			const visibleBtn = byTestId(container, "jb-assert-type-visible");
			expect(visibleBtn!.classList.contains("is-active")).toBe(false);
		});

		it("calls onFieldChanged and onReRender when type button clicked", () => {
			const onFieldChanged = vi.fn();
			const onReRender = vi.fn();
			new ActionForm(container, {
				action: { tool: "assert", type: "" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged,
				onReRender,
			}).render();

			const eventBtn = byTestId(container, "jb-assert-type-event");
			eventBtn!.click();
			expect(onFieldChanged).toHaveBeenCalledWith("type", "event");
			expect(onReRender).toHaveBeenCalled();
		});

		it("does not render type picker for non-assert tools", () => {
			new ActionForm(container, {
				action: { tool: "click", selector: "" },
				schema: TOOL_SCHEMAS.click,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-assert-type-picker")).toBeNull();
		});

		it("does not render standard type select for assert", () => {
			new ActionForm(container, {
				action: { tool: "assert", type: "visible" },
				schema: TOOL_SCHEMAS.assert,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-action-field-type")).toBeNull();
		});
	});

	// ── Command picker ──────────────────────────────────

	describe("command picker", () => {
		const mockCommands = [
			{ id: "flowti:open-user-hub", label: "Open User Hub" },
			{ id: "flowti:open-journey-builder", label: "Open Journey Builder" },
		];

		it("renders command picker when getCommands is provided", () => {
			new ActionForm(container, {
				action: { tool: "command", id: "" },
				schema: TOOL_SCHEMAS.command,
				onFieldChanged: vi.fn(),
				getCommands: () => mockCommands,
			}).render();

			expect(byTestId(container, "jb-command-picker")).toBeTruthy();
		});

		it("renders select with all commands", () => {
			new ActionForm(container, {
				action: { tool: "command", id: "" },
				schema: TOOL_SCHEMAS.command,
				onFieldChanged: vi.fn(),
				getCommands: () => mockCommands,
			}).render();

			const select = byTestId(container, "jb-action-field-id") as HTMLSelectElement;
			// empty option + 2 commands
			expect(select.options.length).toBe(3);
		});

		it("pre-selects current command", () => {
			new ActionForm(container, {
				action: { tool: "command", id: "flowti:open-user-hub" },
				schema: TOOL_SCHEMAS.command,
				onFieldChanged: vi.fn(),
				getCommands: () => mockCommands,
			}).render();

			const select = byTestId(container, "jb-action-field-id") as HTMLSelectElement;
			expect(select.value).toBe("flowti:open-user-hub");
		});

		it("calls onFieldChanged when command selected", () => {
			const onFieldChanged = vi.fn();
			new ActionForm(container, {
				action: { tool: "command", id: "" },
				schema: TOOL_SCHEMAS.command,
				onFieldChanged,
				getCommands: () => mockCommands,
			}).render();

			const select = byTestId(container, "jb-action-field-id") as HTMLSelectElement;
			select.value = "flowti:open-journey-builder";
			select.dispatchEvent(new Event("change", { bubbles: true }));
			expect(onFieldChanged).toHaveBeenCalledWith("id", "flowti:open-journey-builder");
		});

		it("renders plain text input without getCommands", () => {
			new ActionForm(container, {
				action: { tool: "command", id: "" },
				schema: TOOL_SCHEMAS.command,
				onFieldChanged: vi.fn(),
			}).render();

			expect(byTestId(container, "jb-command-picker")).toBeNull();
			const input = byTestId(container, "jb-action-field-id") as HTMLInputElement;
			expect(input.tagName.toLowerCase()).toBe("input");
		});

		it("does not render command picker for non-command tools", () => {
			new ActionForm(container, {
				action: { tool: "click", selector: "" },
				schema: TOOL_SCHEMAS.click,
				onFieldChanged: vi.fn(),
				getCommands: () => mockCommands,
			}).render();

			expect(byTestId(container, "jb-command-picker")).toBeNull();
		});
	});
});

// ── NavBar — setup button ───────────────────────────────

import { NavBar } from "../../../src/ui/journeyBuilder/NavBar";

describe("NavBar — setup button", () => {
	let container: HTMLElement;

	beforeEach(() => {
		container = createContainer();
	});

	it("renders setup button when onSetup provided", () => {
		new NavBar(container, {
			stepCount: 2,
			currentIndex: 0,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
			onSetup: vi.fn(),
		}).render();

		expect(byTestId(container, "jb-nav-setup")).toBeTruthy();
	});

	it("does not render setup button when onSetup is omitted", () => {
		new NavBar(container, {
			stepCount: 2,
			currentIndex: 0,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
		}).render();

		expect(byTestId(container, "jb-nav-setup")).toBeNull();
	});

	it("calls onSetup when setup button clicked", () => {
		const onSetup = vi.fn();
		new NavBar(container, {
			stepCount: 2,
			currentIndex: 0,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
			onSetup,
		}).render();

		byTestId(container, "jb-nav-setup")!.click();
		expect(onSetup).toHaveBeenCalledOnce();
	});

	it("setup button has correct role and tabindex", () => {
		new NavBar(container, {
			stepCount: 2,
			currentIndex: 0,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
			onSetup: vi.fn(),
		}).render();

		const btn = byTestId(container, "jb-nav-setup");
		expect(btn!.getAttribute("role")).toBe("button");
		expect(btn!.getAttribute("tabindex")).toBe("0");
	});

	it("setup button responds to Enter key", () => {
		const onSetup = vi.fn();
		new NavBar(container, {
			stepCount: 2,
			currentIndex: 0,
			onPrev: vi.fn(),
			onNext: vi.fn(),
			onAddStep: vi.fn(),
			onSetup,
		}).render();

		const btn = byTestId(container, "jb-nav-setup")!;
		btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(onSetup).toHaveBeenCalledOnce();
	});
});
