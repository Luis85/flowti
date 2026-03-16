import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["onboarding-tour"];
const navCards: NavigationCardProps[] = [
	{
		"label": "View Progress",
		"description": "View onboarding tour progress and completed milestones.",
		"actionCount": 2,
		"icon": "check-square"
	}
];

const meta: Meta = {
	title: "Pages/Onboarding/Onboarding Tour",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Active tour step renderer — guides the user through onboarding." } },
	},
	render: () => createPageStory({
		title: mock.title,
		description: mock.description,
		content: createListContent(mock.list!),
		navCards,
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
