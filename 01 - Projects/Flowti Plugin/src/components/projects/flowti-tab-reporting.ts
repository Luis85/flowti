import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";
import type { ReportGeneratorInfo } from "../../domain/projects/types.js";

const styles = css`
	h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.btn {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
		margin-right: 8px;
		margin-bottom: 8px;
	}
	.btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.gen { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: var(--flowti-font-sm, 0.85em); }
	.state { font-size: 0.75em; opacity: 0.8; }
	pre.log { font-size: 11px; max-height: 200px; overflow: auto; background: var(--background-secondary, #262626); padding: 8px; border-radius: 4px; }
`;

export class FlowtiTabReporting extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		generators: { type: Array },
		nodeStates: { type: Object },
		outputLines: { type: Array },
		busy: { type: Boolean },
	};

	static styles = [tokens, styles];

	projectName = "";
	generators: ReportGeneratorInfo[] = [];
	nodeStates: Record<string, string> = {};
	outputLines: string[] = [];
	busy = false;

	protected renderContent() {
		return html`
			<h3>Reports</h3>
			<button type="button" class="btn" ?disabled="${this.busy}" @click="${() => this.emit("report-run-all", {})}">Run all</button>
			${this.generators.map((g) => {
				const runId = (g.id ?? "").trim();
				return html`
				<div class="gen">
					<button
						type="button"
						class="btn"
						?disabled="${this.busy || !runId}"
						title="${runId ? `Run ${g.label}` : "Generator has no id in config"}"
						@click="${() => runId && this.emit("report-run", { generatorId: runId })}"
					>${g.label}</button>
					<span class="state">${this.nodeStates[runId] ?? ""}</span>
				</div>
			`;
			})}
			${this.outputLines.length > 0 ? html`<pre class="log">${this.outputLines.join("\n")}</pre>` : ""}
		`;
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-reporting")) customElements.define("flowti-tab-reporting", FlowtiTabReporting);
