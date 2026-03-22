import { html } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import { hubButton } from "../shared-styles.js";
import { css } from "lit";
import type { ProjectConfig, TeamRoleSlot } from "../../domain/projects/types.js";

const styles = css`
	h3 { font-size: 0.95em; margin: 0 0 8px; color: var(--text-muted, #999); }
	.field { margin-bottom: 10px; }
	label { display: block; font-size: var(--flowti-font-sm, 0.85em); color: var(--text-muted, #999); margin-bottom: 4px; }
	input, select { width: 100%; box-sizing: border-box; font-size: var(--flowti-font-sm, 0.85em); padding: 6px 8px; background: var(--background-primary, #1e1e1e); color: var(--text-normal, #ddd); border: 1px solid var(--background-modifier-border, #333); border-radius: var(--hub-radius, 6px); }
	.row { display: flex; gap: 8px; align-items: center; }
	input:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--interactive-accent, #7c3aed);
		outline-offset: 2px;
	}
	.status { font-size: var(--flowti-font-sm, 0.85em); color: var(--color-green, #4caf50); margin-top: 8px; }
`;

export class FlowtiTabConfig extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		projectName: { type: String },
		config: { type: Object },
		hasCanvas: { type: Boolean },
		/** True while another tab runs a project-wide CLI action (team save, etc.). */
		hubLocked: { type: Boolean, attribute: "hub-locked" },
		saveStatus: { type: String },
		sourcePath: { type: String },
		strategy: { type: String },
		requiredFields: { type: String },
	};

	static styles = [tokens, hubButton, styles];

	projectName = "";
	config: ProjectConfig | undefined;
	hasCanvas = false;
	hubLocked = false;
	saveStatus = "";
	sourcePath = "";
	strategy = "category";
	requiredFields = "name,category";

	updated(changed: Map<string, unknown>): void {
		super.updated(changed);
		if (changed.has("config") && this.config?.markdownSource) {
			const ms = this.config.markdownSource;
			this.sourcePath = ms.path;
			this.strategy = ms.strategy;
			this.requiredFields = ms.requiredFields.join(",");
		}
	}

	protected renderContent() {
		const roster = this.config?.agents?.join(", ") ?? "";
		const roleSlots = (this.config?.roleSlots ?? []) as TeamRoleSlot[];
		const slots = roleSlots.length;
		const fteTotal = roleSlots.reduce(
			(a, s) => a + (typeof s.roleFte === "number" && Number.isFinite(s.roleFte) ? s.roleFte : 0),
			0,
		);
		const anyFte = roleSlots.some((s) => s.roleFte != null && Number.isFinite(s.roleFte));
		const fteLabel = anyFte ? (fteTotal % 1 === 0 ? String(fteTotal) : fteTotal.toFixed(2)) : "—";
		return html`
			<h3>flowti.config.json</h3>
			<p style="font-size:var(--flowti-font-sm,0.85em);color:var(--text-muted,#999);line-height:1.45;max-width:52em;margin:0 0 10px">
				<strong>configs/sitemap.json</strong> is the source of truth for the product map and Storybook workflow. Sketch in <strong>sitemap.canvas</strong> (Overview), sync there, or import markdown from the folder below (run import on the Components tab).
			</p>
			<p style="font-size:var(--flowti-font-sm,0.85em);color:var(--text-muted,#999)">Markdown import source</p>
			<div class="field">
				<label>Source folder (vault-relative or absolute)</label>
				<div class="row">
					<input type="text" .value="${this.sourcePath}" @input="${(e: Event) => { this.sourcePath = (e.target as HTMLInputElement).value; }}" />
					<button type="button" class="hub-btn" @click="${() => this.emit("config-browse-folder", {})}">Browse</button>
				</div>
			</div>
			<div class="field">
				<label>Strategy</label>
				<select .value="${this.strategy}" @change="${(e: Event) => { this.strategy = (e.target as HTMLSelectElement).value; }}">
					<option value="category">category</option>
					<option value="flat">flat</option>
					<option value="hierarchical">hierarchical</option>
				</select>
			</div>
			<div class="field">
				<label>Required fields (comma-separated)</label>
				<input type="text" .value="${this.requiredFields}" @input="${(e: Event) => { this.requiredFields = (e.target as HTMLInputElement).value; }}" />
			</div>
			<button type="button" class="hub-btn hub-btn--primary" ?disabled="${this.hubLocked}" @click="${this.save}">Save markdown source config</button>
			${this.saveStatus ? html`<div class="status">${this.saveStatus}</div>` : ""}
			<hr style="border:none;border-top:1px solid var(--background-modifier-border,#333);margin:16px 0" />
			<p style="font-size:var(--flowti-font-sm,0.85em);color:var(--text-muted,#999)">
				Team roster (edit on <strong>Team</strong> tab): ${slots} role slot(s), Σ FTE ${fteLabel}, dashboard agents: ${roster || "—"}
			</p>
			${this.hasCanvas ? html`
				<div style="margin-top:12px">
					<button type="button" class="hub-btn" @click="${() => this.emit("canvas-open", {})}">Open sitemap.canvas</button>
					<button type="button" class="hub-btn" ?disabled="${this.hubLocked}" @click="${() => this.emit("canvas-merge", {})}">Sync canvas → sitemap.json</button>
				</div>
			` : ""}
		`;
	}

	private save(): void {
		const requiredFields = this.requiredFields.split(",").map((s) => s.trim()).filter(Boolean);
		this.emit("config-save", { path: this.sourcePath, strategy: this.strategy, requiredFields });
	}

	private emit(name: string, detail: Record<string, unknown>): void {
		this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
	}
}

if (!customElements.get("flowti-tab-config")) customElements.define("flowti-tab-config", FlowtiTabConfig);
