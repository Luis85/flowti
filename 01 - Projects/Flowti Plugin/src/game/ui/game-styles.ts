import { css } from "lit";

/** CSS reset for shadow DOM — must be included in every component. */
export const resetStyles = css`
	:host { box-sizing: border-box; }
	*, *::before, *::after { box-sizing: inherit; margin: 0; padding: 0; }
`;

/**
 * Dark theme — retro-RPG terminal aesthetic.
 * Deep navy base with warm amber accents. Feels like a guild management console.
 */
export const colorStyles = css`
	:host {
		--bg-primary: #0b0e1a;
		--bg-secondary: #131829;
		--bg-tertiary: #1c2238;
		--bg-panel: #111524;
		--border: #1e2a42;
		--border-glow: rgba(217, 170, 78, 0.15);
		--text-primary: #d4cfc0;
		--text-secondary: #8e8979;
		--text-muted: #5a5649;
		--text-dim: #3d3a31;
		--accent-gold: #d9aa4e;
		--accent-blue: #4e8bd9;
		--accent-green: #4ed97a;
		--accent-amber: #d9aa4e;
		--accent-red: #d94e4e;
		--accent-purple: #8b6ed9;
		--btn-primary: #2a3a5e;
		--btn-primary-hover: #364b78;
		--status-busy: #4ed97a;
		--status-idle: #4e8bd9;
		--status-unassigned: #5a5649;
		--glow-warm: 0 0 12px rgba(217, 170, 78, 0.08);
		--panel-shadow: -4px 0 20px rgba(0, 0, 0, 0.6), inset 1px 0 0 var(--border-glow);
		--rail-width-collapsed: 56px;
		--rail-width-expanded: 200px;
	}
`;

/** RPG-flavored font stack — pixel-adjacent for headings, clean for body. */
export const fontStyles = css`
	:host {
		font-family: 'Consolas', 'SF Mono', 'Fira Code', monospace;
		font-size: 12px;
		color: var(--text-primary);
		letter-spacing: 0.02em;
	}
`;

/** Shared button styles — RPG terminal feel. */
export const buttonStyles = css`
	button {
		font-family: inherit;
		cursor: pointer;
		border: 1px solid var(--border);
		border-radius: 2px;
		font-size: 11px;
		padding: 5px 12px;
		transition: background 0.15s, border-color 0.2s, box-shadow 0.2s;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		background: var(--bg-tertiary);
		color: var(--text-secondary);
	}
	button:hover {
		background: var(--btn-primary);
		border-color: var(--accent-gold);
		color: var(--text-primary);
		box-shadow: var(--glow-warm);
	}
	button.primary {
		background: var(--btn-primary);
		color: var(--accent-gold);
		border-color: var(--accent-gold);
	}
	button.primary:hover {
		background: var(--btn-primary-hover);
		box-shadow: 0 0 16px rgba(217, 170, 78, 0.15);
	}
`;

/** Scrollable content area with thin amber-tinted scrollbar. */
export const scrollStyles = css`
	.scrollable {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}
`;
