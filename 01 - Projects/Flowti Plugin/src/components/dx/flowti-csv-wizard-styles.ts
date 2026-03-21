import { css } from 'lit';

export const csvWizardStyles = css`
	:host {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.page-content {
		padding: var(--flowti-space-md);
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

	.card {
		padding: var(--flowti-space-md);
		border-radius: var(--flowti-radius);
		background: var(--background-secondary);
		margin-bottom: var(--flowti-space-md);
	}

	.card-title {
		font-weight: 600;
		font-size: var(--flowti-font-sm);
		margin-bottom: var(--flowti-space-sm);
	}

	.nav-link {
		color: var(--flowti-color-info);
		cursor: pointer;
		text-decoration: none;
		font-size: var(--flowti-font-sm);
	}

	.nav-link:hover {
		text-decoration: underline;
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

	.actions-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-sm);
		align-items: center;
	}

	.preview-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--flowti-font-sm);
	}

	.preview-table th,
	.preview-table td {
		text-align: left;
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border-bottom: 1px solid var(--flowti-border);
	}

	.preview-table th {
		font-weight: 600;
		color: var(--flowti-color-muted);
	}

	.badge {
		display: inline-flex;
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		background: var(--background-secondary);
		color: var(--flowti-color-muted);
	}

	.badge-accent {
		background: color-mix(in srgb, var(--flowti-color-info) 15%, transparent);
		color: var(--flowti-color-info);
	}

	.text-success {
		color: var(--flowti-color-success);
	}

	.text-error {
		color: var(--flowti-color-error);
	}

	.text-muted {
		color: var(--flowti-color-muted);
		font-size: var(--flowti-font-sm);
	}

	.progress-bar {
		height: 6px;
		background: var(--background-modifier-border);
		border-radius: 3px;
		overflow: hidden;
		margin-top: var(--flowti-space-sm);
	}

	.progress-bar-fill {
		height: 100%;
		background: var(--flowti-color-info);
		transition: width 0.3s ease;
	}

	.status-icon {
		font-size: 1.2em;
		margin-right: var(--flowti-space-xs);
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		margin-bottom: var(--flowti-space-md);
	}

	.table-scroll {
		overflow-x: auto;
	}

	.mapping-row {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-xs) 0;
		font-size: var(--flowti-font-sm);
	}

	.mapping-col {
		flex: 1;
	}

	.mapping-arrow {
		color: var(--flowti-color-muted);
	}
`;
