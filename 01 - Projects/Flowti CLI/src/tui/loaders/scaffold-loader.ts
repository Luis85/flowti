/**
 * scaffold-loader.ts — Scaffold definitions loader.
 *
 * Lists available scaffold definitions from the scaffold service.
 */

import type { LoaderContext } from "./loader-types.js";
import { listDefinitions } from "../../domain/scaffold/scaffold-service.js";

export interface ScaffoldEntry {
	readonly name: string;
	readonly description: string;
}

export interface ScaffoldData {
	readonly definitions: readonly ScaffoldEntry[];
}

export function loadScaffold(_ctx: LoaderContext): ScaffoldData {
	try {
		const defs = listDefinitions();
		return {
			definitions: defs.map((d) => ({
				name: d.label,
				description: d.description,
			})),
		};
	} catch { return { definitions: [] }; }
}
