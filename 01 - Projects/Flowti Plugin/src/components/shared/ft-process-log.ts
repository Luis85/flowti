/**
 * ft-process-log — Reusable terminal-style output log component.
 *
 * Displays streaming process output lines with auto-scroll,
 * optional busy spinner, error display, and dismiss button.
 *
 * Usage:
 *   <ft-process-log
 *     .lines=${["line 1", "line 2"]}
 *     .busy=${true}
 *     .busyLabel=${"Installing..."}
 *     .errorNote=${"Failed to start"}
 *   ></ft-process-log>
 */

import { LitElement, html, css, nothing } from "lit";

export class FtProcessLog extends LitElement {
	static properties = {
		lines: { type: Array },
		busy: { type: Boolean },
		busyLabel: { type: String, attribute: "busy-label" },
		errorNote: { type: String, attribute: "error-note" },
		maxLines: { type: Number, attribute: "max-lines" },
		collapsed: { state: true },
	};

	static styles = css`
		:host {
			display: block;
			font-family: "Menlo", "Consolas", "DejaVu Sans Mono", monospace;
			font-size: 11px;
		}

		.log-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 4px 8px;
			background: var(--background-secondary, #1e1e2e);
			border-bottom: 1px solid var(--background-modifier-border, #333);
			color: var(--text-muted, #888);
			font-size: 10px;
			font-family: inherit;
		}

		.log-header-left {
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.spinner {
			display: inline-block;
			width: 10px;
			height: 10px;
			border: 2px solid var(--text-muted, #888);
			border-top-color: var(--interactive-accent, #7c3aed);
			border-radius: 50%;
			animation: spin 0.8s linear infinite;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.dismiss-btn {
			background: transparent;
			border: none;
			color: var(--text-muted, #888);
			cursor: pointer;
			font-size: 14px;
			padding: 0 4px;
			line-height: 1;
		}

		.dismiss-btn:hover {
			color: var(--text-normal, #ccc);
		}

		.output-log {
			max-height: 200px;
			overflow-y: auto;
			padding: 6px 8px;
			background: var(--background-primary, #0d0d14);
			color: var(--text-normal, #c4c4c4);
			white-space: pre-wrap;
			word-break: break-word;
			line-height: 1.5;
			scrollbar-width: thin;
			scrollbar-color: var(--background-modifier-border, #333) transparent;
		}

		.error-bar {
			padding: 6px 8px;
			background: color-mix(in srgb, var(--text-error, #e53e3e) 12%, transparent);
			color: var(--text-error, #e53e3e);
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 11px;
		}

		.empty {
			padding: 12px 8px;
			color: var(--text-faint, #666);
			font-style: italic;
			text-align: center;
		}
	`;

	lines: string[] = [];
	busy = false;
	busyLabel = "Processing...";
	errorNote = "";
	maxLines = 200;
	private collapsed = false;

	updated(changed: Map<string, unknown>): void {
		super.updated(changed);
		if (changed.has("lines") && !this.collapsed) {
			const log = this.shadowRoot?.querySelector(".output-log");
			if (log) log.scrollTop = log.scrollHeight;
		}
	}

	private handleDismiss(): void {
		this.lines = [];
		this.errorNote = "";
		this.collapsed = false;
		this.dispatchEvent(new CustomEvent("dismiss"));
	}

	render() {
		const hasOutput = this.lines.length > 0;
		const hasError = !!this.errorNote;

		if (!hasOutput && !hasError && !this.busy) return nothing;

		return html`
			${this.busy ? html`
				<div class="log-header">
					<div class="log-header-left">
						<span class="spinner"></span>
						<span>${this.busyLabel}</span>
					</div>
				</div>
			` : hasOutput ? html`
				<div class="log-header">
					<div class="log-header-left">
						<span>Output (${this.lines.length} lines)</span>
					</div>
					<button class="dismiss-btn" @click=${this.handleDismiss} title="Dismiss">&times;</button>
				</div>
			` : nothing}

			${hasOutput ? html`
				<div class="output-log">${this.lines.join("\n")}</div>
			` : this.busy ? html`
				<div class="empty">Waiting for output...</div>
			` : nothing}

			${hasError ? html`
				<div class="error-bar">
					<span>${this.errorNote}</span>
					<button class="dismiss-btn" @click=${() => { this.errorNote = ""; }} title="Dismiss">&times;</button>
				</div>
			` : nothing}
		`;
	}
}

if (!customElements.get("ft-process-log")) customElements.define("ft-process-log", FtProcessLog);
