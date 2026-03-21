/**
 * Shared labels / ordering for per-agent canvas perf slices
 * (`perf.agentWorld.sample.perAgentCanvas`).
 */

export const CANVAS_SLICE_ORDER = ["brain", "needs", "talk", "reactive", "thresholds", "objects"] as const;

export const CANVAS_SLICE_LABELS: Record<string, string> = {
	brain: "Brain & movement",
	needs: "Needs / mood",
	talk: "Ambient talk",
	reactive: "Reactive triggers",
	thresholds: "Need thresholds",
	objects: "Object attraction",
};

export function formatCanvasPerfMs(ms: number): string {
	if (ms < 0.05) return "0";
	if (ms < 10) return ms.toFixed(2);
	return String(Math.round(ms));
}
