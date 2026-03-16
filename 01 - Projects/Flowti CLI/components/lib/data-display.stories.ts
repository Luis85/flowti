import type { Meta, StoryObj } from "@storybook/html-vite";
import { createBadge, createStatCard, createStatGrid } from "../tui/primitives.js";

// ─── StatCard ───────────────────────────────────────────────────────────────

const statCardMeta: Meta = {
	title: "Components/Data Display/StatCard",
	tags: ["autodocs"],
	argTypes: {
		label: { control: "text" },
		value: { control: "text" },
		trend: { control: "text" },
		color: { control: "color" },
	},
	args: {
		label: "Tests",
		value: 7022,
	},
	render: (args) => createStatCard({
		label: args["label"] as string,
		value: args["value"] as string | number,
		trend: args["trend"] as string | undefined,
		color: args["color"] as string | undefined,
	}),
};
export default statCardMeta;
type Story = StoryObj;

export const Default: Story = {};

export const WithTrend: Story = {
	args: {
		label: "Coverage",
		value: "84.3%",
		trend: "+2.1%",
	},
};

export const Colored: Story = {
	args: {
		label: "Passed",
		value: 7022,
		color: "#a6e3a1",
	},
};

export const LargeNumber: Story = {
	args: {
		label: "Lines of Code",
		value: "42,580",
	},
};

// ─── StatGrid ────────────────────────────────────────────────────────────────

export const StatGridDefault: Story = {
	name: "StatGrid / Default",
	render: () => createStatGrid([
		{ label: "Tests", value: 7022 },
		{ label: "Passed", value: 7000 },
		{ label: "Failed", value: 22 },
		{ label: "Coverage", value: "84.3%" },
	]),
};

export const StatGridTwoCards: Story = {
	name: "StatGrid / TwoCards",
	render: () => createStatGrid([
		{ label: "Tests", value: 7022 },
		{ label: "Coverage", value: "84.3%" },
	]),
};

export const StatGridSingleCard: Story = {
	name: "StatGrid / SingleCard",
	render: () => createStatGrid([
		{ label: "Tests", value: 7022 },
	]),
};

// ─── Badge ───────────────────────────────────────────────────────────────────

export const BadgeDefault: Story = {
	name: "Badge / Default",
	render: () => createBadge({ text: "active" }),
};

export const BadgeColored: Story = {
	name: "Badge / Colored",
	render: () => createBadge({ text: "ai", color: "#89dceb" }),
};

export const BadgeStatus: Story = {
	name: "Badge / Status",
	render: () => createBadge({ text: "done", color: "#a6e3a1" }),
};
