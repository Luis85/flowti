import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [];
const actions = [
	{
		"name": "onEditIdentity",
		"label": "Edit Identity",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditSkills",
		"label": "Edit Skills",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditTools",
		"label": "Edit Tools",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditRoles",
		"label": "Edit Roles",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditAIConfig",
		"label": "AI Config",
		"group": "ai",
		"type": "handler"
	},
	{
		"name": "onEditPrompt",
		"label": "System Prompt",
		"group": "ai",
		"type": "handler"
	},
	{
		"name": "onEditInventory",
		"label": "Inventory",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onRemoveAgent",
		"label": "Delete Agent",
		"group": "danger",
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
	title: "Pages/Edit: Software Architect",
	render: () => createPageStory({
		title: "Edit: Software Architect",
		description: "Edit an agent's identity, skills, tools, roles, AI config, and system prompt.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
