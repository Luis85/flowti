/**
 * use-condition-context.ts — Builds a flat boolean context for condition evaluation in the TUI.
 *
 * Bridges TUI state (project, tools, config) into the `Record<string, boolean>`
 * format expected by the expression evaluator in sitemap-conditions.ts.
 */

const CONFIG_SECTIONS = ["build", "test", "publish", "review", "reports", "health", "management"] as const;

export function buildTuiFlatContext(
	project: { readonly name: string; readonly path: string } | undefined,
	tools: Readonly<Record<string, boolean>> | undefined,
	config: Record<string, unknown> | undefined,
): Record<string, boolean> {
	const flat: Record<string, boolean> = {};

	flat["project"] = project !== undefined;

	if (tools) {
		for (const [key, val] of Object.entries(tools)) {
			flat[`tools.${key}`] = Boolean(val);
		}
	}

	for (const section of CONFIG_SECTIONS) {
		flat[`config.${section}`] = config?.[section] !== undefined;
	}

	return flat;
}
