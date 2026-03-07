/**
 * paths.ts — Centralized path operations.
 *
 * All path manipulation should go through this module.
 * Re-exports node:path to maintain a single import source.
 */

import path from "node:path";

export const paths = {
	join: path.join,
	resolve: path.resolve,
	dirname: path.dirname,
	basename: path.basename,
	relative: path.relative,
	extname: path.extname,
	sep: path.sep,
};
