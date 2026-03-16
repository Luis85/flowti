import { createStatGrid, createSection, createActionBar, createScrollableList, createMasterDetail, text, textLine } from "./primitives.js";
import type { StatCardData, ActionDef, ListItem, SectionProps } from "./primitives.js";
import { createNavigationCardGrid } from "./nav-card.js";
import type { NavigationCardProps } from "./nav-card.js";
import { createTerminalView } from "../terminal-view/terminal-view.js";

export interface DashboardConfig {
	stats: StatCardData[];
	sections: { title: string; content: HTMLElement | HTMLElement[] }[];
	actions?: ActionDef[];
}

export interface ListConfig {
	items: ListItem[];
	selected: number;
	detail?: HTMLElement;
	actions?: ActionDef[];
}

export interface SimpleAction {
	name: string;
	label: string;
	key?: string;
	group?: string;
	type?: string;
	hidden?: boolean | string;
	disabled?: boolean | string;
}

export interface PageStoryConfig {
	title: string;
	description: string;
	content: HTMLElement;
	navCards?: NavigationCardProps[];
}

export function createDashboardContent(config: DashboardConfig): HTMLElement {
	const el = document.createElement("div");
	el.appendChild(createStatGrid(config.stats));
	for (const section of config.sections) {
		el.appendChild(createSection({ title: section.title, children: section.content }));
	}
	if (config.actions) {
		el.appendChild(createActionBar(config.actions));
	}
	return el;
}

export function createListContent(config: ListConfig): HTMLElement {
	const el = document.createElement("div");
	const items: ListItem[] = config.items.map((item, i) => ({
		...item,
		selected: i === config.selected,
	}));
	if (config.detail) {
		el.appendChild(createMasterDetail(createScrollableList(items), config.detail));
	} else {
		el.appendChild(createScrollableList(items));
	}
	if (config.actions) {
		el.appendChild(createActionBar(config.actions));
	}
	return el;
}

export function createSimpleContent(actions: SimpleAction[]): HTMLElement {
	const el = document.createElement("div");
	let lastGroup: string | undefined = undefined;
	for (const action of actions) {
		if (action.group !== lastGroup) {
			if (lastGroup !== undefined) {
				const sep = document.createElement("hr");
				sep.className = "terminal-page--separator";
				el.appendChild(sep);
			}
			lastGroup = action.group;
		}
		const row = document.createElement("div");
		row.className = "terminal-page--action";
		if (action.hidden) row.classList.add("terminal-page--action-hidden");
		if (action.disabled) row.classList.add("terminal-page--action-disabled");
		if (action.key) {
			const keyEl = document.createElement("span");
			keyEl.className = "terminal-page--key";
			keyEl.textContent = `[${action.key}] `;
			row.appendChild(keyEl);
		}
		row.appendChild(document.createTextNode(action.label));
		el.appendChild(row);
	}
	return el;
}

export function createPageStory(config: PageStoryConfig): HTMLElement {
	const view = createTerminalView({ title: config.title });
	const content = view.querySelector(".terminal-view--content") as HTMLElement;

	const header = document.createElement("div");
	header.className = "terminal-page--header";

	const h2 = document.createElement("h2");
	h2.textContent = config.title;
	header.appendChild(h2);

	const p = document.createElement("p");
	p.textContent = config.description;
	header.appendChild(p);

	content.appendChild(header);
	content.appendChild(config.content);

	if (config.navCards && config.navCards.length > 0) {
		content.appendChild(createNavigationCardGrid(config.navCards));
	}

	return view;
}

// CSS classes used by createSimpleContent and createPageStory are defined in terminal-view.css
