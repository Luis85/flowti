import { createBadge } from "./primitives.js";

export interface NavigationCardProps {
	label: string;
	icon?: string;
	description: string;
	actionCount: number;
	onClick?: () => void;
}

export function createNavigationCard(props: NavigationCardProps): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-nav-card";
	if (props.onClick) {
		el.style.cursor = "pointer";
		el.addEventListener("click", props.onClick);
	}

	const titleRow = document.createElement("div");
	titleRow.className = "tui-nav-card--title";
	if (props.icon) {
		const icon = document.createElement("span");
		icon.className = "tui-nav-card--icon";
		icon.textContent = props.icon + " ";
		titleRow.appendChild(icon);
	}
	titleRow.appendChild(document.createTextNode(props.label));
	el.appendChild(titleRow);

	const desc = document.createElement("div");
	desc.className = "tui-nav-card--description";
	desc.textContent = props.description;
	el.appendChild(desc);

	const badge = createBadge({ text: `${props.actionCount} actions`, color: "#89b4fa" });
	el.appendChild(badge);

	return el;
}

export function createNavigationCardGrid(cards: NavigationCardProps[]): HTMLElement {
	const el = document.createElement("div");
	el.className = "tui-nav-card-grid";
	for (const card of cards) {
		el.appendChild(createNavigationCard(card));
	}
	return el;
}
