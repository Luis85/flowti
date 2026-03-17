/**
 * sitemap-action-bar.tsx — Keyboard-wired action bar from sitemap defs.
 *
 * Wraps ActionBar with useInput to dispatch key presses to the matching
 * SitemapActionDef handler. Disabled actions are not dispatched.
 */

import React from "react";
import { useInput } from "ink";
import { ActionBar } from "../primitives/action-bar.js";
import type { SitemapActionDef } from "../hooks/use-sitemap-actions.js";

interface SitemapActionBarProps {
	readonly actions: readonly SitemapActionDef[];
	readonly onAction: (action: SitemapActionDef) => void;
	readonly enabled?: boolean;
}

export function SitemapActionBar({ actions, onAction, enabled = true }: SitemapActionBarProps): React.JSX.Element {
	useInput((input) => {
		const match = actions.find((a) => a.key === input && !a.disabled);
		if (match) onAction(match);
	}, { isActive: enabled });

	return React.createElement(ActionBar, { actions });
}
