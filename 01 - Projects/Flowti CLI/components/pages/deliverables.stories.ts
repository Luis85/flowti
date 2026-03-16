import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["deliverables"];
const navCards: NavigationCardProps[] = [];

const meta: Meta = {
	title: "Pages/Management/Deliverables",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Manage project deliverables — list, add, and update status." } },
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
