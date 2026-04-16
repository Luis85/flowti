import type { StorybookConfig } from '@storybook/vue3-vite';

const config: StorybookConfig = {
	stories: ['../../stories/**/*.stories.@(ts|mdx)'],
	addons: [
		'@storybook/addon-a11y',
	],
	framework: {
		name: '@storybook/vue3-vite',
		options: {
			docgen: 'vue-component-meta',
		},
	},
	typescript: {
		check: false,
	},
};

export default config;
