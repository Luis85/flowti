import { html, css, svg } from "lit";
import { FlowtiElement } from "../flowti-element.js";
import { tokens } from "../tokens.js";
import type { HealthScore } from "../../domain/projects/types.js";

const gaugeStyles = css`
	:host { display: block; width: 120px; height: 114px; }
	.gauge { width: 100%; height: 100%; }
	.arc-bg { fill: none; stroke: var(--background-modifier-border, #333); stroke-width: 8; }
	.arc-fill {
		fill: none;
		stroke-width: 8;
		stroke-linecap: round;
		transition: stroke-dashoffset 500ms ease-out, stroke 300ms ease;
	}
	.score-text {
		font-size: 20px;
		font-weight: 700;
		fill: var(--text-normal, #ddd);
		text-anchor: middle;
		dominant-baseline: middle;
	}
	.grade-text {
		font-size: 10px;
		font-weight: 500;
		fill: var(--text-muted, #999);
		text-anchor: middle;
	}
	.error { font-size: var(--flowti-font-sm, 0.85em); color: var(--color-red, #e53935); }
`;

export class FlowtiHealthGauge extends FlowtiElement {
	static properties = { ...FlowtiElement.properties, score: { type: Object }, gaugeError: { type: String } };
	static styles = [tokens, gaugeStyles];

	score: HealthScore | null = null;
	gaugeError = "";

	// Override render() directly so the base-class error-intercept does not
	// swallow the gauge's own error display (which lives inside the SVG).
	override render() {
		if (this.gaugeError) return html`<span class="error">${this.gaugeError}</span>`;
		if (!this.score) return html`<span class="muted">—</span>`;

		const pct = Math.max(0, Math.min(100, this.score.overall));
		const r = 40;
		const arcLength = Math.PI * r * 1.5; // 270° arc length
		const offset = arcLength * (1 - pct / 100);
		const color = pct < 40 ? "var(--color-red, #e53935)"
			: pct < 70 ? "var(--color-yellow, #e5a00d)"
			: "var(--color-green, #4caf50)";

		return html`
			<svg class="gauge" viewBox="0 0 100 95">
				${svg`
					<path class="arc-bg" d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28" />
					<path class="arc-fill"
						d="M 21.72 78.28 A 40 40 0 1 1 78.28 78.28"
						style="stroke: ${color}; stroke-dasharray: ${arcLength}; stroke-dashoffset: ${offset};
						       filter: drop-shadow(0 0 4px ${color});" />
					<text class="score-text" x="50" y="50">${pct}</text>
					<text class="grade-text" x="50" y="65">${this.score.grade}</text>
				`}
			</svg>
		`;
	}

	protected renderContent() {
		return html``;
	}
}

if (!customElements.get("flowti-health-gauge")) customElements.define("flowti-health-gauge", FlowtiHealthGauge);
