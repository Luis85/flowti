/**
 * navigation-context.tsx — React context for sitemap navigation.
 *
 * Provides navigate/goBack/refresh to any descendant component
 * via the useNavigationContext hook.
 */

import { createContext, useContext } from "react";
import React from "react";

export interface NavigationContextValue {
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly refresh: () => void;
}

const NavCtx = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly refresh: () => void;
	readonly children: React.ReactNode;
}

export function NavigationProvider({ navigate, goBack, refresh, children }: NavigationProviderProps): React.JSX.Element {
	const value: NavigationContextValue = { navigate, goBack, refresh };
	return React.createElement(NavCtx.Provider, { value }, children);
}

export function useNavigationContext(): NavigationContextValue {
	const ctx = useContext(NavCtx);
	if (!ctx) throw new Error("useNavigationContext must be used inside NavigationProvider");
	return ctx;
}
