/**
 * vue.ts — Vue + Storybook scaffold templates.
 *
 * Provides config, story template, component stub, and package deps
 * for scaffolding a Vue-based Storybook component library from a sitemap.
 */

export function getStorybookConfig(): string {
	return `import type { StorybookConfig } from "@storybook/vue3-vite";

const config: StorybookConfig = {
\tstories: ["../src/**/*.stories.@(ts|tsx)"],
\taddons: ["@storybook/addon-essentials"],
\tframework: {
\t\tname: "@storybook/vue3-vite",
\t\toptions: {},
\t},
};

export default config;
`;
}

export function getStoryTemplate(pageName: string, pascal: string): string {
	return `import type { Meta, StoryObj } from "@storybook/vue3";
import ${pascal} from "./${pageName}.vue";

const meta: Meta<typeof ${pascal}> = {
\ttitle: "Pages/${pascal}",
\tcomponent: ${pascal},
\ttags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof ${pascal}>;

export const Default: Story = {};
`;
}

export function getComponentStub(pageName: string, pascal: string): string {
	return `<template>
\t<div class="${pageName}">
\t\t<h1>{{ title }}</h1>
\t</div>
</template>

<script setup lang="ts">
interface Props {
\ttitle?: string;
}

withDefaults(defineProps<Props>(), {
\ttitle: "${pascal}",
});
</script>
`;
}

export function getPackageDeps(): Record<string, string> {
	return {
		"vue": "^3.5.0",
		"@storybook/vue3-vite": "^8.4.0",
		"@storybook/addon-essentials": "^8.4.0",
		"@storybook/vue3": "^8.4.0",
		"storybook": "^8.4.0",
		"typescript": "^5.6.0",
		"vite": "^6.0.0",
	};
}
