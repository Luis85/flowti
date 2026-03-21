import { css } from 'lit';

export const tmJourneysStyles = css`
	:host {
		display: block;
	}

	.journeys-layout {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md);
	}

	.filter-bar {
		display: flex;
		gap: var(--flowti-space-sm);
		align-items: center;
	}

	select {
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius-sm);
		border: 1px solid var(--flowti-border, #ccc);
		background: var(--flowti-bg-secondary);
		color: var(--flowti-text);
		font-size: var(--flowti-font-xs);
		cursor: pointer;
	}

	.master-detail {
		display: flex;
		gap: var(--flowti-space-md);
	}

	.journey-list {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-xs);
	}

	.journey-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		border-radius: var(--flowti-radius-sm);
		background: var(--flowti-bg-secondary);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.journey-row:hover {
		background: var(--flowti-bg-hover, var(--flowti-bg-secondary));
	}

	.journey-row.active {
		background: color-mix(in srgb, var(--flowti-info) 15%, transparent);
		outline: 1px solid var(--flowti-info);
	}

	.journey-name {
		flex: 1;
		font-size: var(--flowti-font-sm);
		color: var(--flowti-text);
	}

	.journey-meta {
		font-size: var(--flowti-font-xs);
		color: var(--flowti-text-muted);
	}

	.type-badge {
		font-size: var(--flowti-font-xs);
		padding: 2px var(--flowti-space-xs);
		border-radius: var(--flowti-radius-sm);
		background: var(--flowti-bg-secondary);
		color: var(--flowti-text-muted);
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: var(--flowti-font-xs);
		padding: 2px var(--flowti-space-xs);
		border-radius: var(--flowti-radius-sm);
	}

	.status-badge .dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}

	.status-badge.passing .dot { background: var(--flowti-success); }
	.status-badge.passing { color: var(--flowti-success); }

	.status-badge.failing .dot { background: var(--flowti-error); }
	.status-badge.failing { color: var(--flowti-error); }

	.status-badge.never-run .dot { background: var(--flowti-text-muted); }
	.status-badge.never-run { color: var(--flowti-text-muted); }

	.status-badge.stale .dot { background: var(--flowti-warning); }
	.status-badge.stale { color: var(--flowti-warning); }

	.detail-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md);
		padding: var(--flowti-space-md);
		border-radius: var(--flowti-radius-sm);
		background: var(--flowti-bg-secondary);
	}

	.detail-header {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-xs);
	}

	.detail-header h3 {
		margin: 0;
		font-size: var(--flowti-font-md, 1rem);
		color: var(--flowti-text);
	}

	.detail-meta {
		display: flex;
		gap: var(--flowti-space-sm);
		align-items: center;
		font-size: var(--flowti-font-xs);
		color: var(--flowti-text-muted);
	}

	.detail-actions {
		display: flex;
		gap: var(--flowti-space-sm);
	}

	.detail-actions button {
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius-sm);
		border: 1px solid var(--flowti-border, #ccc);
		background: var(--flowti-bg-secondary);
		color: var(--flowti-text);
		font-size: var(--flowti-font-xs);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.detail-actions button:hover {
		background: var(--flowti-bg-hover, var(--flowti-bg-secondary));
	}

	.run-btn {
		background: color-mix(in srgb, var(--flowti-success) 15%, transparent) !important;
		border-color: var(--flowti-success) !important;
	}

	.run-history {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-xs);
	}

	.run-history h4 {
		margin: 0;
		font-size: var(--flowti-font-sm);
		color: var(--flowti-text);
	}

	.run-history-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius-sm);
		background: var(--flowti-bg-primary, var(--flowti-bg-secondary));
		font-size: var(--flowti-font-xs);
		color: var(--flowti-text-muted);
	}

	.run-history-row .run-date {
		color: var(--flowti-text);
	}

	.run-history-row .run-failed {
		color: var(--flowti-error);
	}

	.traceability {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-sm);
	}

	.traceability h4 {
		margin: 0;
		font-size: var(--flowti-font-sm);
		color: var(--flowti-text);
	}

	.chip-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-xs);
		align-items: center;
	}

	.chip-group-label {
		font-size: var(--flowti-font-xs);
		color: var(--flowti-text-muted);
		min-width: 56px;
	}

	.chip {
		padding: 2px var(--flowti-space-xs);
		border-radius: var(--flowti-radius-sm);
		background: color-mix(in srgb, var(--flowti-info) 15%, transparent);
		font-size: var(--flowti-font-xs);
		color: var(--flowti-text);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--flowti-space-xl);
		color: var(--flowti-text-muted);
		font-size: var(--flowti-font-sm);
	}
`;
