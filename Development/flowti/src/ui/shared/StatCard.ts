/**
 * Shared stat card grid renderer used by both CatalogDashboard and HubDashboard.
 */

import { setIcon } from "obsidian";

export interface StatCardItem {
	icon: string;
	value: string;
	label: string;
	onClick?: () => void;
}

/**
 * Renders a grid of stat cards into the given container.
 * Each card shows an icon, a value, and a label.
 * Cards with an `onClick` handler are clickable with a hover effect.
 */
export function renderStatGrid(
	container: HTMLElement,
	cards: StatCardItem[],
	columns = 3,
): HTMLElement {
	const grid = container.createDiv({ cls: "ft-stat-grid" });
	grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

	for (const card of cards) {
		const el = grid.createDiv({ cls: "ft-stat-card" });

		if (card.onClick) {
			el.addClass("ft-cursor-pointer");
			el.addEventListener("click", card.onClick);
		}

		const iconEl = el.createDiv();
		iconEl.style.opacity = "0.6";
		setIcon(iconEl, card.icon);

		const text = el.createDiv();
		text.createDiv({ text: card.value, cls: "ft-catalog-stat-value" });
		text.createDiv({ text: card.label, cls: "ft-catalog-stat-label" });
	}

	return grid;
}
