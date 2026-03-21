/**
 * ask-bob-styles.ts — CSS styles for the Ask Bob chat overlay component.
 *
 * Extracted from ask-bob.ts to reduce file line count.
 */

import { css } from "lit";

export const askBobStyles = css`
	:host {
		position: absolute;
		top: 10px;
		left: 10px;
		z-index: 200;
		pointer-events: auto;
	}

	/* -- Launcher (top-left) ------------- */
	.bob-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		background: var(--bg-panel);
		border: 1px solid var(--accent-gold);
		border-radius: 6px;
		color: var(--accent-gold);
		font-family: inherit;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		padding: 10px 16px;
		cursor: pointer;
		transition: background 0.2s, box-shadow 0.2s, transform 0.15s;
		box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(217, 170, 78, 0.12);
	}
	.bob-btn:hover {
		background: var(--btn-primary);
		box-shadow: 0 4px 20px rgba(217, 170, 78, 0.18);
	}
	.bob-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 2px;
	}
	.bob-btn:active {
		transform: scale(0.98);
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

	/* -- Panel (below launcher) ---------- */
	.chat-overlay {
		position: absolute;
		top: 52px;
		left: 0;
		width: min(480px, calc(100vw - 24px));
		max-height: min(680px, calc(100vh - 72px));
		background: var(--bg-panel);
		border: 1px solid var(--border);
		border-left: 1px solid var(--border-glow);
		border-radius: 8px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55), inset 0 1px 0 var(--border-glow);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.bob-debug-panel {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.bob-debug-panel .debug-toolbar {
		flex-shrink: 0;
	}
	.bob-debug-panel .debug-log {
		flex: 1;
		min-height: 0;
	}

	/* -- Header -------------------------- */
	.chat-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--border);
		background: linear-gradient(180deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
	}
	.chat-title-block {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.chat-title {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 6px 10px;
	}
	.chat-title .name {
		font-size: 15px;
		font-weight: 700;
		color: var(--accent-gold);
		text-shadow: 0 0 8px rgba(217, 170, 78, 0.15);
		letter-spacing: 0.02em;
	}
	.chat-title .role {
		font-size: 9px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-weight: 600;
	}
	.chat-subtitle {
		font-size: 10px;
		color: var(--text-secondary);
		line-height: 1.35;
		max-width: 320px;
		margin: 0;
	}
	.close-btn {
		flex-shrink: 0;
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
		cursor: pointer;
		padding: 4px 8px;
		margin: -4px -6px 0 0;
		border-radius: 4px;
		transition: color 0.15s, background 0.15s;
	}
	.close-btn:hover {
		color: var(--accent-gold);
		background: var(--bg-tertiary);
	}
	.close-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}

	/* -- Thread -------------------------- */
	.thread {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 12px 14px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
		display: flex;
		flex-direction: column;
		gap: 10px;
		min-height: 220px;
	}
	.empty {
		color: var(--text-muted);
		text-align: center;
		padding: 28px 16px;
		font-size: 12px;
		line-height: 1.5;
	}
	.empty strong {
		color: var(--text-secondary);
		font-weight: 600;
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
		flex-shrink: 0;
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
	.send-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: -2px;
		z-index: 1;
	}

	/* -- Tabs ----------------------------- */
	.tab-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0;
		border-bottom: 1px solid var(--border);
		background: var(--bg-primary);
		padding: 0 4px;
	}
	.tab-btn {
		flex: 1;
		min-width: 72px;
		background: transparent;
		border: none;
		border-bottom: 2px solid transparent;
		color: var(--text-muted);
		font-family: inherit;
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: 8px 6px;
		cursor: pointer;
		transition: color 0.15s, border-color 0.15s;
	}
	.tab-btn:hover { color: var(--text-primary); }
	.tab-btn:focus-visible {
		color: var(--text-primary);
		outline: 2px solid var(--accent-gold);
		outline-offset: -2px;
	}
	.tab-btn[data-active] {
		color: var(--accent-gold);
		border-bottom-color: var(--accent-gold);
	}
	.tab-btn[data-badge]::after {
		content: "";
		display: inline-block;
		width: 5px;
		height: 5px;
		margin-left: 4px;
		border-radius: 50%;
		background: var(--accent-gold);
		vertical-align: 2px;
	}

	/* -- Debug log ------------------------- */
	.debug-log {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 10px 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-height: 220px;
		font-size: 11px;
		font-family: monospace;
	}

	/* -- Overview: roster & sections ----- */
	.bob-overview-scroll {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}
	.bob-roster-label {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
	.bob-roster {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.bob-agent-chip {
		border: 1px solid var(--border);
		background: var(--bg-secondary);
		color: var(--text-primary);
		font-family: inherit;
		font-size: 10px;
		font-weight: 600;
		padding: 5px 10px;
		border-radius: 999px;
		cursor: pointer;
		transition: border-color 0.15s, background 0.15s, color 0.15s;
		max-width: 140px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.bob-agent-chip:hover {
		border-color: var(--accent-gold);
		color: var(--accent-gold);
	}
	.bob-agent-chip:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 2px;
	}
	.bob-agent-chip[data-active] {
		border-color: var(--accent-gold);
		background: rgba(217, 170, 78, 0.12);
		color: var(--accent-gold);
	}
	.bob-agent-chip--ghost {
		color: var(--text-muted);
		font-weight: 500;
	}
	.bob-section-title {
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
		margin: 4px 0 0;
	}
	.bob-hint {
		font-size: 10px;
		color: var(--text-muted);
		line-height: 1.45;
		margin: 0;
	}
	.bob-metric-strip {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		padding: 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.bob-metric-strip .lbl {
		font-size: 8px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.bob-metric-strip .val {
		font-size: 14px;
		font-weight: 700;
		color: var(--accent-gold);
		font-variant-numeric: tabular-nums;
		margin-top: 2px;
	}
	.bob-event-compact {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 5px 0;
		border-bottom: 1px solid var(--border);
		font-size: 10px;
	}
	.bob-event-compact:last-child {
		border-bottom: none;
	}
	.bob-event-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.bob-event-time {
		color: var(--text-muted);
		font-size: 9px;
		width: 48px;
		flex-shrink: 0;
		font-variant-numeric: tabular-nums;
	}
	.bob-event-label {
		color: var(--text-primary);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* -- Agent detail tab ---------------- */
	.bob-agent-scroll {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 12px 14px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		scrollbar-width: thin;
	}
	.bob-agent-hero {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border);
	}
	.bob-agent-hero-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--accent-gold);
	}
	.bob-agent-hero-meta {
		font-size: 10px;
		color: var(--text-secondary);
		line-height: 1.4;
	}
	.bob-status-grid {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px 12px;
		font-size: 11px;
		padding: 10px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 6px;
	}
	.bob-status-label {
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
	}
	.bob-status-value {
		color: var(--text-primary);
	}
	.bob-state-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 10px;
		font-weight: 600;
		color: #fff;
	}
	.bob-dot-alive {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #22c55e;
		margin-right: 6px;
		vertical-align: middle;
	}
	.bob-dot-dead {
		display: inline-block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #6b7280;
		margin-right: 6px;
		vertical-align: middle;
	}
	.bob-clear-sel {
		align-self: flex-start;
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-muted);
		font-family: inherit;
		font-size: 10px;
		padding: 6px 12px;
		border-radius: 4px;
		cursor: pointer;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-weight: 600;
	}
	.bob-clear-sel:hover {
		border-color: var(--accent-gold);
		color: var(--accent-gold);
	}
	.bob-agent-events .bob-event-compact {
		font-size: 10px;
	}
	.bob-type-pill {
		font-size: 8px;
		font-weight: 600;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 3px;
		color: #fff;
		flex-shrink: 0;
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

	/* -- World tab: status + day bar above perf (sticky while scrolling) -- */
	.world-monitor-sticky-header {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-bottom: 8px;
		margin-bottom: 4px;
		background: var(--bg-panel);
		/* Separate scrolling perf/log from the pinned header */
		box-shadow: 0 10px 14px -10px rgba(0, 0, 0, 0.55);
	}
	.world-monitor-status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		background: var(--bg-secondary);
		border-radius: 3px;
		border: 1px solid var(--border);
	}
	.world-monitor-day-bar-track {
		height: 4px;
		background: var(--bg-tertiary);
		border-radius: 2px;
		overflow: hidden;
	}
	.world-monitor-day-bar-fill {
		height: 100%;
		background: var(--accent-gold);
		border-radius: 2px;
		transition: width 1s;
	}

	/* -- Agent CLI resources (Ask Bob world) */
	.world-resource-block {
		padding: 8px;
		margin-bottom: 8px;
		border: 1px solid var(--border);
		border-radius: 3px;
		background: var(--bg-secondary);
	}
	.world-resource-hint {
		font-size: 9px;
		color: var(--text-muted);
		margin: 0 0 8px;
		line-height: 1.4;
	}
	.world-resource-foot {
		font-size: 8px;
		color: var(--text-muted);
		margin: 8px 0 0;
		line-height: 1.35;
	}
	.world-resource-foot code {
		font-size: 8px;
	}
	.world-resource-warn {
		margin: 0 0 8px;
		padding: 6px 8px;
		border-radius: 3px;
		background: rgba(217, 170, 78, 0.12);
		border: 1px solid rgba(217, 170, 78, 0.35);
		color: var(--accent-gold);
		font-size: 9px;
		line-height: 1.4;
	}
	.world-resource-empty {
		font-size: 10px;
		color: var(--text-muted);
		text-align: center;
		padding: 10px 6px;
		line-height: 1.45;
	}
	.world-resource-totals.world-perf-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-bottom: 4px;
	}
	.world-resource-table-head,
	.world-resource-row {
		display: grid;
		grid-template-columns: 1fr 44px 58px 44px;
		gap: 6px;
		align-items: center;
		font-size: 10px;
	}
	.world-resource-table-head {
		color: var(--text-muted);
		text-transform: uppercase;
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.04em;
		margin-top: 4px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}
	.world-resource-row {
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
		color: var(--text-primary);
	}
	.world-resource-row:last-of-type {
		border-bottom: none;
	}
	.world-resource-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
		text-align: left;
	}
	.world-resource-name-btn {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		font: inherit;
		color: inherit;
		cursor: pointer;
		border-radius: 2px;
	}
	.world-resource-name-btn:hover {
		color: var(--accent-gold);
		text-decoration: underline;
	}
	.world-resource-name-btn:focus-visible {
		outline: 2px solid var(--accent-gold);
		outline-offset: 1px;
	}
	.world-resource-pid,
	.world-resource-mem,
	.world-resource-cpu {
		font-variant-numeric: tabular-nums;
		color: var(--accent-gold);
		font-weight: 600;
	}

	/* -- World perf monitor ---------------- */
	.world-perf-stack {
		position: relative;
		z-index: 0;
	}
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
	.world-perf-bus-hint {
		font-size: 9px;
		color: var(--text-muted);
		margin: 0 0 8px;
		line-height: 1.35;
	}
	.world-perf-bus-hint code {
		font-size: 8px;
	}
	.world-perf-bus-top-title {
		font-size: 9px;
		color: var(--text-secondary);
		text-transform: uppercase;
		font-weight: 600;
		margin: 8px 0 4px;
	}
	.world-perf-bus-empty {
		font-size: 10px;
		color: var(--text-muted);
		font-style: italic;
		margin: 4px 0 0;
	}

	.world-perf-agent-hint {
		font-size: 9px;
		color: var(--text-muted);
		margin: 0 0 8px;
		line-height: 1.4;
	}
	.world-perf-agent-hint code {
		font-size: 8px;
	}
	.world-perf-agent-pct {
		color: var(--text-muted);
		font-size: 9px;
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
	.world-perf-phase-bar--systems {
		background: linear-gradient(90deg, #0d9488, #22d3ee);
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
