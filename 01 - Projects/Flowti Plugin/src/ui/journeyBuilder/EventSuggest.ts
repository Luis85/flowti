/**
 * EventSuggest — autocomplete for event name inputs with fuzzy matching,
 * category badges, and description subtitles.
 *
 * Decoupled from Obsidian APIs: takes a plain item getter and onSelect callback.
 */
import type { EventSuggestItem, ScoredEventItem } from "./EventSuggestTypes";
import { filterEvents } from "./fuzzyMatchEvent";

const MAX_RESULTS = 10;

/**
 * Attaches autocomplete behavior to a text input.
 * Shows a dropdown of matching items as the user types or on focus.
 *
 * @param input - The text input element to enhance
 * @param getItems - Callback returning the full list of available event items
 * @param onSelect - Called when the user selects an item from the dropdown
 * @returns Unsubscribe function that removes all listeners and cleans up
 */
export function attachEventSuggest(
	input: HTMLInputElement,
	getItems: () => EventSuggestItem[],
	onSelect: (value: string) => void,
): () => void {
	let dropdown: HTMLElement | null = null;
	let selectedIndex = -1;
	let currentMatches: ScoredEventItem[] = [];
	let skipNextInput = false;

	function hide(): void {
		if (dropdown) {
			dropdown.remove();
			dropdown = null;
		}
		selectedIndex = -1;
		currentMatches = [];
	}

	function highlightItem(index: number): void {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-jb-autocomplete-item");
		items.forEach((item, i) => {
			(item as HTMLElement).classList.toggle("is-highlighted", i === index);
		});
		selectedIndex = index;
		// Scroll highlighted item into view
		const highlighted = items[index] as HTMLElement | undefined;
		highlighted?.scrollIntoView({ block: "nearest" });
	}

	function selectItem(value: string): void {
		input.value = value;
		onSelect(value);
		hide();
		// Dispatch input event so existing listeners (e.g. Title Sentence conversion) fire
		skipNextInput = true;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	function show(matches: ScoredEventItem[]): void {
		hide();
		if (matches.length === 0) return;
		currentMatches = matches;

		dropdown = document.createElement("div");
		dropdown.className = "ft-jb-autocomplete-dropdown";
		dropdown.dataset.testId = "jb-autocomplete-dropdown";

		for (let i = 0; i < matches.length; i++) {
			const { item } = matches[i];

			const el = document.createElement("div");
			el.className = "ft-jb-autocomplete-item";
			el.dataset.testId = "jb-autocomplete-item";

			// Top row: event name + category badge
			const nameRow = document.createElement("div");
			nameRow.className = "ft-jb-autocomplete-name-row";

			const nameSpan = document.createElement("span");
			nameSpan.className = "ft-jb-autocomplete-name";
			nameSpan.textContent = item.type;
			nameRow.appendChild(nameSpan);

			if (item.category) {
				const badge = document.createElement("span");
				badge.className = "ft-jb-autocomplete-badge";
				badge.textContent = item.category;
				nameRow.appendChild(badge);
			}
			el.appendChild(nameRow);

			// Description subtitle
			if (item.description) {
				const desc = document.createElement("div");
				desc.className = "ft-jb-autocomplete-desc";
				desc.textContent = item.description;
				el.appendChild(desc);
			}

			el.addEventListener("mouseenter", () => highlightItem(i));
			el.addEventListener("mousedown", (e) => {
				e.preventDefault();
				selectItem(item.type);
			});
			dropdown.appendChild(el);
		}

		const wrapper = input.parentElement;
		if (wrapper) {
			wrapper.classList.add("ft-jb-autocomplete-anchor");
			wrapper.appendChild(dropdown);
		}
	}

	function update(): void {
		if (skipNextInput) {
			skipNextInput = false;
			return;
		}
		const query = input.value.trim();
		const items = getItems();
		const matches = filterEvents(items, query, MAX_RESULTS);
		show(matches);
	}

	const onInput = (): void => update();

	const onFocus = (): void => update();

	const onKeydown = (e: KeyboardEvent): void => {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-jb-autocomplete-item");

		if (e.key === "ArrowDown") {
			e.preventDefault();
			highlightItem(Math.min(selectedIndex + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			highlightItem(Math.max(selectedIndex - 1, 0));
		} else if (e.key === "Enter" && selectedIndex >= 0 && currentMatches[selectedIndex]) {
			e.preventDefault();
			selectItem(currentMatches[selectedIndex].item.type);
		} else if (e.key === "Escape") {
			hide();
		}
	};

	const onBlur = (): void => {
		setTimeout(hide, 150);
	};

	input.addEventListener("input", onInput);
	input.addEventListener("focus", onFocus);
	input.addEventListener("keydown", onKeydown);
	input.addEventListener("blur", onBlur);

	return () => {
		hide();
		input.removeEventListener("input", onInput);
		input.removeEventListener("focus", onFocus);
		input.removeEventListener("keydown", onKeydown);
		input.removeEventListener("blur", onBlur);
	};
}
