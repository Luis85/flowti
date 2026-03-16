/**
 * knowledgebase-loader.ts — Knowledgebase availability loader.
 *
 * Checks whether the knowledgebase is available via the knowledgebase domain service.
 */

import type { LoaderContext } from "./loader-types.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";

export interface KnowledgebaseData {
	readonly available: boolean;
}

export function loadKnowledgebase(ctx: LoaderContext): KnowledgebaseData {
	try {
		return { available: isKnowledgebaseAvailable(ctx.vaultRoot, ctx.deps) };
	} catch { return { available: false }; }
}
