import { css } from 'lit';

export const analyticsQueriesStyles = css`
	.queries-layout {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md);
	}

	.queries-master {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-sm);
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		font-size: var(--flowti-font-sm);
		font-weight: 600;
		color: var(--flowti-color-muted);
	}

	.section-count {
		font-size: var(--flowti-font-sm);
		background: var(--background-secondary);
		padding: 0 var(--flowti-space-xs);
		border-radius: var(--flowti-radius);
	}

	.query-item {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		border-radius: var(--flowti-radius);
		cursor: pointer;
	}

	.query-item:hover {
		background: var(--background-modifier-hover);
	}

	.query-item--active {
		background: var(--background-modifier-active-hover);
	}

	.query-name {
		flex: 1;
		font-size: var(--flowti-font-sm);
	}

	.query-meta {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}

	.source-panel {
		padding: var(--flowti-space-md);
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
	}

	.source-item {
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		font-size: var(--flowti-font-sm);
	}

	.config-section {
		padding: var(--flowti-space-md);
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
	}

	.config-badges {
		display: flex;
		gap: var(--flowti-space-xs);
		flex-wrap: wrap;
	}

	.config-badge {
		font-size: var(--flowti-font-sm);
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		background: var(--background-primary);
		color: var(--flowti-color-muted);
	}

	.results-panel {
		padding: var(--flowti-space-md);
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
	}

	.results-header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		font-size: var(--flowti-font-sm);
		font-weight: 600;
		margin-bottom: var(--flowti-space-sm);
	}

	.results-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--flowti-font-sm);
	}

	.results-table th {
		text-align: left;
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-bottom: 1px solid var(--flowti-border);
		font-weight: 600;
		color: var(--flowti-color-muted);
	}

	.results-table td {
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-bottom: 1px solid var(--flowti-border);
	}

	.actions-bar {
		display: flex;
		gap: var(--flowti-space-sm);
	}

	button {
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		border: 1px solid var(--flowti-border);
		background: var(--background-secondary);
		color: var(--flowti-text, inherit);
		font-size: var(--flowti-font-sm);
		cursor: pointer;
	}

	button:hover {
		background: var(--background-modifier-hover);
	}

	button.primary {
		background: var(--interactive-accent, #5a7);
		color: white;
		border-color: transparent;
	}

	.delete-btn {
		color: var(--flowti-color-error);
		border: none;
		background: none;
		cursor: pointer;
		font-size: var(--flowti-font-sm);
		padding: 2px var(--flowti-space-xs);
	}

	.new-query-btn {
		margin-left: auto;
	}

	.edit-btn {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
		cursor: pointer;
		background: none;
		border: none;
		padding: 2px var(--flowti-space-xs);
	}

	.edit-btn:hover {
		color: var(--text-accent, #5a7);
	}
`;
