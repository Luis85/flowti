import { css } from 'lit';

export const projectDetailStyles = css`
	:host {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md, 16px);
		padding: var(--flowti-space-md, 16px);
	}

	.header {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
	}

	.back-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: 1px solid var(--background-modifier-border, #444);
		border-radius: var(--flowti-radius-sm, 4px);
		background: none;
		color: var(--text-muted, #999);
		cursor: pointer;
		font-size: 1em;
		flex-shrink: 0;
	}

	.back-btn:hover {
		background: var(--background-modifier-hover, #333);
		color: var(--text-normal, #ddd);
	}

	.project-name {
		font-size: 1.25em;
		font-weight: 600;
		color: var(--text-normal, #ddd);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
		border-radius: 8px;
		padding: var(--flowti-space-md, 16px);
		max-width: 360px;
		width: calc(100% - 24px);
		box-sizing: border-box;
	}

	.modal-title {
		font-weight: 600;
		font-size: 1.1em;
		margin-bottom: var(--flowti-space-sm, 8px);
	}

	.modal-body {
		margin-bottom: var(--flowti-space-md, 16px);
	}

	.modal-actions {
		display: flex;
		gap: var(--flowti-space-sm, 8px);
		justify-content: flex-end;
	}

	.btn {
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: 4px;
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}

	.btn:hover {
		background: var(--background-modifier-hover, #333);
	}

	.btn--primary {
		background: var(--interactive-accent, #7c3aed);
		border-color: var(--interactive-accent, #7c3aed);
		color: #fff;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 1.1em;
		font-weight: 600;
		color: var(--text-normal, #ddd);
	}

	.search-input {
		width: 100%;
		box-sizing: border-box;
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-sm, 8px);
		border: 1px solid var(--background-modifier-border, #444);
		border-radius: var(--flowti-radius-sm, 4px);
		background: var(--background-primary, #1e1e1e);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.project-list {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-xs, 4px);
	}

	.project-item {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
		padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
		border-radius: var(--flowti-radius-sm, 4px);
		cursor: pointer;
		border: none;
		background: none;
		color: var(--text-normal, #ddd);
		text-align: left;
		width: 100%;
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.project-item:hover {
		background: var(--background-modifier-hover, #333);
	}

	.project-item__name {
		flex: 1;
		font-weight: 500;
	}

	.project-item__badges {
		display: flex;
		gap: var(--flowti-space-xs, 4px);
		align-items: center;
	}

	.badge {
		font-size: 0.7em;
		padding: 1px 6px;
		border-radius: var(--flowti-radius-sm, 4px);
		font-weight: 500;
	}

	.badge--type {
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 15%, transparent);
		color: var(--interactive-accent, #7c3aed);
	}

	.badge--sb {
		background: color-mix(in srgb, var(--color-green, #4caf50) 15%, transparent);
		color: var(--color-green, #4caf50);
	}

	.badge--running {
		background: color-mix(in srgb, var(--color-green, #4caf50) 20%, transparent);
		color: var(--color-green, #4caf50);
	}

	.badge--no-note {
		background: color-mix(in srgb, var(--color-yellow, #e5a00d) 15%, transparent);
		color: var(--color-yellow, #e5a00d);
	}

	.empty-list {
		padding: var(--flowti-space-xl, 32px);
		text-align: center;
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
	}

	.empty-pulse {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--text-muted, #999);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 1; }
	}

	.status-banner {
		padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
		border-radius: var(--flowti-radius-sm, 4px);
		background: color-mix(in srgb, var(--color-yellow, #e5a00d) 12%, transparent);
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--background-modifier-border, #333);
		margin-bottom: var(--flowti-space-sm, 8px);
	}

	.tab-btn {
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}

	.tab-btn:hover {
		color: var(--text-normal, #ddd);
	}

	.tab-btn--active {
		color: var(--interactive-accent, #7c3aed);
		border-bottom-color: var(--interactive-accent, #7c3aed);
		font-weight: 500;
	}

	.activity-bar {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
		padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
		border-radius: var(--flowti-radius-sm, 4px);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.activity-bar--busy {
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
		color: var(--interactive-accent, #7c3aed);
	}

	.activity-bar--success {
		background: color-mix(in srgb, var(--color-green, #4caf50) 12%, transparent);
		color: var(--color-green, #4caf50);
	}

	.activity-bar--error {
		background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
		color: var(--color-red, #e53935);
	}

	.activity-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.activity-dismiss {
		margin-left: auto;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 1.1em;
		padding: 0 4px;
		opacity: 0.6;
	}

	.activity-dismiss:hover {
		opacity: 1;
	}
`;
