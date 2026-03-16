import type { Meta, StoryObj } from "@storybook/html-vite";
import { createTerminalView } from "./terminal-view.js";

const meta: Meta = {
	title: "Components/Layout/TerminalView",
	tags: ["autodocs"],
	argTypes: {
		title: { control: "text", description: "Window title" },
		width: { control: "number", description: "Width in ch units" },
		showTitleBar: { control: "boolean", description: "Show the title bar" },
	},
	args: { title: "Flowti CLI", width: 80, showTitleBar: true },
	render: (args) => {
		const view = createTerminalView(args);
		view.querySelector(".terminal-view--content")!.textContent =
			"Welcome to Flowti CLI — definition-driven project orchestrator.";
		return view;
	},
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};
export const NoTitleBar: Story = { args: { showTitleBar: false } };
export const NarrowWidth: Story = { args: { width: 50, title: "Narrow Terminal" } };
