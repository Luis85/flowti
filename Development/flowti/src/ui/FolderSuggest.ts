/**
 * Lightweight folder autosuggest for text inputs.
 * Attaches to an existing <input> and shows matching vault folders as the user types.
 */

import type { App } from "obsidian";

/**
 * Attaches folder autosuggest behavior to a text input.
 * Shows a dropdown of matching vault folder paths as the user types.
 *
 * @param input - The text input element to enhance
 * @param app - The Obsidian App instance (for vault folder access)
 * @param onSelect - Optional callback when a folder is selected from suggestions
 */
export function attachFolderSuggest(
	input: HTMLInputElement,
	app: App,
	onSelect?: (path: string) => void,
): () => void {
	let dropdown: HTMLElement | null = null;
	let selectedIndex = -1;

	function getVaultFolders(): string[] {
		try {
			return app.vault.getAllLoadedFiles()
				.filter((f) => "children" in f && f.path)
				.map((f) => f.path + "/")
				.sort();
		} catch {
			return [];
		}
	}

	function hide(): void {
		if (dropdown) {
			dropdown.remove();
			dropdown = null;
		}
		selectedIndex = -1;
	}

	function highlightItem(index: number): void {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-folder-suggest-item");
		items.forEach((item, i) => {
			(item as HTMLElement).style.background =
				i === index ? "var(--background-modifier-hover)" : "";
		});
		selectedIndex = index;
	}

	function show(matches: string[]): void {
		hide();
		if (matches.length === 0) return;

		dropdown = document.createElement("div");
		dropdown.className = "ft-folder-suggest-dropdown";
		dropdown.style.cssText =
			"position:absolute;left:0;right:0;top:100%;z-index:100;" +
			"max-height:200px;overflow-y:auto;" +
			"background:var(--background-primary);" +
			"border:1px solid var(--background-modifier-border);" +
			"border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.15);";

		for (let i = 0; i < matches.length; i++) {
			const item = document.createElement("div");
			item.textContent = matches[i];
			item.className = "ft-folder-suggest-item";
			item.style.cssText = "padding:4px 8px;cursor:pointer;font-size:12px;";
			item.addEventListener("mouseenter", () => highlightItem(i));
			item.addEventListener("mousedown", (e) => {
				e.preventDefault();
				input.value = matches[i];
				onSelect?.(matches[i]);
				hide();
			});
			dropdown.appendChild(item);
		}

		const wrapper = input.parentElement;
		if (wrapper) {
			wrapper.style.position = "relative";
			wrapper.appendChild(dropdown);
		}
	}

	const onInput = (): void => {
		const query = input.value.toLowerCase();
		if (!query) {
			hide();
			return;
		}
		const folders = getVaultFolders();
		const matches = folders
			.filter((f) => f.toLowerCase().includes(query))
			.slice(0, 10);
		show(matches);
	};

	const onKeydown = (e: KeyboardEvent): void => {
		if (!dropdown) return;
		const items = dropdown.querySelectorAll(".ft-folder-suggest-item");

		if (e.key === "ArrowDown") {
			e.preventDefault();
			highlightItem(Math.min(selectedIndex + 1, items.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			highlightItem(Math.max(selectedIndex - 1, 0));
		} else if (e.key === "Enter" && selectedIndex >= 0) {
			const selected = items[selectedIndex] as HTMLElement;
			input.value = selected.textContent ?? "";
			onSelect?.(input.value);
			hide();
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
