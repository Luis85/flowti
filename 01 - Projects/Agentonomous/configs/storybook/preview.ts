import type { Preview } from '@storybook/vue3-vite';
import { setup } from '@storybook/vue3-vite';
import { createPinia } from 'pinia';
import '../../styles/base.css';
import '../../styles/homepage.css';
import '../../styles/layouts.css';

setup((app) => {
	app.use(createPinia());
});

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
