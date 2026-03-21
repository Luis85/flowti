import { css } from 'lit';

export const sessionWorkspaceStyles = css`
	:host {
		display: block;
	}

	.workspace {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-sm);
	}

	.header {
		padding: var(--flowti-space-md);
	}

	.title-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		flex-wrap: wrap;
	}

	.title-row h4 {
		margin: 0;
	}

	.badge {
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		font-weight: 500;
	}

	.type-badge {
		background: var(--background-secondary);
	}

	.status-badge-running {
		background: var(--color-green);
		color: var(--background-primary);
	}

	.status-badge-paused {
		background: var(--color-yellow);
		color: var(--background-primary);
	}

	.status-badge-reviewing {
		background: var(--color-orange, var(--color-yellow));
		color: var(--background-primary);
	}

	.status-badge-completed {
		background: var(--color-blue);
		color: var(--background-primary);
	}

	.status-badge-default {
		background: var(--background-modifier-hover);
	}

	.actions {
		display: flex;
		gap: var(--flowti-space-sm);
		flex-wrap: wrap;
		margin-top: var(--flowti-space-sm);
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border: 1px solid var(--flowti-border);
		border-radius: var(--flowti-radius);
		background: var(--background-secondary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: var(--flowti-font-sm);
	}

	.action-btn:hover {
		background: var(--background-modifier-hover);
	}

	.file-section {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-xs) var(--flowti-space-md);
		font-size: var(--flowti-font-sm);
	}

	.file-label {
		color: var(--flowti-color-muted);
	}

	.file-link {
		color: var(--text-accent);
		cursor: pointer;
		text-decoration: none;
	}

	.file-link:hover {
		text-decoration: underline;
	}

	.guiding {
		padding: var(--flowti-space-sm) var(--flowti-space-md);
	}

	.guiding-header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		margin-bottom: var(--flowti-space-sm);
	}

	.guiding-list {
		margin: 0;
		padding-left: var(--flowti-space-lg);
	}

	.guiding-list li {
		margin-bottom: var(--flowti-space-xs);
	}

	.intelligence {
		padding: var(--flowti-space-sm) var(--flowti-space-md);
	}

	.intelligence-stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-sm);
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.stat-label {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}

	.stat-value {
		font-weight: 600;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--flowti-space-xl);
		color: var(--flowti-color-muted);
		text-align: center;
		gap: var(--flowti-space-sm);
	}

	.empty-icon {
		font-size: 2em;
		opacity: 0.5;
	}

	.train-closure {
		padding: var(--flowti-space-md);
		border: 1px solid var(--flowti-border);
		border-radius: var(--flowti-radius);
		margin: var(--flowti-space-sm) var(--flowti-space-md);
	}

	.train-header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		margin-bottom: var(--flowti-space-sm);
	}

	.train-stats {
		display: flex;
		gap: var(--flowti-space-md);
		font-size: var(--flowti-font-sm);
		margin-bottom: var(--flowti-space-sm);
	}

	.train-thoughts {
		font-size: var(--flowti-font-sm);
	}

	.train-thoughts div {
		color: var(--flowti-color-muted);
		margin-bottom: var(--flowti-space-xs);
	}
`;
