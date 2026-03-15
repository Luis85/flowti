import { css } from 'lit';

/**
 * Shared design tokens for all Flowti Lit components.
 * Import into any component's `static styles` array.
 * Tokens use CSS custom properties — values come from :root (Obsidian or storybook).
 */
export const tokens = css`
	:host {
		font-family: var(--flowti-font);
		color: var(--flowti-text);
	}
`;

/**
 * Common utility styles shared across components.
 */
export const utilities = css`
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
