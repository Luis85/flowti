import type { Preview } from '@storybook/vue3-vite';
import '../../styles/base.css';
import '../../styles/homepage.css';
import '../../styles/layouts.css';

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
