/**
 * context.tsx — React Context providing infrastructure deps to TUI pages.
 *
 * TuiProvider wraps the App component and provides LoaderContext building blocks.
 * Pages access deps via useTuiContext() to build LoaderContext for useLoader.
 */

import React, { createContext, useContext, useMemo } from "react";
import type { LoaderDeps, LoaderContext } from "./loaders/loader-types.js";
import type { AgentsConfig, IterationsConfig, ProjectConfig } from "../infrastructure/types-config.js";
import type { IAgentProcessRunner } from "../domain/agents/worker-types.js";
import type { UnifiedSitemap } from "../domain/sitemap/unified-page.js";
import type { TuiHandlerRegistry } from "./registry/tui-handler-registry.js";
import type { TuiSessionStore } from "./registry/tui-handler-types.js";
import type { TuiActionDeps } from "../infrastructure/deps.js";

export interface TuiContextValue {
	readonly deps: LoaderDeps;
	readonly vaultRoot: string;
	readonly projectPath: string;
	readonly projectsDir: string;
	readonly agentsConfig: AgentsConfig | undefined;
	readonly iterationsConfig: IterationsConfig | undefined;
	readonly projectConfig: ProjectConfig | undefined;
	readonly processRunner: IAgentProcessRunner;
	readonly sitemap?: UnifiedSitemap;
	readonly tuiRegistry?: TuiHandlerRegistry;
	readonly session?: TuiSessionStore;
	readonly actionDeps?: TuiActionDeps;
}

const TuiCtx = createContext<TuiContextValue | null>(null);

interface TuiProviderProps {
	readonly value: TuiContextValue;
	readonly children?: React.ReactNode;
}

export function TuiProvider({ value, children }: TuiProviderProps): React.JSX.Element {
	return React.createElement(TuiCtx.Provider, { value }, children);
}

export function useTuiContext(): TuiContextValue {
	const ctx = useContext(TuiCtx);
	if (!ctx) throw new Error("useTuiContext must be used within TuiProvider");
	return ctx;
}

export function useLoaderContext(params: Readonly<Record<string, string>>): LoaderContext {
	const tui = useTuiContext();
	return useMemo(() => ({
		deps: tui.deps,
		vaultRoot: tui.vaultRoot,
		projectPath: tui.projectPath,
		projectsDir: tui.projectsDir,
		agentsConfig: tui.agentsConfig,
		params,
	}), [tui, params]);
}
