import type { StoryDef, StoryVariant } from './story-types.js';

/**
 * Render all variants of a story into a container element.
 */
export function renderStory(storyDef: StoryDef, container: HTMLElement): void {
	container.innerHTML = '';

	const header = document.createElement('h1');
	header.textContent = storyDef.title;
	header.style.cssText = 'font-family: var(--flowti-font, sans-serif); color: var(--flowti-text, #cdd6f4); margin: 0 0 1.5rem;';
	container.appendChild(header);

	const grid = document.createElement('div');
	grid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 1.5rem;';
	container.appendChild(grid);

	for (const variant of storyDef.variants) {
		const card = renderVariant(storyDef.tag, variant);
		grid.appendChild(card);
	}
}

function renderVariant(tag: string, variant: StoryVariant): HTMLElement {
	const card = document.createElement('div');
	card.style.cssText = `
		padding: 1rem;
		border: 1px solid var(--flowti-border, #45475a);
		border-radius: var(--flowti-radius-md, 8px);
		background: var(--flowti-bg-secondary, #181825);
		min-width: 200px;
	`;

	const label = document.createElement('div');
	label.textContent = variant.name;
	label.style.cssText = `
		font-size: 0.75rem;
		color: var(--flowti-text-muted, #a6adc8);
		margin-bottom: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	`;
	card.appendChild(label);

	const el = document.createElement(tag);
	for (const [key, value] of Object.entries(variant.props)) {
		(el as unknown as Record<string, unknown>)[key] = value;
	}
	card.appendChild(el);

	return card;
}
