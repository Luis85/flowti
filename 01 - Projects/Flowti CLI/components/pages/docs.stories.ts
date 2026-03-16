import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [
	{
		"label": "Events",
		"description": "Browse, add, and visualize project events.",
		"actionCount": 5,
		"icon": "zap"
	}
];
const actions = [
	{
		"name": "onUpdateReferences",
		"label": "Update References",
		"key": "1",
		"group": "actions",
		"type": "handler"
	},
	{
		"name": "onNavigateEventCatalog",
		"label": "Events",
		"key": "e",
		"group": "reference",
		"type": "navigate"
	},
	{
		"name": "onShowDependencies",
		"label": "Dependencies",
		"key": "g",
		"group": "reference",
		"type": "handler"
	},
	{
		"name": "onBack",
		"label": "Back",
		"key": "b",
		"group": "nav",
		"type": "signal"
	}
];

const meta: Meta = {
	title: "Pages/Project/Docs",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Manage project documentation — references, generators, events, and dependencies." } },
	},
	render: () => createPageStory({
		title: "Documentation",
		description: "Manage project documentation — references, generators, events, and dependencies.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
