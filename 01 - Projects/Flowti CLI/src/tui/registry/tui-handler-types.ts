/**
 * tui-handler-types.ts — Type definitions for TUI handler registry.
 *
 * Defines the context, result types, and handler signatures used by
 * the sitemap-driven TUI renderer.
 */

import type { TuiActionDeps } from "../../infrastructure/deps.js";
import type { MenuEntry } from "../../infrastructure/types.js";

export interface TuiSessionStore {
	pipeline: Record<string, unknown>;
	selectedProject?: string;
}

export interface TuiActionContext {
	readonly deps: TuiActionDeps;
	readonly session: TuiSessionStore;
	readonly project?: { readonly name: string; readonly path: string };
	readonly tools?: Readonly<Record<string, boolean>>;
	readonly params?: Readonly<Record<string, string>>;
}

export type TuiActionResult =
	| { readonly kind: "ok"; readonly message?: string }
	| { readonly kind: "navigate"; readonly target: string; readonly params?: Record<string, string> }
	| { readonly kind: "error"; readonly message: string };

export type TuiActionHandler = (ctx: TuiActionContext) => Promise<TuiActionResult>;

export type TuiFormHandler = (ctx: TuiActionContext, data: Record<string, unknown>) => Promise<TuiActionResult>;

export type TuiConditionHandler = (ctx: TuiActionContext) => boolean;

export type TuiDataSourceHandler = (ctx: TuiActionContext, params?: Readonly<Record<string, unknown>>) => MenuEntry[];
