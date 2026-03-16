import { css } from "lit";

/** CSS reset for shadow DOM — must be included in every component. */
export const resetStyles = css`
	:host { box-sizing: border-box; }
	*, *::before, *::after { box-sizing: inherit; margin: 0; padding: 0; }
`;

/** Dark theme color palette. */
export const colorStyles = css`
	:host {
		--bg-primary: #0f172a;
		--bg-secondary: #1e293b;
		--bg-tertiary: #334155;
		--border: #334155;
		--text-primary: #e2e8f0;
		--text-secondary: #94a3b8;
		--text-muted: #64748b;
		--text-dim: #475569;
		--accent-blue: #38bdf8;
		--accent-green: #22c55e;
		--accent-amber: #f59e0b;
		--accent-red: #ef4444;
		--accent-purple: #8b5cf6;
		--btn-primary: #2563eb;
		--btn-primary-hover: #3b82f6;
		--status-busy: #22c55e;
		--status-idle: #3b82f6;
		--status-unassigned: #6b7280;
	}
`;

/** Common font stack. */
export const fontStyles = css`
	:host {
		font-family: 'Segoe UI', system-ui, sans-serif;
		font-size: 13px;
		color: var(--text-primary);
	}
`;

/** Shared button styles. */
export const buttonStyles = css`
	button {
		font-family: inherit;
		cursor: pointer;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		padding: 6px 14px;
		transition: background 0.15s;
	}
	button.primary {
		background: var(--btn-primary);
		color: var(--text-primary);
	}
	button.primary:hover {
		background: var(--btn-primary-hover);
	}
`;

/** Scrollable content area. */
export const scrollStyles = css`
	.scrollable {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}
`;
