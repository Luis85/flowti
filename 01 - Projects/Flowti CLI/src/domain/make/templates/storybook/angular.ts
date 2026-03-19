/**
 * angular.ts — Angular + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding an Angular-based Storybook component library from a sitemap.
 */

export function getStorybookConfig(): string {
	return `import type { StorybookConfig } from "@storybook/angular";

const config: StorybookConfig = {
\tstories: ["../src/**/*.stories.@(ts|tsx)"],
\taddons: ["@storybook/addon-essentials"],
\tframework: {
\t\tname: "@storybook/angular",
\t\toptions: {},
\t},
};

export default config;
`;
}

export function getStoryTemplate(pageName: string, pascal: string, titlePrefix?: string): string {
	const title = titlePrefix ?? `Pages/${pascal}`;
	return `import type { Meta, StoryObj } from "@storybook/angular";
import { ${pascal}Component } from "./${pageName}.component";

const meta: Meta<${pascal}Component> = {
\ttitle: "${title}",
\tcomponent: ${pascal}Component,
\ttags: ["autodocs"],
};

export default meta;
type Story = StoryObj<${pascal}Component>;

export const Default: Story = {};
`;
}

export function getComponentStub(pageName: string, pascal: string): string {
	return `import { Component, Input } from "@angular/core";

@Component({
\tselector: "app-${pageName}",
\ttemplate: \`
\t\t<div class="${pageName}">
\t\t\t<h1>{{ title }}</h1>
\t\t</div>
\t\`,
\tstandalone: true,
})
export class ${pascal}Component {
\t@Input() title = "${pascal}";
}
`;
}

export function getPackageDeps(): Record<string, string> {
	return {
		"@angular/core": "^19.0.0",
		"@angular/common": "^19.0.0",
		"@angular/compiler": "^19.0.0",
		"@angular/platform-browser": "^19.0.0",
		"@angular/platform-browser-dynamic": "^19.0.0",
		"@storybook/angular": "^8.4.0",
		"@storybook/addon-essentials": "^8.4.0",
		"storybook": "^8.4.0",
		"typescript": "^5.6.0",
		"zone.js": "^0.15.0",
	};
}
