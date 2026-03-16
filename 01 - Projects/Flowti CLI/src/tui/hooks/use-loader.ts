/**
 * use-loader.ts — Data loading hook for TUI pages.
 *
 * Calls the loader function on mount and exposes refresh().
 * Loaders are synchronous (domain functions are sync) — no async needed.
 */

import { useState, useCallback, useMemo } from "react";
import type { LoaderContext, LoaderFn } from "../loaders/loader-types.js";

interface UseLoaderResult<T> {
	readonly data: T | null;
	readonly loading: boolean;
	readonly error: string | null;
	readonly refresh: () => void;
}

export function useLoader<T>(loader: LoaderFn<T>, ctx: LoaderContext): UseLoaderResult<T> {
	const [revision, setRevision] = useState(0);

	const { data, error } = useMemo(() => {
		try {
			return { data: loader(ctx), error: null };
		} catch (err) {
			return { data: null, error: err instanceof Error ? err.message : String(err) };
		}
	}, [loader, ctx, revision]);

	const refresh = useCallback(() => {
		setRevision((r) => r + 1);
	}, []);

	return { data, loading: false, error, refresh };
}
