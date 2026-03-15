import type { StoryDef } from './story-types.js';

// Side-effect import registers the custom element
import '../src/components/flowti-status-badge.js';

export const story: StoryDef = {
	tag: 'flowti-status-badge',
	title: 'Status Badge',
	variants: [
		{ name: 'Success', props: { label: 'Healthy', variant: 'success', value: '92%' } },
		{ name: 'Warning', props: { label: 'At Risk', variant: 'warning', value: '61%' } },
		{ name: 'Error', props: { label: 'Failing', variant: 'error', value: '23%' } },
		{ name: 'Info', props: { label: 'Running', variant: 'info' } },
		{ name: 'Neutral', props: { label: 'Draft', variant: 'neutral' } },
		{ name: 'With Long Label', props: { label: 'Code Coverage (statements)', variant: 'success', value: '80.53%' } },
		{ name: 'Loading', props: { loading: true } },
		{ name: 'Error State', props: { error: 'Failed to load health data' } },
		{ name: 'Empty State', props: { isEmpty: true, emptyMessage: 'No status available' } },
	],
};
