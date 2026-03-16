import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createDashboardContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["start"];
const navCards: NavigationCardProps[] = [
	{
		"label": "Selected Project: Flowti CLI",
		"description": "Project hub — capture, build, review, publish, and manage a selected project.",
		"actionCount": 24,
		"icon": "folder-open"
	},
	{
		"label": "Agents and AI Tools",
		"description": "Manage AI agent tools and agent definitions — list, create, view, and remove agents.",
		"actionCount": 11,
		"icon": "cpu"
	},
	{
		"label": "Plugins",
		"description": "Manage CLI plugins — list, validate, create, and generate references.",
		"actionCount": 5,
		"icon": "plug"
	}
];

const meta: Meta = {
	title: "Pages/Start Menu",
	render: () => createPageStory({
		title: mock.title,
		description: mock.description,
		content: createDashboardContent(mock.dashboard!),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
