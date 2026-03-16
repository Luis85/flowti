import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createDashboardContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["review"];
const navCards: NavigationCardProps[] = [];

const meta: Meta = {
	title: "Pages/Project/Review",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Quality review pipeline — build, test, E2E, journeys, and test vault management." } },
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
