import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
	stories: [
		'../stories/**/*.stories.@(ts|mdx)',
	],
	addons: [
		'@storybook/addon-vitest',
		'@storybook/addon-a11y',
		'@storybook/addon-docs',
		'@storybook/addon-onboarding',
	],
	framework: '@storybook/vue3-vite',
	async viteFinal(config) {
		config.optimizeDeps ??= {};
		config.optimizeDeps.exclude = [
			...(config.optimizeDeps.exclude ?? []),
			'obsidian',
			'electron',
		];
		return config;
	},
};

export default config;
