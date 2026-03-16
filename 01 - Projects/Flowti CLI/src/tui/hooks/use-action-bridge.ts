/**
 * use-action-bridge.ts — Hook that provides executeAction to page components.
 *
 * Wraps action-map dispatch with error handling.
 * ContentArea uses this to build the onAction callback passed to pages.
 */

import { useCallback } from "react";
import { executeAction as dispatch } from "./action-map.js";

interface UseActionBridgeResult {
	readonly executeAction: (actionId: string, params?: Record<string, string>) => Promise<void>;
}

export function useActionBridge(): UseActionBridgeResult {
	const executeAction = useCallback(async (actionId: string, params?: Record<string, string>) => {
		await dispatch(actionId, { actionId, params: params ?? {} });
	}, []);

	return { executeAction };
}
