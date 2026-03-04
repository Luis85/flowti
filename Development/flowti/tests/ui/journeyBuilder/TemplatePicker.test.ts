// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { TemplatePicker } from "../../../src/ui/journeyBuilder/TemplatePicker";
import type { TemplatePickerDeps } from "../../../src/ui/journeyBuilder/TemplatePicker";
import { ACTION_TEMPLATES } from "../../../src/domain/journeyBuilder/types";

function byTestId(root: HTMLElement, id: string): HTMLElement | null {
	return root.querySelector(`[data-test-id="${id}"]`);
}

function allByTestId(root: HTMLElement, id: string): HTMLElement[] {
	return Array.from(root.querySelectorAll(`[data-test-id="${id}"]`)) as HTMLElement[];
}

describe("TemplatePicker", () => {
	let container: HTMLDivElement;
	let deps: TemplatePickerDeps;

	beforeEach(() => {
		container = document.createElement("div");
		deps = {
			onTemplateSelected: vi.fn(),
			onCustom: vi.fn(),
		};
	});

	it("renders picker wrapper", () => {
		new TemplatePicker(container, deps).render();
		expect(byTestId(container, "jb-template-picker")).toBeTruthy();
	});

	it("renders 4 template cards plus Custom", () => {
		new TemplatePicker(container, deps).render();
		const cards = allByTestId(container, "jb-template-card");
		expect(cards).toHaveLength(4);
		expect(byTestId(container, "jb-template-custom")).toBeTruthy();
	});

	it("renders correct labels for each template", () => {
		new TemplatePicker(container, deps).render();
		const labels = allByTestId(container, "jb-template-label");
		expect(labels.map((l) => l.textContent)).toEqual(
			ACTION_TEMPLATES.map((t) => t.label),
		);
	});

	it("renders descriptions for each template", () => {
		new TemplatePicker(container, deps).render();
		const descs = allByTestId(container, "jb-template-desc");
		expect(descs).toHaveLength(ACTION_TEMPLATES.length);
		for (const desc of descs) {
			expect(desc.textContent!.length).toBeGreaterThan(0);
		}
	});

	it("calls onTemplateSelected with correct id on click", () => {
		new TemplatePicker(container, deps).render();
		const cards = allByTestId(container, "jb-template-card");
		cards[0].click();
		expect(deps.onTemplateSelected).toHaveBeenCalledWith("open-command");
	});

	it("calls onTemplateSelected for each template id", () => {
		new TemplatePicker(container, deps).render();
		const cards = allByTestId(container, "jb-template-card");
		for (let i = 0; i < cards.length; i++) {
			cards[i].click();
			expect(deps.onTemplateSelected).toHaveBeenCalledWith(ACTION_TEMPLATES[i].id);
		}
	});

	it("calls onCustom when Custom card is clicked", () => {
		new TemplatePicker(container, deps).render();
		byTestId(container, "jb-template-custom")!.click();
		expect(deps.onCustom).toHaveBeenCalledOnce();
	});

	it("supports keyboard activation on template card (Enter)", () => {
		new TemplatePicker(container, deps).render();
		const card = allByTestId(container, "jb-template-card")[1];
		card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
		expect(deps.onTemplateSelected).toHaveBeenCalledWith("click-element");
	});

	it("supports keyboard activation on template card (Space)", () => {
		new TemplatePicker(container, deps).render();
		const card = allByTestId(container, "jb-template-card")[2];
		card.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
		expect(deps.onTemplateSelected).toHaveBeenCalledWith("verify-visible");
	});

	it("supports keyboard activation on Custom card", () => {
		new TemplatePicker(container, deps).render();
		byTestId(container, "jb-template-custom")!.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
		);
		expect(deps.onCustom).toHaveBeenCalledOnce();
	});

	it("template cards have role=button and tabindex", () => {
		new TemplatePicker(container, deps).render();
		const cards = allByTestId(container, "jb-template-card");
		for (const card of cards) {
			expect(card.getAttribute("role")).toBe("button");
			expect(card.tabIndex).toBe(0);
		}
		const custom = byTestId(container, "jb-template-custom")!;
		expect(custom.getAttribute("role")).toBe("button");
		expect(custom.tabIndex).toBe(0);
	});

	it("stores template id as data attribute", () => {
		new TemplatePicker(container, deps).render();
		const cards = allByTestId(container, "jb-template-card");
		expect(cards[0].dataset.templateId).toBe("open-command");
		expect(cards[3].dataset.templateId).toBe("take-screenshot");
	});
});
