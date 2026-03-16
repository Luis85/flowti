import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [];
const actions = [
	{
		"name": "onEditFields",
		"label": "Edit Fields",
		"key": "e",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditProperties",
		"label": "Edit Properties",
		"key": "p",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditActions",
		"label": "Edit Actions",
		"key": "a",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditChildren",
		"label": "Edit Children",
		"key": "c",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditStores",
		"label": "Edit Stores",
		"key": "s",
		"group": "edit",
		"type": "handler"
	},
	{
		"name": "onEditRequirements",
		"label": "Edit Requirements",
		"key": "q",
		"group": "traceability",
		"type": "handler"
	},
	{
		"name": "onEditFeatures",
		"label": "Edit Features",
		"key": "f",
		"group": "traceability",
		"type": "handler"
	},
	{
		"name": "onEditRelationships",
		"label": "Edit Relationships",
		"key": "l",
		"group": "traceability",
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
	title: "Pages/Component Detail",
	render: () => createPageStory({
		title: "Component Detail",
		description: "View and edit a single component — fields, properties, actions, children, stores, requirements, features, and relationships.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
