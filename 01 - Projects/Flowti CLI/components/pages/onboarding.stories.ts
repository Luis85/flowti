import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createSimpleContent } from "../tui/patterns.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const navCards: NavigationCardProps[] = [];
const actions = [
	{
		"name": "onStartTour",
		"label": "Start Tour",
		"key": "1",
		"group": "tour",
		"type": "handler"
	},
	{
		"name": "onSkip",
		"label": "Skip Onboarding",
		"key": "s",
		"group": "nav",
		"type": "handler"
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
	title: "Pages/Onboarding/Welcome to Flowti",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "First-run onboarding — welcome screen and tour selection." } },
	},
	render: () => createPageStory({
		title: "Welcome to Flowti",
		description: "First-run onboarding — welcome screen and tour selection.",
		content: createSimpleContent(actions),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
