import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [
	{
		"label": "Edit Iteration",
		"description": "Plan an iteration — edit description, add tasks, attach agents, add resources, set capacity, and start.",
		"actionCount": 13,
		"icon": "calendar"
	}
];
const actions = [
	{
		"name": "onRosterTask",
		"label": "Assign Task",
		"group": "orchestration",
		"type": "handler"
	},
	{
		"name": "onExecuteIteration",
		"label": "Execute Iteration",
		"group": "orchestration",
		"type": "handler"
	},
	{
		"name": "onEditIteration",
		"label": "Edit Iteration",
		"group": "orchestration",
		"type": "navigate"
	},
	{
		"name": "onAdvance",
		"label": "Advance",
		"group": "lifecycle",
		"type": "handler",
		"disabled": "iteration:cannot-advance"
	},
	{
		"name": "onBack",
		"label": "Back",
		"key": "b",
		"group": "nav",
		"type": "signal"
	},
	{
		"name": "onQuit",
		"label": "Quit",
		"key": "q",
		"group": "nav",
		"type": "signal"
	}
];

const meta: Meta = {
	title: "Pages/Management/Iteration Detail",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "View iteration details, edit, or advance through lifecycle states." } },
	},
	render: () => createPageStory({
		title: "Iteration Detail",
		description: "View iteration details, edit, or advance through lifecycle states.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
