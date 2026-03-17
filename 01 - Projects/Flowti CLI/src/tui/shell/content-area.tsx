/**
 * content-area.tsx — Renders the active page component from the page registry.
 *
 * Passes `focused` (derived from focus zone) to the active page as `enabled`.
 * Pages that respect `enabled` will only consume keyboard input when content is focused.
 *
 * Escape handling: ContentArea owns the default Escape behavior (goBack / focus bar).
 * Pages that need to handle Escape themselves (e.g., FormPage) claim it via
 * EscapeContext.claim(), which prevents the default behavior from firing.
 */

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { getPage } from "../pages/page-registry.js";
import { PlaceholderPage } from "../pages/placeholder-page.js";
import { SitemapPage } from "../sitemap/sitemap-page.js";
import { useLoaderContext, useTuiContext } from "../context.js";

interface EscapeContextValue {
	readonly claim: () => void;
}

const EscapeCtx = createContext<EscapeContextValue>({ claim: () => {} });

export function useClaimEscape(): () => void {
	return useContext(EscapeCtx).claim;
}

interface ContentAreaProps {
	readonly pageId: string;
	readonly params: Readonly<Record<string, string>>;
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly focused: boolean;
	readonly onEscapeDefault: () => void;
}

export function ContentArea({ pageId, params, navigate, goBack, focused, onEscapeDefault }: ContentAreaProps): React.JSX.Element {
	const [actionError, setActionError] = useState<string | null>(null);
	const _ctx = useLoaderContext(params);
	const { sitemap, tuiRegistry } = useTuiContext();
	const Page = getPage(pageId);
	const escapeClaimedRef = useRef(false);

	const claimEscape = useCallback(() => {
		escapeClaimedRef.current = true;
	}, []);

	const handleAction = (_actionId: string, _params?: Record<string, string>) => {
		setActionError(null);
	};

	// Default Escape handler — fires AFTER page handlers (parent registers after children).
	// If a page claimed Escape via EscapeContext.claim(), we skip the default behavior.
	useInput((_input, key) => {
		if (key.escape) {
			if (escapeClaimedRef.current) {
				escapeClaimedRef.current = false;
				return;
			}
			onEscapeDefault();
		}
	}, { isActive: focused });

	// Determine which component to render:
	// 1. Custom registered page (not PlaceholderPage) — use it directly
	// 2. Sitemap has a definition for this pageId — use SitemapPage
	// 3. Fallback — use PlaceholderPage
	const isCustomPage = Page !== PlaceholderPage;
	const sitemapPageObj = sitemap?.pages[pageId];

	const renderPage = (): React.ReactNode => {
		if (isCustomPage) {
			return React.createElement(Page, { pageId, params, navigate, goBack, onAction: handleAction, enabled: focused });
		}
		if (sitemapPageObj) {
			return React.createElement(SitemapPage, { page: sitemapPageObj, pageId, params, registry: tuiRegistry, enabled: focused });
		}
		return React.createElement(PlaceholderPage, { pageId, params, navigate, goBack, onAction: handleAction, enabled: focused });
	};

	return (
		<Box flexGrow={1} flexDirection="column">
			{actionError !== null && (
				<Box paddingX={1} marginBottom={1}>
					<Text color="red" bold>Error: {actionError} </Text>
					<Text dimColor>(press any key to dismiss)</Text>
				</Box>
			)}
			<EscapeCtx.Provider value={{ claim: claimEscape }}>
				{renderPage()}
			</EscapeCtx.Provider>
		</Box>
	);
}
