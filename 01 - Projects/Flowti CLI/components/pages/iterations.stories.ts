import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["iterations"];
const navCards: NavigationCardProps[] = [
	{
		"label": "Current Iteration",
		"description": "View iteration details, edit, or advance through lifecycle states.",
		"actionCount": 6,
		"icon": "calendar"
	}
];

const meta: Meta = {
	title: "Pages/Iterations",
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
