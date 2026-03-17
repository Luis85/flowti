// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { attachEventSuggest } from "../../../src/ui/journeyBuilder/EventSuggest";
import type { EventSuggestItem } from "../../../src/ui/journeyBuilder/EventSuggestTypes";

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

function focusInput(input: HTMLInputElement): void {
	input.dispatchEvent(new Event("focus", { bubbles: true }));
}

function getDropdown(input: HTMLInputElement): HTMLElement | null {
	return input.parentElement!.querySelector("[data-test-id='jb-autocomplete-dropdown']");
}

function getItems(input: HTMLInputElement): HTMLElement[] {
	const dropdown = getDropdown(input);
	if (!dropdown) return [];
	return Array.from(dropdown.querySelectorAll("[data-test-id='jb-autocomplete-item']"));
}

function getNameText(item: HTMLElement): string {
	return item.querySelector(".ft-jb-autocomplete-name")?.textContent ?? "";
}

function getBadgeText(item: HTMLElement): string {
	return item.querySelector(".ft-jb-autocomplete-badge")?.textContent ?? "";
}

function getDescText(item: HTMLElement): string {
	return item.querySelector(".ft-jb-autocomplete-desc")?.textContent ?? "";
}

const SAMPLE_EVENTS: EventSuggestItem[] = [
	{ type: "hub.tab.changed", category: "Hub", description: "A hub tab was switched" },
	{ type: "hub.opened", category: "Hub", description: "A hub view was opened" },
	{ type: "user.created", category: "User", description: "A new user was created" },
	{ type: "user.updated", category: "User", description: "A user profile was updated" },
	{ type: "user.deleted", category: "User", description: "A user was deleted" },
	{ type: "session.started", category: "Session", description: "A session was started" },
	{ type: "session.ended", category: "Session", description: "A session ended" },
	{ type: "settings.changed", category: "Settings", description: "Settings were changed" },
	{ type: "ingestion.job.queued", category: "Ingestion", description: "A job was queued" },
	{ type: "ingestion.job.started", category: "Ingestion", description: "A job was started" },
	{ type: "ingestion.job.completed", category: "Ingestion", description: "A job completed" },
	{ type: "ingestion.batch.started", category: "Ingestion", description: "A batch was started" },
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

		it("shows dropdown on focus with empty input", () => {
			focusInput(input);
			expect(getDropdown(input)).toBeTruthy();
			expect(getItems(input).length).toBe(10);
		});

		it("shows dropdown on focus with top 10 items alphabetically", () => {
			focusInput(input);
			const items = getItems(input);
			const firstType = getNameText(items[0]);
			const secondType = getNameText(items[1]);
			expect(firstType.localeCompare(secondType)).toBeLessThanOrEqual(0);
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

	describe("fuzzy matching", () => {
		it("matches by prefix", () => {
			setInputValue(input, "hub");
			const items = getItems(input);
			expect(items.length).toBe(2);
			expect(getNameText(items[0])).toMatch(/^hub\./);
		});

		it("matches segment prefix", () => {
			setInputValue(input, "job");
			const items = getItems(input);
			expect(items.length).toBe(3);
		});

		it("matches by subsequence across segments", () => {
			setInputValue(input, "htc");
			const items = getItems(input);
			expect(items.length).toBeGreaterThan(0);
			expect(getNameText(items[0])).toBe("hub.tab.changed");
		});

		it("is case-insensitive", () => {
			setInputValue(input, "HUB");
			const items = getItems(input);
			expect(items.length).toBe(2);
		});

		it("limits results to 10 items", () => {
			setInputValue(input, "e");
			const items = getItems(input);
			expect(items.length).toBeLessThanOrEqual(10);
		});

		it("ranks exact match first", () => {
			setInputValue(input, "hub.opened");
			const items = getItems(input);
			expect(getNameText(items[0])).toBe("hub.opened");
		});
	});

	describe("rich item rendering", () => {
		it("renders event name in .ft-jb-autocomplete-name", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			expect(items.length).toBeGreaterThan(0);
			expect(getNameText(items[0])).toMatch(/^session\./);
		});

		it("renders category badge in .ft-jb-autocomplete-badge", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			expect(getBadgeText(items[0])).toBe("Session");
		});

		it("renders description in .ft-jb-autocomplete-desc", () => {
			setInputValue(input, "session.started");
			const items = getItems(input);
			expect(getDescText(items[0])).toBe("A session was started");
		});

		it("renders items with correct CSS class", () => {
			setInputValue(input, "session");
			const items = getItems(input);
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
			expect(items[0].classList.contains("is-highlighted")).toBe(true);
		});

		it("ArrowDown then ArrowUp keeps first item highlighted", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }));
			const items = getItems(input);
			expect(items[0].classList.contains("is-highlighted")).toBe(true);
		});

		it("Enter selects highlighted item", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			expect(onSelect).toHaveBeenCalled();
			expect(input.value).toMatch(/^hub\./);
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
			expect(items[items.length - 1].classList.contains("is-highlighted")).toBe(true);
		});
	});

	describe("mouse selection", () => {
		it("mousedown on item selects it", () => {
			setInputValue(input, "session");
			const items = getItems(input);
			items[0].dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
			expect(onSelect).toHaveBeenCalled();
			expect(input.value).toMatch(/^session\./);
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

		it("does not re-open dropdown from synthetic input event after selection", () => {
			setInputValue(input, "hub");
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
			input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
			// The synthetic input event should be skipped
			expect(getDropdown(input)).toBeNull();
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

		it("focus events no longer show dropdown after unsubscribe", () => {
			unsub();
			focusInput(input);
			expect(getDropdown(input)).toBeNull();
		});
	});
});
