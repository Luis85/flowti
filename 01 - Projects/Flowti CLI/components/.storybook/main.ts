import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
	stories: [
		"../**/*.stories.@(js|jsx|mjs|ts|tsx)",
		"../**/*.mdx",
	],
	addons: [
		"@storybook/addon-a11y",
		"@storybook/addon-docs",
	],
	framework: "@storybook/html-vite",
	core: {
		disableTelemetry: true,
	},
};
export default config;
