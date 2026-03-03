// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { attachEventSuggest } from "../../../src/ui/journeyBuilder/EventSuggest";

// ── Helpers ──────────────────────────────────────────────

function createInput(): HTMLInputElement {
	const wrapper = document.createElement("div");
	const input = document.createElement("input");
	input.type = "text";
	wrapper.appendChild(input);
	document.body.appendChild(wrapper);
	return input;
}

function setInputValue(input: HTMLInputElement, value: string): void {
	input.value = value;
	input.dispatchEvent(new Event("input", { bubbles: true }));
}

function getDropdown(input: HTMLInputElement): HTMLElement | null {
	return input.parentElement!.querySelector("[data-test-id='jb-autocomplete-dropdown']");
}

function getItems(input: HTMLInputElement): HTMLElement[] {
	const dropdown = getDropdown(input);
	if (!dropdown) return [];
	return Array.from(dropdown.querySelectorAll("[data-test-id='jb-autocomplete-item']"));
}

const SAMPLE_EVENTS = [
	"hub.tab.changed",
	"hub.opened",
	"user.created",
	"user.updated",
	"user.deleted",
	"session.started",
	"session.ended",
	"settings.changed",
	"ingestion.job.queued",
	"ingestion.job.started",
	"ingestion.job.completed",
	"ingestion.batch.started",
];

// ── Tests ────────────────────────────────────────────────

describe("EventSuggest", () => {
	let input: HTMLInputElement;
	let onSelect: ReturnType<typeof vi.fn<(value: string) => void>>;
	let unsub: () => void;

	beforeEach(() => {
		input = createInput();
		onSelect = vi.fn<(value: string) => void>();
		unsub = attachEventSuggest(input, () => SAMPLE_EVENTS, onSelect);
	});

	describe("dropdown visibility", () => {
		it("shows dropdown when typing a matching query", () => {
			setInputValue(input, "hub");
			expect(getDropdown(input)).toBeTruthy();
		});

		it("does not show dropdown for empty input", () => {
			setInputValue(input, "");
			expect(getDropdown(input)).toBeNull();
		});

		it("does not show dropdown for whitespace-only input", () => {
			setInputValue(input, "   ");
			expect(getDropdown(input)).toBeNull();
		});

		it("does not show dropdown when no items match", () => {
			setInputValue(input, "zzzzz");
			expect(getDropdown(input)).toBeNull();
		});

		it("hides dropdown on Escape key", () => {
			setInputValue(input, "hub");
			expect(getDropdown(input)).toBeTruthy();
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
			expect(getDropdown(input)).toBeNull();
		});
	});

	describe("filtering", () => {
		it("filters items by case-insensitive substring match", () => {
			setInputValue(input, "HUB");
			const items = getItems(input);
			expect(items.length).toBe(2);
			expect(items[0].textContent).toBe("hub.tab.changed");
			expect(items[1].textContent).toBe("hub.opened");
		});

		it("limits results to 10 items", () => {
			setInputValue(input, ".");
			const items = getItems(input);
			expect(items.length).toBe(10);
		});

		it("matches partial segments", () => {
			setInputValue(input, "job");
			const items = getItems(input);
			expect(items.length).toBe(3);
		});
	});

	describe("item rendering", () => {
		it("renders items with correct CSS class", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			expect(items.length).toBe(2);
			for (const item of items) {
				expect(item.classList.contains("ft-jb-autocomplete-item")).toBe(true);
			}
		});

		it("renders dropdown with correct CSS class", () => {
			setInputValue(input, "hub");
			const dropdown = getDropdown(input);
			expect(dropdown!.classList.contains("ft-jb-autocomplete-dropdown")).toBe(true);
		});

		it("adds anchor class to input parent", () => {
			setInputValue(input, "hub");
			expect(input.parentElement!.classList.contains("ft-jb-autocomplete-anchor")).toBe(true);
		});
	});

	describe("keyboard navigation", () => {
		it("ArrowDown highlights the first item", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			const items = getItems(input);
			expect(items[0].style.background).toBe("var(--background-modifier-hover)");
		});

		it("ArrowDown then ArrowUp keeps first item highlighted", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
			const items = getItems(input);
			expect(items[0].style.background).toBe("var(--background-modifier-hover)");
		});

		it("Enter selects highlighted item", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(onSelect).toHaveBeenCalledWith("hub.tab.changed");
			expect(input.value).toBe("hub.tab.changed");
		});

		it("Enter does nothing when no item is highlighted", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(onSelect).not.toHaveBeenCalled();
		});

		it("ArrowDown does not go past last item", () => {
			setInputValue(input, "hub");
			for (let i = 0; i < 10; i++) {
				input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			}
			const items = getItems(input);
			expect(items[items.length - 1].style.background).toBe("var(--background-modifier-hover)");
		});
	});

	describe("mouse selection", () => {
		it("mousedown on item selects it", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
			expect(onSelect).toHaveBeenCalledWith("session.started");
			expect(input.value).toBe("session.started");
		});

		it("mousedown hides dropdown", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
			expect(getDropdown(input)).toBeNull();
		});
	});

	describe("input event dispatch", () => {
		it("dispatches input event on selection so existing listeners fire", () => {
			const inputSpy = vi.fn();
			input.addEventListener("input", inputSpy);
			setInputValue(input, "hub");
			inputSpy.mockClear();

			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(inputSpy).toHaveBeenCalled();
		});
	});

	describe("unsubscribe", () => {
		it("removes all listeners and cleans up dropdown", () => {
			setInputValue(input, "hub");
			expect(getDropdown(input)).toBeTruthy();
			unsub();
			expect(getDropdown(input)).toBeNull();
		});

		it("input events no longer show dropdown after unsubscribe", () => {
			unsub();
			setInputValue(input, "hub");
			expect(getDropdown(input)).toBeNull();
		});
	});
});
