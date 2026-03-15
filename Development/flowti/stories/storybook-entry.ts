import { renderStory } from './storybook-runner.js';
import type { StoryDef } from './story-types.js';

// Import all stories — add new stories here
import { story as statusBadge } from './status-badge.story.js';

const stories: StoryDef[] = [
	statusBadge,
];

const nav = document.getElementById('storybook-nav')!;
const root = document.getElementById('storybook-root')!;

function showStory(index: number): void {
	// Update nav active state
	nav.querySelectorAll('button').forEach((btn, i) => {
		btn.classList.toggle('active', i === index);
	});
	renderStory(stories[index], root);
}

// Build navigation
for (let i = 0; i < stories.length; i++) {
	const btn = document.createElement('button');
	btn.textContent = stories[i].title;
	btn.addEventListener('click', () => showStory(i));
	nav.appendChild(btn);
}

// Show first story by default
if (stories.length > 0) {
	showStory(0);
}
