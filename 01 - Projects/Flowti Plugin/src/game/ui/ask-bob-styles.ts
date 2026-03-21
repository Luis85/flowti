/**
 * ask-bob-styles.ts — CSS styles for the Ask Bob chat overlay component.
 *
 * Extracted from ask-bob.ts to reduce file line count.
 */

import { css } from "lit";

export const askBobStyles = css`
	:host {
		position: absolute;
		bottom: 52px;
		left: 12px;
		z-index: 200;
		pointer-events: auto;
	}

	/* -- Floating button ----------------- */
	.bob-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		background: var(--bg-panel);
		border: 1px solid var(--accent-gold);
		border-radius: 3px;
		color: var(--accent-gold);
		font-family: inherit;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 8px 14px;
		cursor: pointer;
		transition: background 0.2s, box-shadow 0.2s;
		box-shadow: 0 0 12px rgba(217, 170, 78, 0.1);
	}
	.bob-btn:hover {
		background: var(--btn-primary);
		box-shadow: 0 0 20px rgba(217, 170, 78, 0.2);
	}
	.bob-btn .bob-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--accent-gold);
		animation: bob-pulse 2s infinite;
	}
	@keyframes bob-pulse {
		0%, 100% { opacity: 1; box-shadow: 0 0 4px rgba(217, 170, 78, 0.4); }
		50% { opacity: 0.5; box-shadow: 0 0 8px rgba(217, 170, 78, 0.6); }
	}

	/* -- Chat overlay -------------------- */
	.chat-overlay {
		position: absolute;
		bottom: 44px;
		left: 0;
		width: 360px;
		max-height: 420px;
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-left: 1px solid var(--border-glow);
		border-radius: 3px;
		box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.5), inset 0 1px 0 var(--border-glow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* -- Header -------------------------- */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-primary);
	}
	.chat-title {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.chat-title .name {
		font-size: 13px;
		font-weight: 600;
		color: var(--accent-gold);
		text-shadow: 0 0 6px rgba(217, 170, 78, 0.2);
	}
	.chat-title .role {
		font-size: 9px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.close-btn {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 16px;
		cursor: pointer;
		padding: 2px 4px;
		border-radius: 2px;
		transition: color 0.15s;
	}
	.close-btn:hover {
		color: var(--accent-gold);
	}

	/* -- Thread -------------------------- */
	.thread {
		flex: 1;
		overflow-y: auto;
		padding: 10px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 180px;
		max-height: 300px;
	}
	.empty {
		color: var(--text-muted);
		font-style: italic;
		text-align: center;
		padding: 30px 0;
		font-size: 11px;
	}
	.turn {
		max-width: 85%;
		padding: 6px 10px;
		border-radius: 3px;
		font-size: 12px;
		line-height: 1.5;
		word-wrap: break-word;
	}
	.turn[data-role="user"] {
		align-self: flex-end;
		background: var(--btn-primary);
		color: var(--text-primary);
		border: 1px solid rgba(78, 139, 217, 0.2);
	}
	.turn[data-role="agent"] {
		align-self: flex-start;
		background: var(--bg-secondary);
		color: var(--text-primary);
		border: 1px solid var(--border);
	}
	.thinking {
		align-self: flex-start;
		color: var(--accent-gold);
		font-size: 11px;
		font-style: italic;
		animation: bob-pulse 1.5s infinite;
	}

	/* -- Input --------------------------- */
	.input-row {
		display: flex;
		border-top: 1px solid var(--border);
		background: var(--bg-primary);
	}
	.chat-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text-primary);
		font-family: inherit;
		font-size: 12px;
		padding: 10px 12px;
		outline: none;
	}
	.chat-input::placeholder {
		color: var(--text-dim);
	}
	.send-btn {
		background: transparent;
		border: none;
		border-left: 1px solid var(--border);
		color: var(--accent-gold);
		font-family: inherit;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 0 14px;
		cursor: pointer;
		transition: background 0.15s;
	}
	.send-btn:hover {
		background: var(--bg-tertiary);
	}

	/* -- Tabs ----------------------------- */
	.tab-row {
		display: flex;
		border-bottom: 1px solid var(--border);
		background: var(--bg-primary);
	}
	.tab-btn {
		flex: 1;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 6px 8px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.tab-btn:hover { color: var(--text-primary); }
	.tab-btn[data-active] {
		color: var(--accent-gold);
		border-bottom-color: var(--accent-gold);
	}

	/* -- Debug log ------------------------- */
	.debug-log {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 180px;
		max-height: 300px;
		font-size: 11px;
		font-family: monospace;
	}
	.debug-entry {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 3px;
		padding: 6px 8px;
	}
	.debug-header {
		display: flex;
		justify-content: space-between;
		margin-bottom: 4px;
		font-size: 9px;
		color: var(--text-muted);
	}
	.debug-agent { color: var(--accent-gold); font-weight: 600; }
	.debug-prompt {
		color: var(--text-primary);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
	}
	.debug-prompt.collapsed {
		max-height: 80px;
	}
	.debug-context {
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px solid var(--border);
		color: var(--text-dim);
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
		font-size: 10px;
	}
	.debug-context.collapsed {
		max-height: 60px;
	}
	.debug-actions {
		display: flex;
		gap: 4px;
		margin-top: 6px;
	}
	.debug-action {
		background: var(--bg-primary);
		border: 1px solid var(--border);
		border-radius: 2px;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 9px;
		padding: 2px 8px;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.debug-action:hover {
		color: var(--accent-gold);
		border-color: var(--accent-gold);
	}
	.debug-empty {
		color: var(--text-muted);
		font-style: italic;
		text-align: center;
		padding: 30px 0;
	}
	.debug-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px 8px;
		border-bottom: 1px solid var(--border);
		font-size: 10px;
		color: var(--text-secondary);
	}
	.debug-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
	}
	.debug-toggle input[type="checkbox"] {
		accent-color: var(--accent-gold);
		cursor: pointer;
	}
	.debug-toggle-label {
		user-select: none;
	}
	.debug-mode-badge {
		padding: 1px 6px;
		border-radius: 3px;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
	}
	.debug-mode-badge[data-active] {
		background: #422006;
		color: var(--accent-gold);
	}
	.debug-response {
		margin-top: 4px;
		padding-top: 4px;
		border-top: 1px dashed var(--border);
		color: #4ade80;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-y: auto;
		font-size: 10px;
	}
	.debug-response.collapsed {
		max-height: 60px;
	}
	.debug-response-label {
		font-size: 9px;
		color: var(--text-muted);
		margin-bottom: 2px;
	}

	/* -- World perf monitor ---------------- */
	.world-perf-toolbar {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--bg-secondary);
		font-size: 10px;
		color: var(--text-secondary);
	}
	.world-perf-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;
		flex-shrink: 0;
	}
	.world-perf-toggle input {
		accent-color: var(--accent-gold);
		cursor: pointer;
	}
	.world-perf-hint {
		font-size: 9px;
		color: var(--text-muted);
		line-height: 1.35;
		flex: 1;
		text-align: right;
	}
	.world-perf-panel {
		margin-top: 8px;
		padding: 8px;
		border-radius: 3px;
		border: 1px solid var(--border);
		background: var(--bg-primary);
		font-size: 10px;
		color: var(--text-primary);
	}
	.world-perf-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 6px 10px;
		margin-bottom: 8px;
	}
	.world-perf-metric {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.world-perf-metric .lbl {
		font-size: 9px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.world-perf-metric .val {
		font-weight: 600;
		color: var(--accent-gold);
		font-variant-numeric: tabular-nums;
	}
	.world-perf-phases-title {
		font-size: 9px;
		color: var(--text-muted);
		margin: 6px 0 4px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.world-perf-phase-row {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 3px;
	}
	.world-perf-phase-name {
		width: 108px;
		flex-shrink: 0;
		font-size: 9px;
		color: var(--text-secondary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.world-perf-phase-bar-wrap {
		flex: 1;
		height: 6px;
		background: var(--bg-tertiary);
		border-radius: 2px;
		overflow: hidden;
	}
	.world-perf-phase-bar {
		height: 100%;
		background: linear-gradient(90deg, #6366f1, var(--accent-gold));
		border-radius: 2px;
	}
	.world-perf-phase-ms {
		width: 72px;
		flex-shrink: 0;
		text-align: right;
		font-size: 9px;
		font-variant-numeric: tabular-nums;
		color: var(--text-muted);
	}
	.world-perf-agg {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px dashed var(--border);
		font-size: 9px;
		color: var(--text-secondary);
		line-height: 1.45;
	}
	.world-perf-warn {
		margin-top: 6px;
		padding: 6px 8px;
		border-radius: 3px;
		background: rgba(217, 78, 78, 0.12);
		border: 1px solid rgba(217, 78, 78, 0.35);
		color: #fca5a5;
		font-size: 9px;
		line-height: 1.4;
	}
	.world-perf-wait {
		color: var(--text-muted);
		font-size: 10px;
		padding: 8px 0;
		text-align: center;
	}
`;
