import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { hubButton } from "../shared-styles.js";
import { css } from "lit";
import type { ReportGeneratorInfo } from "../../domain/projects/types.js";

const styles = css`
	h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.report-list { display: flex; flex-direction: column; gap: 6px; }
	.gen { display: flex; align-items: center; gap: 8px; font-size: var(--flowti-font-sm, 0.85em); }
	.state { font-size: 0.75em; opacity: 0.8; }
	pre.log { font-size: 11px; max-height: 200px; overflow: auto; background: var(--background-secondary, #262626); padding: 8px; border-radius: var(--hub-radius, 6px); }
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

	static styles = [tokens, hubButton, styles];

	projectName = "";
	generators: ReportGeneratorInfo[] = [];
	nodeStates: Record<string, string> = {};
	outputLines: string[] = [];
	busy = false;

	protected renderContent() {
		return html`
			<h3>Reports</h3>
			<div class="report-list">
				<button type="button" class="hub-btn" ?disabled="${this.busy}" @click="${() => this.emit("report-run-all", {})}">Run all</button>
				${this.generators.map((g) => {
					const runId = (g.id ?? "").trim();
					return html`
					<div class="gen">
						<button
							type="button"
							class="hub-btn"
							?disabled="${this.busy || !runId}"
							title="${runId ? `Run ${g.label}` : "Generator has no id in config"}"
							@click="${() => runId && this.emit("report-run", { generatorId: runId })}"
						>${g.label}</button>
						<span class="state">${this.nodeStates[runId] ?? ""}</span>
					</div>
				`;
				})}
			</div>
			${this.outputLines.length > 0 ? html`<pre class="log">${this.outputLines.join("\n")}</pre>` : ""}
		`;
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-reporting")) customElements.define("flowti-tab-reporting", FlowtiTabReporting);
