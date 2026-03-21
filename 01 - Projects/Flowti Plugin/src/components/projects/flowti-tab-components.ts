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
	.intro { line-height: 1.45; margin: 0 0 14px; max-width: 52em; }
	.storybook-status {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0 0 10px;
		font-size: var(--flowti-font-sm, 0.85em);
		color: var(--interactive-accent, #a78bfa);
	}
	.mini-spin {
		width: 12px;
		height: 12px;
		border: 2px solid currentColor;
		border-top-color: transparent;
		border-radius: 50%;
		animation: ft-spin 0.75s linear infinite;
		flex-shrink: 0;
	}
	@keyframes ft-spin {
		to {
			transform: rotate(360deg);
		}
	}
	.storybook-error {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px 12px;
		margin: 0 0 10px;
		padding: 8px 10px;
		border-radius: 6px;
		font-size: var(--flowti-font-sm, 0.85em);
		background: color-mix(in srgb, var(--color-red, #e53935) 12%, transparent);
		color: color-mix(in srgb, var(--color-red, #f87171) 90%, var(--text-normal, #ddd));
		border: 1px solid color-mix(in srgb, var(--color-red, #e53935) 35%, transparent);
	}
	.btn--tiny {
		padding: 4px 10px;
		font-size: 0.85em;
	}
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
		const sb = this.storybookBusy;
		return html`
			<div class="components-root" aria-busy="${String(sb)}">
			<p class="muted intro">
				<strong>Components</strong> lists what lives in your project. <strong>Storybook</strong> below is optional tooling for stories, static builds, and importing markdown or canvas into the
				sitemap — it is not the project itself.
			</p>
			<div class="section">
				<h3>Storybook</h3>
				<p class="muted">${this.storybookInstalled ? `Installed (${this.storybookFramework || "?"})` : "Not installed"}${this.storybookRunning ? ` — running ${this.storybookUrl}` : ""}</p>
				${sb ? html`<p class="storybook-status" role="status" aria-live="polite"><span class="mini-spin" aria-hidden="true"></span>${this.storybookBusyLabel || "Working…"}</p>` : ""}
				${this.storybookError
					? html`
						<div class="storybook-error" role="alert">
							<span>${this.storybookError}</span>
							<button type="button" class="btn btn--tiny" @click="${() => this.emit("storybook-dismiss-error", {})}">Dismiss</button>
						</div>
					`
					: ""}
				<div class="row">
					${!this.storybookInstalled
						? html`
							<button type="button" class="btn btn--primary" ?disabled="${sb}" @click="${() => this.emit("storybook-install", { framework: "html" })}">Install (HTML)</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-install", { framework: "react" })}">React</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-install", { framework: "vue3" })}">Vue</button>
						`
						: html`
							<button type="button" class="btn btn--primary" ?disabled="${sb}" @click="${() => this.emit("storybook-start", {})}">Start</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-stop", {})}">Stop</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-build", {})}">Build</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-view", { url: this.storybookUrl || "http://localhost:6006" })}">Open</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-preview", {})}">Preview static</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-import", {})}">Import MD → sitemap</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-canvas-import", {})}">Import canvas</button>
							<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("storybook-regenerate-confirmed", {})}">Regenerate</button>
						`}
				</div>
			</div>
			<div class="section">
				<h3>Components (${this.components.length})</h3>
				<button type="button" class="btn" ?disabled="${sb}" @click="${() => this.emit("components-refresh", {})}">Refresh list</button>
				<div class="list">
					${this.components.map((c) => html`<div>${c.name} <span class="muted">(${c.category})</span></div>`)}
				</div>
			</div>
			${this.storybookOutput.length > 0
				? html`
					<div class="section">
						<h3>Storybook CLI log <button type="button" class="btn" @click="${() => this.emit("storybook-dismiss-output", {})}">Clear</button></h3>
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
