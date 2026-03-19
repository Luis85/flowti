/**
 * lit.ts — HTML/Lit + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding a Lit-based Storybook component library from a sitemap.
 */

export function getStorybookConfig(): string {
	return `import type { StorybookConfig } from "@storybook/web-components-vite";

const config: StorybookConfig = {
\tstories: ["../src/**/*.stories.@(ts|tsx)"],
\taddons: ["@storybook/addon-essentials"],
\tframework: {
\t\tname: "@storybook/web-components-vite",
\t\toptions: {},
\t},
};

export default config;
`;
}

export function getStoryTemplate(pageName: string, pascal: string, titlePrefix?: string): string {
	const title = titlePrefix ?? `Pages/${pascal}`;
	return `import type { Meta, StoryObj } from "@storybook/web-components";
import { html } from "lit";
import "./${pageName}";

const meta: Meta = {
\ttitle: "${title}",
\ttags: ["autodocs"],
\trender: (args) => html\`<${pageName}-element title=\${args.title}></${pageName}-element>\`,
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
	return `import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("${pageName}-element")
export class ${pascal}Element extends LitElement {
\tstatic styles = css\`
\t\t:host {
\t\t\tdisplay: block;
\t\t}
\t\`;

\t@property({ type: String })
\ttitle = "${pascal}";

\trender() {
\t\treturn html\`
\t\t\t<div class="${pageName}">
\t\t\t\t<h1>\${this.title}</h1>
\t\t\t</div>
\t\t\`;
\t}
}
`;
}

export function getPackageDeps(): Record<string, string> {
	return {
		"lit": "^3.2.0",
		"@storybook/web-components-vite": "^8.4.0",
		"@storybook/addon-essentials": "^8.4.0",
		"@storybook/web-components": "^8.4.0",
		"storybook": "^8.4.0",
		"typescript": "^5.6.0",
		"vite": "^6.0.0",
	};
}
