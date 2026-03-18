import { html, css } from 'lit';
import { FlowtiElement } from '../flowti-element.js';
import type { ServerConfig } from '../../domain/server/types.js';

/**
 * Server configuration form with dirty tracking.
 *
 * @property config - Current server configuration (port, logLevel, autoConnect)
 *
 * @fires config-apply - detail: { port, logLevel, autoConnect } when Apply & Restart is clicked
 */
export class FlowtiServerConfig extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		config: { type: Object },
		_dirty: { type: Boolean, state: true },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.config-form {
				display: flex;
				flex-direction: column;
				gap: var(--flowti-space-md);
			}

			.config-field {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
			}

			.config-field label {
				font-size: var(--flowti-font-sm);
				min-width: 100px;
			}

			.config-field input[type="number"],
			.config-field select {
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-primary);
				color: var(--text-normal);
				font-size: var(--flowti-font-sm);
			}

			.config-field input[type="checkbox"] {
				cursor: pointer;
			}

			.config-actions {
				margin-top: var(--flowti-space-sm);
			}

			.config-actions button {
				padding: var(--flowti-space-xs) var(--flowti-space-md);
				border: none;
				border-radius: var(--flowti-radius);
				background: var(--interactive-accent);
				color: var(--text-on-accent);
				font-size: var(--flowti-font-sm);
				cursor: pointer;
			}

			.config-actions button:disabled {
				opacity: 0.5;
				cursor: not-allowed;
			}
		`,
	];

	config: ServerConfig = { port: 3000, logLevel: 'info', autoConnect: false };

	private _dirty = false;
	private _initialConfig: ServerConfig = { port: 3000, logLevel: 'info', autoConnect: false };

	willUpdate(changed: Map<string, unknown>): void {
		if (changed.has('config')) {
			this._initialConfig = { ...this.config };
			this._dirty = false;
		}
	}

	private checkDirty(): void {
		const portInput = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="number"]');
		const selectInput = this.shadowRoot?.querySelector<HTMLSelectElement>('select');
		const checkboxInput = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="checkbox"]');

		if (!portInput || !selectInput || !checkboxInput) return;

		const currentPort = Number(portInput.value);
		const currentLogLevel = selectInput.value;
		const currentAutoConnect = checkboxInput.checked;

		this._dirty =
			currentPort !== this._initialConfig.port ||
			currentLogLevel !== this._initialConfig.logLevel ||
			currentAutoConnect !== this._initialConfig.autoConnect;
	}

	private handleApply(): void {
		const portInput = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="number"]');
		const selectInput = this.shadowRoot?.querySelector<HTMLSelectElement>('select');
		const checkboxInput = this.shadowRoot?.querySelector<HTMLInputElement>('input[type="checkbox"]');

		if (!portInput || !selectInput || !checkboxInput) return;

		this.dispatchEvent(
			new CustomEvent('config-apply', {
				detail: {
					port: Number(portInput.value),
					logLevel: selectInput.value,
					autoConnect: checkboxInput.checked,
				},
				bubbles: true,
				composed: true,
			}),
		);
	}

	protected renderContent() {
		return html`
			<div class="config-form">
				<div class="config-field">
					<label>Port</label>
					<input
						type="number"
						.value=${String(this.config.port)}
						@input=${() => this.checkDirty()}
					/>
				</div>
				<div class="config-field">
					<label>Log Level</label>
					<select
						.value=${this.config.logLevel}
						@change=${() => this.checkDirty()}
					>
						<option value="debug">debug</option>
						<option value="info">info</option>
						<option value="warn">warn</option>
						<option value="error">error</option>
					</select>
				</div>
				<div class="config-field">
					<label>Auto-connect</label>
					<input
						type="checkbox"
						.checked=${this.config.autoConnect}
						@change=${() => this.checkDirty()}
					/>
				</div>
				<div class="config-actions">
					<button
						?disabled=${!this._dirty}
						@click=${() => this.handleApply()}
					>Apply &amp; Restart</button>
				</div>
			</div>
		`;
	}
}

if (!customElements.get('flowti-server-config')) customElements.define('flowti-server-config', FlowtiServerConfig);
