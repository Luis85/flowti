import type { Meta, StoryObj } from "@storybook/html-vite";
import { createScrollableList, createSearchInput, createBadge, text } from "../tui/primitives.js";

// ─── ScrollableList ───────────────────────────────────────────────────────────

const meta: Meta = {
	title: "Components/Lists/ScrollableList",
	tags: ["autodocs"],
	render: () => {
		const makeAgentItem = (name: string, status: string): HTMLElement => {
			const wrapper = document.createElement("span");
			wrapper.appendChild(text(name + " "));
			wrapper.appendChild(createBadge({ text: status }));
			return wrapper;
		};

		return createScrollableList([
			{ content: makeAgentItem("Architect", "active") },
			{ content: makeAgentItem("Engineer", "active"), selected: true },
			{ content: makeAgentItem("Analyst", "idle") },
			{ content: makeAgentItem("Designer", "idle") },
			{ content: makeAgentItem("Reviewer", "done") },
		]);
	},
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const EmptyList: Story = {
	render: () => createScrollableList([]),
};

export const SingleItem: Story = {
	render: () => {
		const wrapper = document.createElement("span");
		wrapper.appendChild(text("Architect "));
		wrapper.appendChild(createBadge({ text: "active" }));

		return createScrollableList([
			{ content: wrapper, selected: true },
		]);
	},
};

// ─── SearchInput ──────────────────────────────────────────────────────────────

export const SearchInputDefault: Story = {
	name: "SearchInput / Default",
	render: () => createSearchInput({ placeholder: "Search agents..." }),
};

export const SearchInputWithValue: Story = {
	name: "SearchInput / WithValue",
	render: () => createSearchInput({ placeholder: "Search...", value: "architect" }),
};
