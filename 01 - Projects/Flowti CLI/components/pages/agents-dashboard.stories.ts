import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [];
const actions = [
	{
		"name": "onBack",
		"label": "Back",
		"key": "b",
		"group": "nav",
		"type": "signal"
	}
];

const meta: Meta = {
	title: "Pages/Agents Dashboard",
	render: () => createPageStory({
		title: "Agent Dashboard",
		description: "Live status dashboard showing all agents and their current activity.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
