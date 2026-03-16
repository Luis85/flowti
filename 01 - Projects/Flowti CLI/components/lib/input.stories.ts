import type { Meta, StoryObj } from "@storybook/html-vite";
import { createFormField } from "../tui/primitives.js";

// ─── FormField ────────────────────────────────────────────────────────────────

const meta: Meta = {
	title: "Components/Input/FormField",
	tags: ["autodocs"],
	render: () => createFormField({ label: "Agent Name", type: "text", placeholder: "Enter name..." }),
};
export default meta;
type Story = StoryObj;

export const TextField: Story = {};

export const SelectField: Story = {
	render: () => createFormField({
		label: "Framework",
		type: "select",
		options: [
			{ value: "html", label: "HTML" },
			{ value: "angular", label: "Angular" },
			{ value: "react", label: "React" },
		],
	}),
};

export const CheckboxField: Story = {
	render: () => createFormField({
		label: "Active",
		type: "checkbox",
		value: "true",
	}),
};

export const RequiredField: Story = {
	render: () => createFormField({
		label: "Name",
		type: "text",
		required: true,
		placeholder: "Required",
	}),
};
