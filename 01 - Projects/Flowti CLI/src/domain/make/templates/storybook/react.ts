/**
 * react.ts — React + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding a React-based Storybook component library from a sitemap.
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

export function getStoryTemplate(pageName: string, pascal: string, titlePrefix?: string): string {
	const title = titlePrefix ?? `Pages/${pascal}`;
	return `import type { Meta, StoryObj } from "@storybook/react";
import { ${pascal} } from "./${pageName}";

const meta: Meta<typeof ${pascal}> = {
\ttitle: "${title}",
\tcomponent: ${pascal},
\ttags: ["autodocs"],
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

export function ${pascal}({ title = "${pascal}" }: ${pascal}Props): React.JSX.Element {
\treturn (
\t\t<div className="${pageName}">
\t\t\t<h1>{title}</h1>
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
