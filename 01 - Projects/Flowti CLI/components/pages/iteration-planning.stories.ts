import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [];
const actions = [
	{
		"name": "onEditName",
		"label": "Edit Name",
		"key": "1",
		"group": "metadata",
		"type": "handler"
	},
	{
		"name": "onEditGoal",
		"label": "Edit Goal",
		"key": "2",
		"group": "metadata",
		"type": "handler"
	},
	{
		"name": "onEditDates",
		"label": "Edit Dates",
		"key": "3",
		"group": "metadata",
		"type": "handler"
	},
	{
		"name": "onEditDescription",
		"label": "Edit Description",
		"key": "4",
		"group": "metadata",
		"type": "handler"
	},
	{
		"name": "onAddTask",
		"label": "Add Task",
		"group": "scope",
		"type": "handler"
	},
	{
		"name": "onEditTask",
		"label": "Edit Task",
		"group": "scope",
		"type": "handler"
	},
	{
		"name": "onRemoveTask",
		"label": "Remove Task",
		"group": "scope",
		"type": "handler"
	},
	{
		"name": "onAttachAgent",
		"label": "Add Agent",
		"group": "resources",
		"type": "handler"
	},
	{
		"name": "onAddResource",
		"label": "Add Resource Need",
		"group": "resources",
		"type": "handler"
	},
	{
		"name": "onAddCapacity",
		"label": "Add Estimation",
		"group": "resources",
		"type": "handler"
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
	title: "Pages/Iteration Planning",
	render: () => createPageStory({
		title: "Iteration Planning",
		description: "Plan an iteration — edit description, add tasks, attach agents, add resources, set capacity, and start.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
