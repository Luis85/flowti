import type { Meta, StoryObj } from "@storybook/html-vite";
import { createActionBar, createKeyHints } from "../tui/primitives.js";
import { createNavigationCard, createNavigationCardGrid } from "../tui/nav-card.js";

// ─── ActionBar ───────────────────────────────────────────────────────────────

const meta: Meta = {
	title: "Components/Navigation/ActionBar",
	tags: ["autodocs"],
	render: () => createActionBar([
		{ key: "b", label: "Back" },
		{ key: "?", label: "Help" },
		{ key: "q", label: "Quit" },
	]),
};
export default meta;
type Story = StoryObj;

export const Default: Story = {};

export const SingleAction: Story = {
	render: () => createActionBar([
		{ key: "q", label: "Quit" },
	]),
};

export const ManyActions: Story = {
	render: () => createActionBar([
		{ key: "n", label: "New" },
		{ key: "e", label: "Edit" },
		{ key: "d", label: "Delete" },
		{ key: "b", label: "Back" },
		{ key: "?", label: "Help" },
		{ key: "q", label: "Quit" },
	]),
};

// ─── KeyHints ────────────────────────────────────────────────────────────────

export const KeyHintsDefault: Story = {
	name: "KeyHints / Default",
	render: () => createKeyHints([
		{ key: "↑/↓", description: "Navigate" },
		{ key: "Enter", description: "Select" },
		{ key: "Esc", description: "Back" },
		{ key: "q", description: "Quit" },
	]),
};

// ─── NavigationCard ──────────────────────────────────────────────────────────

export const NavigationCardDefault: Story = {
	name: "NavigationCard / Default",
	render: () => createNavigationCard({
		label: "Project Detail",
		description: "Project hub — build, review, publish.",
		actionCount: 24,
	}),
};

export const NavigationCardWithIcon: Story = {
	name: "NavigationCard / WithIcon",
	render: () => createNavigationCard({
		label: "Agents",
		icon: "🤖",
		description: "Manage AI agents and tools.",
		actionCount: 8,
	}),
};

export const NavigationCardGrid: Story = {
	name: "NavigationCard / Grid",
	render: () => createNavigationCardGrid([
		{ label: "Dashboard", icon: "🏠", description: "Vault overview and quick actions.", actionCount: 12 },
		{ label: "Projects", icon: "📁", description: "Browse and manage all projects.", actionCount: 18 },
		{ label: "Agents", icon: "🤖", description: "Manage AI agents and tools.", actionCount: 8 },
		{ label: "Reports", icon: "📊", description: "Generate and view project reports.", actionCount: 6 },
		{ label: "Health", icon: "💚", description: "Quality gates and coverage metrics.", actionCount: 5 },
		{ label: "Settings", icon: "⚙️", description: "Configure Flowti preferences.", actionCount: 10 },
	]),
};
