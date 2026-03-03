/**
 * EventSuggest — lightweight autocomplete for event name inputs.
 * Follows the same attach/unsubscribe pattern as FolderSuggest.
 *
 * Decoupled from Obsidian APIs: takes a plain item getter and onSelect callback.
 */

/**
 * Attaches autocomplete behavior to a text input.
 * Shows a dropdown of matching items as the user types.
 *
 * @param input - The text input element to enhance
 * @param getItems - Callback returning the full list of available items
 * @param onSelect - Called when the user selects an item from the dropdown
 * @returns Unsubscribe function that removes all listeners and cleans up
 */
export function attachEventSuggest(
	input: HTMLInputElement,
	getItems: () => string[],
	onSelect: (value: string) => void,
): () => void {
	let dropdown: HTMLElement | null = null;
	let selectedIndex = -1;
	let skipNextInput = false;

	function hide(): void {
		if (dropdown) {
			dropdown.remove();
			dropdown = null;
		}
		selectedIndex = -1;
	}

	function highlightItem(index: number): void {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-jb-autocomplete-item");
		items.forEach((item, i) => {
			(item as HTMLElement).style.background =
				i === index ? "var(--background-modifier-hover)" : "";
		});
		selectedIndex = index;
	}

	function selectItem(value: string): void {
		input.value = value;
		onSelect(value);
		hide();
		// Dispatch input event so existing listeners (e.g. Title Sentence conversion) fire
		skipNextInput = true;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	function show(matches: string[]): void {
		hide();
		if (matches.length === 0) return;

		dropdown = document.createElement("div");
		dropdown.className = "ft-jb-autocomplete-dropdown";
		dropdown.dataset.testId = "jb-autocomplete-dropdown";

		for (let i = 0; i < matches.length; i++) {
			const item = document.createElement("div");
			item.textContent = matches[i];
			item.className = "ft-jb-autocomplete-item";
			item.dataset.testId = "jb-autocomplete-item";
			item.addEventListener("mouseenter", () => highlightItem(i));
			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				selectItem(matches[i]);
			});
			dropdown.appendChild(item);
		}

		const wrapper = input.parentElement;
		if (wrapper) {
			wrapper.classList.add("ft-jb-autocomplete-anchor");
			wrapper.appendChild(dropdown);
		}
	}

	const onInput = (): void => {
		if (skipNextInput) {
			skipNextInput = false;
			return;
		}
		const query = input.value.toLowerCase().trim();
		if (!query) {
			hide();
			return;
		}
		const items = getItems();
		const matches = items
			.filter((item) => item.toLowerCase().includes(query))
			.slice(0, 10);
		show(matches);
	};

	const onKeydown = (e: KeyboardEvent): void => {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-jb-autocomplete-item");

		if (e.key === "ArrowDown") {
			e.preventDefault();
			highlightItem(Math.min(selectedIndex + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			highlightItem(Math.max(selectedIndex - 1, 0));
		} else if (e.key === "Enter" && selectedIndex >= 0) {
			e.preventDefault();
			const selected = items[selectedIndex] as HTMLElement;
			selectItem(selected.textContent ?? "");
		} else if (e.key === "Escape") {
			hide();
		}
	};

	const onBlur = (): void => {
		setTimeout(hide, 150);
	};

	input.addEventListener("input", onInput);
	input.addEventListener("keydown", onKeydown);
	input.addEventListener("blur", onBlur);

	return () => {
		hide();
		input.removeEventListener("input", onInput);
		input.removeEventListener("keydown", onKeydown);
		input.removeEventListener("blur", onBlur);
	};
}
