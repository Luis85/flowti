import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { css } from "lit";
import type { ComponentEntry } from "../../domain/projects/types.js";

const styles = css`
	.section { margin-bottom: var(--flowti-space-md, 16px); }
	h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.row { display: flex; flex-wrap: wrap; gap: 8px; }
	.btn {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border, #333);
		background: var(--background-secondary, #262626);
		color: var(--text-normal, #ddd);
		font-size: var(--flowti-font-sm, 0.85em);
		cursor: pointer;
	}
	.btn--primary {
		background: var(--interactive-accent, #7c3aed);
		border-color: var(--interactive-accent, #7c3aed);
		color: #fff;
	}
	.muted { color: var(--text-muted, #999); font-size: var(--flowti-font-sm, 0.85em); }
	.list { font-size: var(--flowti-font-sm, 0.85em); max-height: 200px; overflow: auto; }
	pre.log { font-size: 11px; max-height: 180px; overflow: auto; background: var(--background-secondary, #262626); padding: 8px; border-radius: 4px; margin: 0; }
	.btn:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.btn:disabled { opacity: 0.5; cursor: not-allowed; }
`;

export class FlowtiTabComponents extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		components: { type: Array },
		storybookInstalled: { type: Boolean },
		storybookFramework: { type: String },
		storybookRunning: { type: Boolean },
		storybookUrl: { type: String },
		storybookBusy: { type: Boolean },
		storybookBusyLabel: { type: String },
		storybookOutput: { type: Array },
		storybookError: { type: String },
		hasCanvas: { type: Boolean },
		hasSitemap: { type: Boolean },
		canvasPreset: { type: String },
		canvasChanged: { type: Boolean },
	};

	static styles = [tokens, styles];

	projectName = "";
	components: ComponentEntry[] = [];
	storybookInstalled = false;
	storybookFramework = "";
	storybookRunning = false;
	storybookUrl = "";
	storybookBusy = false;
	storybookBusyLabel = "";
	storybookOutput: string[] = [];
	storybookError = "";
	hasCanvas = false;
	hasSitemap = false;
	canvasPreset = "";
	canvasChanged = false;

	protected renderContent() {
		return html`
			<div aria-busy="${this.storybookBusy}">
			<div class="section">
				<h3>Storybook</h3>
				<p class="muted">${this.storybookInstalled ? `Installed (${this.storybookFramework || "?"})` : "Not installed"}${this.storybookRunning ? ` — running ${this.storybookUrl}` : ""}</p>
				<div class="row">
					${!this.storybookInstalled
						? html`
							<button type="button" class="btn btn--primary" ?disabled="${this.storybookBusy}" @click="${() => this.emit("storybook-install", { framework: "html" })}">Install (HTML)</button>
							<button type="button" class="btn" ?disabled="${this.storybookBusy}" @click="${() => this.emit("storybook-install", { framework: "react" })}">React</button>
							<button type="button" class="btn" ?disabled="${this.storybookBusy}" @click="${() => this.emit("storybook-install", { framework: "vue3" })}">Vue</button>
						`
						: html`
							<button type="button" class="btn btn--primary" @click="${() => this.emit("storybook-start", {})}">Start</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-stop", {})}">Stop</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-build", {})}">Build</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-view", { url: this.storybookUrl || "http://localhost:6006" })}">Open</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-preview", {})}">Preview static</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-import", {})}">Import MD → sitemap</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-canvas-import", {})}">Import canvas</button>
							<button type="button" class="btn" @click="${() => this.emit("storybook-regenerate-confirmed", {})}">Regenerate</button>
						`}
				</div>
			</div>
			<div class="section">
				<h3>Components (${this.components.length})</h3>
				<button type="button" class="btn" ?disabled="${this.storybookBusy}" @click="${() => this.emit("components-refresh", {})}">Refresh list</button>
				<div class="list">
					${this.components.map((c) => html`<div>${c.name} <span class="muted">(${c.category})</span></div>`)}
				</div>
			</div>
			${this.storybookOutput.length > 0
				? html`
					<div class="section">
						<h3>Output <button type="button" class="btn" @click="${() => this.emit("storybook-dismiss-output", {})}">Clear</button></h3>
						<pre class="log">${this.storybookOutput.join("\n")}</pre>
					</div>
				`
				: ""}
			</div>
		`;
	}

	private emit(name: string, detail: Record<string, unknown> = {}): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-components")) customElements.define("flowti-tab-components", FlowtiTabComponents);
