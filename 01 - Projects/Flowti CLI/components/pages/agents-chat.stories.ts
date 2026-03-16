import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [
	{
		"label": "Back",
		"description": "Agent profile — view details, talk, assign tasks, or manage project assignments.",
		"actionCount": 7,
		"icon": "user"
	}
];
const actions = [
	{
		"name": "onBack",
		"label": "Back",
		"key": "b",
		"group": "nav",
		"type": "navigate"
	}
];

const meta: Meta = {
	title: "Pages/Agents/Agents Chat",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Interactive chat with an AI agent." } },
	},
	render: () => createPageStory({
		title: "Agent Chat",
		description: "Interactive chat with an AI agent.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
