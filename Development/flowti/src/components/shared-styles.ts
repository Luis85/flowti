import { css } from "lit";

export const masterDetailLayout = css`
	.master-detail {
		display: flex;
		height: 100%;
		gap: var(--flowti-space-md);
	}
	.master-list {
		flex: 0 0 280px;
		overflow-y: auto;
		border-right: 1px solid var(--flowti-border);
		padding-right: var(--flowti-space-md);
	}
	.detail-panel {
		flex: 1;
		overflow-y: auto;
	}
	.list-item {
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		border-radius: var(--flowti-radius);
		cursor: pointer;
	}
	.list-item:hover {
		background: var(--background-modifier-hover);
	}
	.list-item--selected {
		background: var(--background-modifier-active-hover);
	}
`;

export const statusBadge = css`
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		font-weight: 500;
	}
	.status-badge--success {
		color: var(--flowti-color-success);
		background: rgba(var(--color-green-rgb), 0.15);
	}
	.status-badge--warning {
		color: var(--flowti-color-warning);
		background: rgba(var(--color-yellow-rgb), 0.15);
	}
	.status-badge--error {
		color: var(--flowti-color-error);
		background: rgba(var(--color-red-rgb), 0.15);
	}
	.status-badge--muted {
		color: var(--flowti-color-muted);
		background: var(--background-secondary);
	}
	.status-badge--info {
		color: var(--flowti-color-info);
		background: rgba(var(--color-blue-rgb), 0.15);
	}
`;

export const statCardGrid = css`
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--flowti-grid-gap);
	}
	.stat-card {
		padding: var(--flowti-space-md);
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
		text-align: center;
	}
	.stat-card__value {
		font-size: 1.5em;
		font-weight: 700;
	}
	.stat-card__label {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}
`;

export const emptyState = css`
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
	.empty-state__icon {
		font-size: 2em;
		opacity: 0.5;
	}
	.empty-state__message {
		font-size: var(--flowti-font-sm);
	}
`;

export const searchBar = css`
	.search-bar {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		margin-bottom: var(--flowti-space-md);
	}
	.search-bar input {
		flex: 1;
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border: 1px solid var(--flowti-border);
		border-radius: var(--flowti-radius);
		background: var(--background-primary);
		color: var(--text-normal);
	}
`;
