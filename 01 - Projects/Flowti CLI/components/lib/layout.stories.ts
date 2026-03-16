import type { Meta, StoryObj } from "@storybook/html-vite";
import { createSection, createMasterDetail, textLine, text } from "../tui/primitives.js";

// ─── Section ─────────────────────────────────────────────────────────────────

const meta: Meta = {
	title: "Components/Layout/Section",
	tags: ["autodocs"],
	render: () => createSection({
		title: "Agent Roster",
		children: [
			textLine("Architect — active"),
			textLine("Engineer — idle"),
			textLine("Analyst — active"),
		],
	}),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const Collapsible: Story = {
	render: () => createSection({
		title: "Agent Roster",
		collapsible: true,
		children: [
			textLine("Architect — active"),
			textLine("Engineer — idle"),
			textLine("Analyst — active"),
		],
	}),
};

export const WithMultipleChildren: Story = {
	render: () => createSection({
		title: "Coverage Breakdown",
		children: [
			textLine("Statements:  84.3%"),
			textLine("Branches:    76.5%"),
			textLine("Functions:   85.6%"),
			textLine("Lines:       86.1%"),
		],
	}),
};

// ─── MasterDetail ─────────────────────────────────────────────────────────────

export const MasterDetailDefault: Story = {
	name: "MasterDetail / Default",
	render: () => {
		const masterList = document.createElement("div");
		masterList.appendChild(textLine("Architect"));
		masterList.appendChild(textLine("Engineer"));
		masterList.appendChild(textLine("Analyst"));

		const detailBlock = document.createElement("div");
		detailBlock.appendChild(text("Architect", { bold: true }));
		detailBlock.appendChild(textLine("Status: active"));
		detailBlock.appendChild(textLine("Tasks: 3 in-progress"));

		return createMasterDetail(masterList, detailBlock);
	},
};

export const MasterDetailMasterOnly: Story = {
	name: "MasterDetail / MasterOnly",
	render: () => {
		const masterList = document.createElement("div");
		masterList.appendChild(textLine("Architect"));
		masterList.appendChild(textLine("Engineer"));
		masterList.appendChild(textLine("Analyst"));

		return createMasterDetail(masterList);
	},
};

export const MasterDetailWideMaster: Story = {
	name: "MasterDetail / WideMaster",
	render: () => {
		const masterList = document.createElement("div");
		masterList.appendChild(textLine("Architect"));
		masterList.appendChild(textLine("Engineer"));
		masterList.appendChild(textLine("Analyst"));

		const detailBlock = document.createElement("div");
		detailBlock.appendChild(text("Selected agent details", { bold: true }));

		return createMasterDetail(masterList, detailBlock, "50ch");
	},
};
