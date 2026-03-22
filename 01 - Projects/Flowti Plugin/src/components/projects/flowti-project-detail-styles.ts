import { css } from 'lit';

export const projectDetailStyles = css`
	:host {
		display: flex;
		flex-direction: column;
		gap: var(--flowti-space-md, 16px);
		padding: var(--flowti-space-md, 16px);

		/* Elevation layers (luminous dark) */
		--hub-surface-0: var(--background-primary, #141414);
		--hub-surface-1: var(--background-secondary, #1a1a1a);
		--hub-surface-2: color-mix(in srgb, var(--background-secondary, #1a1a1a) 85%, white);

		/* Glow accents */
		--hub-glow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent) 25%, transparent),
		            0 0 12px color-mix(in srgb, var(--interactive-accent) 8%, transparent);
		--hub-glow-success: 0 0 0 1px color-mix(in srgb, var(--color-green) 25%, transparent),
		                    0 0 12px color-mix(in srgb, var(--color-green) 8%, transparent);

		/* Unified radius */
		--hub-radius: 6px;
		--hub-radius-lg: 10px;

		/* Transitions */
		--hub-transition: 150ms ease;
		--hub-transition-slow: 300ms ease;
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
		border-radius: var(--hub-radius, 6px);
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

	.back-btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
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
		border-radius: var(--hub-radius-lg, 10px);
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
		border-radius: var(--hub-radius, 6px);
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
		border-radius: var(--hub-radius, 6px);
		cursor: pointer;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--hub-surface-1, var(--background-secondary, #1a1a1a));
		color: var(--text-normal, #ddd);
		text-align: left;
		width: 100%;
		font-size: var(--flowti-font-sm, 0.85em);
		box-sizing: border-box;
		transition: border-color var(--hub-transition, 150ms ease),
		            box-shadow var(--hub-transition, 150ms ease),
		            transform var(--hub-transition, 150ms ease);
		animation: card-enter 200ms ease both;
		animation-delay: calc(var(--i, 0) * 30ms);
	}

	.project-item:hover {
		border-color: color-mix(in srgb, var(--interactive-accent, #7c3aed) 30%, var(--background-modifier-border, #333));
		box-shadow: var(--hub-glow);
		transform: translateY(-1px);
	}

	@keyframes card-enter {
		from { opacity: 0; transform: translateY(4px); }
		to { opacity: 1; transform: translateY(0); }
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
		border-radius: var(--hub-radius, 6px);
		background: color-mix(in srgb, var(--color-yellow, #e5a00d) 12%, transparent);
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
	}

	.hub-cli-log {
		margin-bottom: var(--flowti-space-sm, 8px);
		border: 1px solid var(--background-modifier-border, #333);
		border-radius: var(--hub-radius, 6px);
		background: var(--background-secondary, #1a1a1a);
		overflow: hidden;
		transition: border-color var(--hub-transition, 150ms ease),
		            box-shadow var(--hub-transition, 150ms ease);
	}

	.hub-cli-log--active {
		border-left: 3px solid var(--interactive-accent, #7c3aed);
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--interactive-accent, #7c3aed) 20%, transparent);
	}

	.hub-cli-log__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 10px;
		border-bottom: 1px solid var(--background-modifier-border, #333);
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--text-muted, #999);
	}

	.hub-cli-log__title {
		font-size: 0.75em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted, #999);
	}

	.hub-cli-log__clear {
		padding: 2px 8px;
		font-size: 0.8em;
		border-radius: var(--hub-radius, 6px);
		border: 1px solid var(--background-modifier-border, #444);
		background: var(--background-primary, #1e1e1e);
		color: var(--text-muted, #aaa);
		cursor: pointer;
		transition: color var(--hub-transition, 150ms ease);
	}

	.hub-cli-log__clear:hover:not(:disabled) {
		color: var(--text-normal, #ddd);
	}

	.hub-cli-log__clear:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.hub-cli-log__clear:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}

	.hub-cli-log__pre {
		margin: 0;
		padding: 8px 10px;
		max-height: 200px;
		overflow: auto;
		font-family: var(--font-monospace, monospace);
		font-size: 11px;
		line-height: 1.5;
		color: var(--text-muted, #bbb);
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 3%, var(--background-primary, #141414));
		box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
	}

	.tab-bar {
		display: flex;
		gap: 0;
		border-bottom: 1px solid var(--background-modifier-border, #333);
		margin-bottom: var(--flowti-space-sm, 8px);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.tab-bar::-webkit-scrollbar { display: none; }

	.tab-btn {
		padding: var(--flowti-space-xs, 4px) var(--flowti-space-md, 16px);
		border: none;
		border-bottom: 2px solid transparent;
		background: none;
		color: var(--text-muted, #999);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		white-space: nowrap;
		transition: color var(--hub-transition, 150ms ease),
		            border-bottom-color var(--hub-transition, 150ms ease);
	}

	.tab-btn:hover {
		color: var(--text-normal, #ddd);
		border-bottom-color: color-mix(in srgb, var(--interactive-accent, #7c3aed) 40%, transparent);
	}

	.tab-btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
		border-radius: 2px;
	}

	.tab-btn--active {
		color: var(--interactive-accent, #7c3aed);
		border-bottom-color: var(--interactive-accent, #7c3aed);
		font-weight: 600;
		text-shadow: 0 0 8px color-mix(in srgb, var(--interactive-accent, #7c3aed) 40%, transparent);
	}

	.activity-bar {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm, 8px);
		padding: var(--flowti-space-sm, 8px) var(--flowti-space-md, 16px);
		border-radius: var(--hub-radius, 6px);
		font-size: var(--flowti-font-sm, 0.85em);
		transition: background var(--hub-transition, 150ms ease),
		            box-shadow var(--hub-transition, 150ms ease);
	}

	.activity-bar--busy {
		background: color-mix(in srgb, var(--interactive-accent, #7c3aed) 10%, transparent);
		color: var(--interactive-accent, #7c3aed);
	}

	.activity-bar--success {
		background: color-mix(in srgb, var(--color-green, #4caf50) 25%, transparent);
		color: var(--color-green, #4caf50);
		animation: success-flash 600ms ease forwards;
	}

	.activity-bar--error {
		background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
		color: var(--color-red, #e53935);
		animation: shake 300ms ease;
	}

	.activity-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: spinner-enter 200ms ease both, spin 0.8s linear 200ms infinite;
		flex-shrink: 0;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes success-flash {
		0% { background: color-mix(in srgb, var(--color-green, #4caf50) 25%, transparent); }
		100% { background: color-mix(in srgb, var(--color-green, #4caf50) 12%, transparent); }
	}

	@keyframes shake {
		0%, 100% { transform: translateX(0); }
		25% { transform: translateX(-2px); }
		75% { transform: translateX(2px); }
	}

	@keyframes spinner-enter {
		from { opacity: 0; transform: scale(0.5) rotate(0deg); }
		to { opacity: 1; transform: scale(1) rotate(0deg); }
	}

	@keyframes fade-in {
		to { opacity: 0.6; }
	}

	.activity-dismiss {
		margin-left: auto;
		background: none;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 1.1em;
		padding: 0 4px;
		opacity: 0;
		animation: fade-in 150ms ease 150ms forwards;
	}

	.activity-dismiss:hover {
		opacity: 1;
	}

	.activity-dismiss:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
		border-radius: 2px;
	}
`;
