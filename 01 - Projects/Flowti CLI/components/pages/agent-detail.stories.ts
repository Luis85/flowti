import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createDashboardContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["agent-detail"];
const navCards: NavigationCardProps[] = [];

const meta: Meta = {
	title: "Pages/Agents/Agent: Software Architect",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Agent profile — view details, talk, assign tasks, or manage project assignments." } },
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
