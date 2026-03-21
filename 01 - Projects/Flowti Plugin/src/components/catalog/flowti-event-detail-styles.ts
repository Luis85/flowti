import { css } from 'lit';

export const eventDetailStyles = css`
	.detail-header {
		margin-bottom: var(--flowti-space-md);
	}

	.event-type-name {
		font-size: 1.1em;
		font-weight: 600;
		font-family: var(--flowti-font-mono, monospace);
		margin-bottom: var(--flowti-space-xs);
	}

	.badge-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
		flex-wrap: wrap;
		margin-top: var(--flowti-space-xs);
	}

	.badge {
		display: inline-flex;
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		background: var(--background-secondary);
		color: var(--flowti-color-muted);
	}

	.badge-tag {
		background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
		color: var(--flowti-color-info);
	}

	.info-card {
		padding: var(--flowti-space-md);
		border-radius: var(--flowti-radius);
		background: var(--background-secondary);
		margin-bottom: var(--flowti-space-md);
	}

	.description {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
		margin-bottom: var(--flowti-space-sm);
	}

	.info-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--flowti-space-xs) var(--flowti-space-md);
		font-size: var(--flowti-font-sm);
	}

	.info-label {
		color: var(--flowti-color-muted);
		font-weight: 500;
	}

	.nav-link {
		color: var(--flowti-color-info);
		cursor: pointer;
		text-decoration: none;
	}

	.nav-link:hover {
		text-decoration: underline;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-sm);
		margin-bottom: var(--flowti-space-md);
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

	.btn-primary {
		background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
		border-color: var(--flowti-color-info);
	}

	.btn-danger {
		color: var(--flowti-color-error);
	}

	.section {
		margin-bottom: var(--flowti-space-md);
	}

	.section-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--flowti-space-sm);
	}

	.section-title {
		font-weight: 600;
		font-size: var(--flowti-font-sm);
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
	}

	.row:hover {
		background: var(--background-modifier-hover);
	}

	.row-label {
		font-weight: 500;
	}

	.row-meta {
		color: var(--flowti-color-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row-spacer {
		flex: 1;
	}

	.row-actions {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-xs);
	}

	.icon-btn {
		padding: 2px 4px;
		border: none;
		background: none;
		cursor: pointer;
		color: var(--flowti-color-muted);
		border-radius: var(--flowti-radius);
	}

	.icon-btn:hover {
		background: var(--background-modifier-hover);
		color: var(--flowti-text, inherit);
	}

	.icon-btn--off {
		opacity: 0.5;
	}

	.transform-arrow {
		color: var(--flowti-color-muted);
	}

	.domain-event-name {
		font-family: var(--flowti-font-mono, monospace);
		color: var(--flowti-color-info);
	}

	.related-section {
		margin-bottom: var(--flowti-space-sm);
	}

	.related-title {
		font-size: var(--flowti-font-sm);
		font-weight: 500;
		color: var(--flowti-color-muted);
		margin-bottom: var(--flowti-space-xs);
	}

	.related-chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-xs);
	}

	.stat-row {
		display: flex;
		gap: var(--flowti-space-lg);
		margin-top: var(--flowti-space-md);
	}

	.stat {
		text-align: center;
	}

	.stat-value {
		font-weight: 600;
	}

	.stat-label {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}

	.muted-text {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
		padding: var(--flowti-space-sm);
	}
`;
