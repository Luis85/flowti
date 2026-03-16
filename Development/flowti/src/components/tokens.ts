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

		/* Spacing */
		--flowti-space-xs: 4px;
		--flowti-space-sm: 8px;
		--flowti-space-md: 16px;
		--flowti-space-lg: 24px;
		--flowti-space-xl: 32px;

		/* Colors — inherit from Obsidian theme via CSS custom properties */
		--flowti-color-success: var(--color-green);
		--flowti-color-warning: var(--color-yellow);
		--flowti-color-error: var(--color-red);
		--flowti-color-muted: var(--text-muted);
		--flowti-color-info: var(--color-blue);

		/* Typography */
		--flowti-font-sm: 0.85em;
		--flowti-font-mono: var(--font-monospace);

		/* Layout */
		--flowti-radius: var(--radius-s);
		--flowti-border: var(--background-modifier-border);
		--flowti-shadow: var(--shadow-s);
		--flowti-grid-gap: 12px;
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
