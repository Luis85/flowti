import type { Meta, StoryObj } from "@storybook/html-vite";
import { createPageStory, createListContent } from "../tui/patterns.js";
import { PAGE_MOCKS } from "../mocks/mock-data.js";
import type { NavigationCardProps } from "../tui/nav-card.js";

const mock = PAGE_MOCKS["timelog"];
const navCards: NavigationCardProps[] = [];

const meta: Meta = {
	title: "Pages/Management/Time-Log",
	tags: ["autodocs"],
	parameters: {
		docs: { description: { component: "Track time — list entries, log time, and view summaries." } },
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
