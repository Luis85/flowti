/**
 * html.ts — Plain HTML + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding a vanilla HTML Storybook component library from a sitemap.
 */

export function getStorybookConfig(): string {
	return `import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
\tstories: ["../src/**/*.stories.@(ts|tsx)"],
\taddons: ["@storybook/addon-essentials"],
\tframework: {
\t\tname: "@storybook/html-vite",
\t\toptions: {},
\t},
};

export default config;
`;
}

export function getStoryTemplate(pageName: string, pascal: string): string {
	return `import type { Meta, StoryObj } from "@storybook/html";
import { create${pascal} } from "./${pageName}";

const meta: Meta = {
\ttitle: "Pages/${pascal}",
\ttags: ["autodocs"],
\trender: (args) => create${pascal}(args),
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
\targs: {
\t\ttitle: "${pascal}",
\t},
};
`;
}

export function getComponentStub(pageName: string, pascal: string): string {
	return `export interface ${pascal}Props {
\ttitle?: string;
}

export function create${pascal}(props: ${pascal}Props = {}): HTMLElement {
\tconst el = document.createElement("div");
\tel.className = "${pageName}";
\tel.innerHTML = \`<h1>\${props.title ?? "${pascal}"}</h1>\`;
\treturn el;
}
`;
}

export function getPackageDeps(): Record<string, string> {
	return {
		"@storybook/html-vite": "^10.0.0",
		"@storybook/html": "^10.0.0",
		"@storybook/addon-essentials": "^10.0.0",
		"storybook": "^10.0.0",
		"typescript": "^5.6.0",
		"vite": "^6.0.0",
	};
}
