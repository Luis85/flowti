/**
 * cli-app.ts — CLI App (Ink-based) + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding an Ink/React-based Storybook component library from a sitemap.
 * Uses React Storybook under the hood since Ink components are React components.
 */

export function getStorybookConfig(): string {
	return `import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
\tstories: ["../src/**/*.stories.@(ts|tsx)"],
\taddons: ["@storybook/addon-essentials"],
\tframework: {
\t\tname: "@storybook/react-vite",
\t\toptions: {},
\t},
};

export default config;
`;
}

export function getStoryTemplate(pageName: string, pascal: string): string {
	return `import type { Meta, StoryObj } from "@storybook/react";
import { ${pascal} } from "./${pageName}";

const meta: Meta<typeof ${pascal}> = {
\ttitle: "CLI Pages/${pascal}",
\tcomponent: ${pascal},
\ttags: ["autodocs"],
\tparameters: {
\t\tlayout: "fullscreen",
\t\tbackgrounds: { default: "terminal" },
\t},
};

export default meta;
type Story = StoryObj<typeof ${pascal}>;

export const Default: Story = {};
`;
}

export function getComponentStub(pageName: string, pascal: string): string {
	return `import React from "react";

export interface ${pascal}Props {
\ttitle?: string;
}

/**
 * ${pascal} — CLI view component.
 *
 * Renders as a standard React component for Storybook preview.
 * In the actual CLI, this would use Ink primitives (Box, Text).
 */
export function ${pascal}({ title = "${pascal}" }: ${pascal}Props): React.JSX.Element {
\treturn (
\t\t<div style={{ fontFamily: "monospace", background: "#1e1e1e", color: "#d4d4d4", padding: "16px" }}>
\t\t\t<div style={{ color: "#569cd6", fontWeight: "bold" }}>{title}</div>
\t\t\t<div style={{ color: "#608b4e" }}>{">"} Ready</div>
\t\t</div>
\t);
}
`;
}

export function getPackageDeps(): Record<string, string> {
	return {
		"react": "^18.3.0",
		"react-dom": "^18.3.0",
		"@storybook/react-vite": "^8.4.0",
		"@storybook/addon-essentials": "^8.4.0",
		"@storybook/react": "^8.4.0",
		"storybook": "^8.4.0",
		"typescript": "^5.6.0",
		"vite": "^6.0.0",
		"@types/react": "^18.3.0",
		"@types/react-dom": "^18.3.0",
	};
}
