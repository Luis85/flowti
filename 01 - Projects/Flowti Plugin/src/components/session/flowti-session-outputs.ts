import { html, css, nothing } from 'lit';
import { FlowtiElement } from '../flowti-element.js';

interface OutputArtifact {
	type: string;
	path: string;
	generatedAt: string;
}

/**
 * Output artifacts panel for completed/archived sessions.
 *
 * @property artifacts - Array of output artifact objects
 *
 * @fires output-open - detail: { path: string }
 * @fires output-generate - (no detail; handler opens modal externally)
 */
export class FlowtiSessionOutputs extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		artifacts: { type: Array },
	};

	static styles = [
		...FlowtiElement.styles,
		css`
			.section {
				padding: var(--flowti-space-sm) var(--flowti-space-md);
			}

			.header-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				margin-bottom: var(--flowti-space-sm);
			}

			.count {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}

			.generate-btn {
				margin-left: auto;
				display: inline-flex;
				align-items: center;
				gap: var(--flowti-space-xs);
				padding: var(--flowti-space-xs) var(--flowti-space-sm);
				border: 1px solid var(--flowti-border);
				border-radius: var(--flowti-radius);
				background: var(--background-secondary);
				color: var(--text-normal);
				cursor: pointer;
				font-size: var(--flowti-font-sm);
			}

			.generate-btn:hover {
				background: var(--background-modifier-hover);
			}

			.output-row {
				display: flex;
				align-items: center;
				gap: var(--flowti-space-sm);
				padding: var(--flowti-space-xs) 0;
				font-size: var(--flowti-font-sm);
			}

			.output-link {
				color: var(--text-accent);
				cursor: pointer;
				text-decoration: none;
				flex: 1;
			}

			.output-link:hover {
				text-decoration: underline;
			}

			.output-date {
				color: var(--flowti-color-muted);
			}

			.empty-text {
				color: var(--flowti-color-muted);
				font-size: var(--flowti-font-sm);
			}
		`,
	];

	artifacts: OutputArtifact[] = [];

	private onOpen(path: string): void {
		this.dispatchEvent(new CustomEvent('output-open', {
			detail: { path },
			bubbles: true,
			composed: true,
		}));
	}

	private onGenerate(): void {
		this.dispatchEvent(new CustomEvent('output-generate', {
			bubbles: true,
			composed: true,
		}));
	}

	protected renderContent() {
		return html`
			<div class="section">
				<div class="header-row">
					<strong>Output artifacts</strong>
					<span class="count">(${this.artifacts.length})</span>
					<button class="generate-btn" @click=${this.onGenerate}>Generate output</button>
				</div>
				${this.artifacts.length === 0
					? html`<div class="empty-text">No output artifacts generated yet.</div>`
					: this.artifacts.map((artifact) => html`
						<div class="output-row">
							<a
								class="output-link"
								title=${artifact.path}
								@click=${() => this.onOpen(artifact.path)}
							>${artifact.path.split('/').pop() ?? artifact.path}</a>
							<span class="output-date">${new Date(artifact.generatedAt).toISOString().split('T')[0]}</span>
						</div>
					`)
				}
			</div>
		`;
	}
}

if (!customElements.get('flowti-session-outputs')) customElements.define('flowti-session-outputs', FlowtiSessionOutputs);
