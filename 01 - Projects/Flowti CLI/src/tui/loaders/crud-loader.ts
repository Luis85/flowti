/**
 * crud-loader.ts — Generic CRUD loader factory for store-backed pages.
 *
 * Wraps any StoreApi.list() call into a typed LoaderFn.
 * All 7 management domain pages use this pattern.
 */

import type { LoaderContext } from "./loader-types.js";
import type { StoreApi } from "../../infrastructure/store-engine.js";

export interface CrudPageData<TSummary> {
	readonly items: readonly TSummary[];
}

export function createCrudLoader<TSummary, TDef>(
	store: StoreApi<TSummary, TDef>,
): (ctx: LoaderContext) => CrudPageData<TSummary> {
	return (ctx: LoaderContext): CrudPageData<TSummary> => {
		if (!ctx.projectPath) return { items: [] };
		try {
			const items = store.list(ctx.deps, ctx.projectPath);
			return { items };
		} catch {
			return { items: [] };
		}
	};
}
