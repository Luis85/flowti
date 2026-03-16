import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["ai-tools"];
const navCards: NavigationCardProps[] = [
	{
		"label": "Workspaces",
		"description": "Manage isolated agent workspaces — provision, inspect, collect, prune.",
		"actionCount": 6,
		"icon": "git-branch"
	},
	{
		"label": "Dashboard",
		"description": "Live status dashboard showing all agents and their current activity.",
		"actionCount": 1,
		"icon": "grid"
	}
];

const meta: Meta = {
	title: "Pages/AI Tools",
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
