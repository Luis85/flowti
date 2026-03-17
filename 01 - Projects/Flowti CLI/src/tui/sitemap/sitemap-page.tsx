/**
 * sitemap-page.tsx — Universal sitemap-driven page renderer.
 *
 * Reads a PageObject definition and renders:
 * - Header (label + description)
 * - Content zone (placeholder showing page kind — kind-based rendering comes in Chunk 6)
 * - EffectStrip (status line for running effects)
 * - SitemapActionBar (keyboard-wired actions)
 */

import React, { useCallback } from "react";
import { Box, Text } from "ink";
import type { PageObject } from "../../domain/sitemap/unified-page.js";
import { SitemapActionBar } from "./sitemap-action-bar.js";
import { EffectStrip } from "./effect-strip.js";
import { resolvePageActions, type SitemapActionDef } from "../hooks/use-sitemap-actions.js";
import { dispatchAction } from "../hooks/use-action-dispatch.js";
import { useActionEffect } from "../hooks/use-action-effect.js";
import { useNavigationContext } from "./navigation-context.js";
import { buildTuiFlatContext } from "../hooks/use-condition-context.js";
import { useTuiContext } from "../context.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";

interface SitemapPageProps {
	readonly page: PageObject;
	readonly pageId: string;
	readonly params: Record<string, string>;
	readonly registry?: TuiHandlerRegistry;
	readonly enabled?: boolean;
}

export function SitemapPage({ page, pageId, params, registry, enabled = true }: SitemapPageProps): React.JSX.Element {
	const tuiCtx = useTuiContext();
	const nav = useNavigationContext();
	const effect = useActionEffect();

	// Build condition context
	const flatCtx = buildTuiFlatContext(
		tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		undefined,
		undefined,
	);

	// Resolve actions — empty registry fallback for condition evaluation
	const noopRegistry = { hasCondition: () => false, getCondition: () => () => false };
	const actions = resolvePageActions(page.actions ?? [], flatCtx, registry ?? noopRegistry as never);

	// Build action context for handler dispatch
	const actionCtx: TuiActionContext = {
		deps: { disk: tuiCtx.deps.disk, paths: tuiCtx.deps.paths, clock: tuiCtx.deps.clock, shell: tuiCtx.deps.shell },
		session: { pipeline: {}, selectedProject: tuiCtx.projectPath },
		project: tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		params,
	};

	const handleAction = useCallback((action: SitemapActionDef) => {
		if (registry) {
			dispatchAction(action, nav, registry, actionCtx, effect.run);
		}
	}, [registry, nav, actionCtx, effect.run]);

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
		// Header
		React.createElement(Box, { paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, page.label),
			page.description
				? React.createElement(Text, { dimColor: true }, ` \u2014 ${page.description}`)
				: null,
		),

		// Content zone (kind-based rendering placeholder — will be enhanced per kind)
		React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, `[${page.kind}] ${pageId}`),
		),

		// Effect strip
		React.createElement(EffectStrip, { state: effect.state, message: effect.message }),

		// Action bar
		React.createElement(SitemapActionBar, { actions, onAction: handleAction, enabled }),
	);
}
