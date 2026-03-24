/**
 * needs-radar.ts — SVG hexagonal needs radar for agent cards.
 *
 * Renders a compact polygon-on-hexagon visualization of 6 agent needs.
 * The shape symmetry conveys health at a glance: symmetric = healthy,
 * lopsided = deficient. Color shifts green -> amber -> red.
 */

import { html, type TemplateResult } from "lit";
import { NEED_META, NEED_WARN_THRESHOLD, NEED_CRITICAL_THRESHOLD } from "./game-ui-constants.js";
import type { AgentNeeds } from "../systems/needs-system.js";

const FILL_OPACITY: Record<string, number> = { green: 0.35, amber: 0.35, red: 0.4 };
const STROKE_OPACITY: Record<string, number> = { green: 0.8, amber: 0.8, red: 0.9 };
const HEALTH_CSS: Record<string, string> = {
	green: "var(--accent-green, #4ed97a)",
	amber: "var(--accent-gold, #d9aa4e)",
	red: "var(--accent-red, #d94e4e)",
};

/** Determine radar color tier from the lowest need value. */
export function getRadarHealthColor(needs: AgentNeeds): "green" | "amber" | "red" {
	const values = NEED_META.map((m) => needs[m.key] ?? 0);
	const min = Math.min(...values);
	if (min < NEED_CRITICAL_THRESHOLD) return "red";
	if (min < NEED_WARN_THRESHOLD) return "amber";
	return "green";
}

/** Compute hexagon vertex at angle index (0-5) scaled to radius. */
function hexPoint(cx: number, cy: number, radius: number, index: number): string {
	const angle = (Math.PI / 3) * index - Math.PI / 2;
	const x = cx + radius * Math.cos(angle);
	const y = cy + radius * Math.sin(angle);
	return `${x.toFixed(1)},${y.toFixed(1)}`;
}

/** Build SVG polygon points string from 6 need values. */
function radarPoints(cx: number, cy: number, maxR: number, needs: AgentNeeds): string {
	return NEED_META.map((m, i) => {
		const value = Math.max(0, Math.min(100, needs[m.key] ?? 0));
		const r = (value / 100) * maxR;
		return hexPoint(cx, cy, r, i);
	}).join(" ");
}

/** Build the outer reference hexagon points at full radius. */
function hexagonPoints(cx: number, cy: number, radius: number): string {
	return Array.from({ length: 6 }, (_, i) => hexPoint(cx, cy, radius, i)).join(" ");
}

/**
 * Render a compact hexagonal needs radar as inline SVG.
 * Returns an html template — embed directly in Lit render output.
 */
export function renderNeedsRadar(needs: AgentNeeds | undefined, size: number): TemplateResult {
	const cx = size / 2;
	const cy = size / 2;
	const maxR = size * 0.43;

	const safeNeeds: AgentNeeds = needs ?? { energy: 0, social: 0, focus: 0, morale: 0, hunger: 0, thirst: 0 };
	const health = getRadarHealthColor(safeNeeds);
	const color = HEALTH_CSS[health];
	const fillOp = FILL_OPACITY[health];
	const strokeOp = STROKE_OPACITY[health];

	const outerPts = hexagonPoints(cx, cy, maxR);
	const dataPts = radarPoints(cx, cy, maxR, safeNeeds);

	return html`
		<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block">
			<polygon points="${outerPts}" fill="none" stroke="var(--border, #1e2a42)" stroke-width="0.5" opacity="0.3"/>
			<polygon points="${dataPts}" fill="${color}" fill-opacity="${fillOp}" stroke="${color}" stroke-width="1" stroke-opacity="${strokeOp}"/>
		</svg>
	`;
}
