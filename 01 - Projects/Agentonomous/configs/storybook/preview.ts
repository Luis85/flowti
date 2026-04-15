import type { Preview } from '@storybook/vue3-vite';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/,
			},
		},
		a11y: {
			config: {},
			options: {},
		},
	},
};

export default preview;
