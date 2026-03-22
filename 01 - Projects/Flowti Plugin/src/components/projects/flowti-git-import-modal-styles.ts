import { css } from 'lit';

export const gitImportModalStyles = css`
	:host {
		display: block;
	}

	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--background-primary, #1e1e1e);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius-lg, 10px);
		padding: var(--flowti-space-md, 16px);
		max-width: 520px;
		width: calc(100% - 24px);
		margin: 0 12px;
		box-sizing: border-box;
	}

	.modal-title {
		font-weight: 600;
		font-size: 1.1em;
		margin-bottom: var(--flowti-space-sm, 8px);
	}

	.modal-body {
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
		margin-bottom: var(--flowti-space-md, 16px);
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: var(--flowti-space-sm, 8px);
		justify-content: flex-end;
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-bottom: var(--flowti-space-md, 16px);
	}

	.form-field label {
		font-size: var(--flowti-font-sm, 0.85em);
		font-weight: 500;
		color: var(--text-normal, #ddd);
	}

	.form-field input {
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		font-family: inherit;
	}

	.form-field input:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}

	.form-field .hint {
		font-size: 0.75em;
		color: var(--text-faint, #666);
	}

	.error-note {
		color: var(--text-error, #e53e3e);
		font-size: var(--flowti-font-sm, 0.85em);
		margin-bottom: var(--flowti-space-sm, 8px);
	}

	.step-indicator {
		display: flex;
		gap: var(--flowti-space-sm, 8px);
		margin-bottom: var(--flowti-space-md, 16px);
	}

	.step-dot {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 0.75em;
		color: var(--text-faint, #666);
	}

	.step-dot--active {
		color: var(--interactive-accent, #7c3aed);
		font-weight: 600;
	}

	.step-dot--done {
		color: var(--text-success, #38a169);
	}

	.detect-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px var(--flowti-space-md, 16px);
		font-size: var(--flowti-font-sm, 0.85em);
		margin-bottom: var(--flowti-space-md, 16px);
	}

	.detect-grid dt {
		color: var(--text-muted, #999);
		font-weight: 500;
	}

	.detect-grid dd {
		color: var(--text-normal, #ddd);
		margin: 0;
	}

	.framework-group {
		display: flex;
		flex-wrap: wrap;
		gap: var(--flowti-space-xs, 4px);
	}

	.framework-btn {
		padding: 2px var(--flowti-space-sm, 8px);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: 0.75em;
		cursor: pointer;
		transition: background var(--hub-transition, 150ms ease);
	}

	.framework-btn--selected {
		background: var(--interactive-accent, #7c3aed);
		border-color: var(--interactive-accent, #7c3aed);
		color: #fff;
	}

	.summary-card {
		background: var(--background-secondary, #262626);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
		margin-bottom: var(--flowti-space-md, 16px);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.summary-card .name {
		font-weight: 600;
		margin-bottom: 4px;
	}

	.summary-card .detail {
		color: var(--text-muted, #999);
	}

	.progress-section {
		margin-bottom: var(--flowti-space-md, 16px);
	}

	.progress-label {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
		margin-bottom: var(--flowti-space-sm, 8px);
	}

	.spinner {
		width: 14px;
		height: 14px;
		border: 2px solid var(--background-modifier-border, #333);
		border-top-color: var(--interactive-accent, #7c3aed);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
`;
