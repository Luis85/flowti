import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createDashboardContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["project-detail"];
const navCards: NavigationCardProps[] = [
	{
		"label": "Make",
		"description": "Scaffold new project artifacts from templates.",
		"actionCount": 3,
		"icon": "hammer"
	},
	{
		"label": "Review",
		"description": "Quality review pipeline — build, test, E2E, journeys, and test vault management.",
		"actionCount": 13,
		"icon": "check-circle"
	},
	{
		"label": "Publish",
		"description": "Release pipeline — build, test, and distribute project artifacts.",
		"actionCount": 6,
		"icon": "upload"
	},
	{
		"label": "Current Iteration",
		"description": "View iteration details, edit, or advance through lifecycle states.",
		"actionCount": 6,
		"icon": "calendar"
	},
	{
		"label": "Product Components",
		"description": "Manage product components — add, regenerate, configure storybook, and view references.",
		"actionCount": 9,
		"icon": "layers"
	},
	{
		"label": "Event Catalog",
		"description": "Browse, add, and visualize project events.",
		"actionCount": 5,
		"icon": "zap"
	},
	{
		"label": "Reporting",
		"description": "Generate, export, and browse project reports.",
		"actionCount": 4,
		"icon": "bar-chart"
	},
	{
		"label": "Requirements Management",
		"description": "Manage project requirements — functional, non-functional, constraints, use cases, and user stories.",
		"actionCount": 9,
		"icon": "list-checks"
	},
	{
		"label": "Project Management",
		"description": "Access project management tools — resources, time-log, deliverables, RAID, CAPA, lifecycle, health, and iterations.",
		"actionCount": 11,
		"icon": "clipboard-list"
	},
	{
		"label": "Documentation",
		"description": "Manage project documentation — references, generators, events, and dependencies.",
		"actionCount": 4,
		"icon": "book-open"
	},
	{
		"label": "Knowledgebase",
		"description": "Search and browse the project knowledgebase.",
		"actionCount": 2,
		"icon": "search"
	},
	{
		"label": "Dev Tools",
		"description": "Developer tools — type check, lint, reload, console, rebuild, and npm scripts.",
		"actionCount": 7,
		"icon": "wrench"
	}
];

const meta: Meta = {
	title: "Pages/Project/Flowti CLI",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Project hub — capture, build, review, publish, and manage a selected project." } },
	},
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
