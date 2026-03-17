import type { StorybookConfig } from "@storybook/html-vite";

const config: StorybookConfig = {
    stories: ["../**/*.stories.ts"],
    framework: "@storybook/html-vite",

    core: {
		disableTelemetry: true,
	},

    addons: [
        "@storybook/addon-vitest",
        "@storybook/addon-docs",
        "@storybook/addon-a11y"
    ]
};

export default config;
