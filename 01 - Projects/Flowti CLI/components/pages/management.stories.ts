import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [
	{
		"label": "Resources",
		"description": "Manage project resources — human, material, roles, budgets, and financials.",
		"actionCount": 8,
		"icon": "users"
	},
	{
		"label": "Time-Log",
		"description": "Track time — list entries, log time, and view summaries.",
		"actionCount": 5,
		"icon": "clock"
	},
	{
		"label": "Deliverables",
		"description": "Manage project deliverables — list, add, and update status.",
		"actionCount": 5,
		"icon": "package"
	},
	{
		"label": "RAID Log",
		"description": "RAID log — risks, assumptions, issues, dependencies, and decisions.",
		"actionCount": 9,
		"icon": "alert-triangle"
	},
	{
		"label": "CAPA",
		"description": "Corrective and Preventive Actions — list, add, and update CAPA items.",
		"actionCount": 6,
		"icon": "shield-check"
	},
	{
		"label": "Lifecycle",
		"description": "View and manage lifecycle stages — project, features, and products.",
		"actionCount": 5,
		"icon": "git-branch"
	},
	{
		"label": "Iterations",
		"description": "List, create, and manage project iterations.",
		"actionCount": 7,
		"icon": "calendar"
	}
];
const actions = [
	{
		"name": "onNavigateResources",
		"label": "Resources",
		"key": "1",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onNavigateTimelog",
		"label": "Time-Log",
		"key": "2",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onNavigateDeliverables",
		"label": "Deliverables",
		"key": "3",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onNavigateRaid",
		"label": "RAID Log",
		"key": "4",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onNavigateCapa",
		"label": "CAPA",
		"key": "5",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onNavigateLifecycle",
		"label": "Lifecycle",
		"key": "6",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onShowHealth",
		"label": "Health",
		"key": "7",
		"group": "manage",
		"type": "handler"
	},
	{
		"name": "onNavigateIterations",
		"label": "Iterations",
		"key": "8",
		"group": "manage",
		"type": "navigate"
	},
	{
		"name": "onCreateIteration",
		"label": "Add new Iteration",
		"key": "9",
		"group": "manage",
		"type": "handler"
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
	title: "Pages/Management",
	render: () => createPageStory({
		title: "Project Management",
		description: "Access project management tools — resources, time-log, deliverables, RAID, CAPA, lifecycle, health, and iterations.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
