import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["workspaces"];
const navCards: NavigationCardProps[] = [
	{
		"label": "Back",
		"description": "Manage AI agent tools and agent definitions — list, create, view, and remove agents.",
		"actionCount": 11,
		"icon": "cpu"
	}
];

const meta: Meta = {
	title: "Pages/Agents/Workspaces",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Manage isolated agent workspaces — provision, inspect, collect, prune." } },
	},
	render: () => createPageStory({
		title: mock.title,
		description: mock.description,
		content: createListContent(mock.list!),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
