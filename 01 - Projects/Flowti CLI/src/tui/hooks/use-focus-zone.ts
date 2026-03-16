/**
 * use-focus-zone.ts — Focus management for the TUI shell.
 *
 * Tab cycles between zones. Components check the active zone
 * to decide whether they should consume keyboard input.
 */

import { useState, useCallback } from "react";
import type { FocusZone } from "../types.js";

interface UseFocusZoneResult {
	readonly active: FocusZone;
	readonly next: () => void;
	readonly prev: () => void;
	readonly setActive: (zone: FocusZone) => void;
}

export function useFocusZone(zones: readonly FocusZone[]): UseFocusZoneResult {
	const [active, setActive] = useState<FocusZone>(zones[1] ?? zones[0]);

	const next = useCallback(() => {
		setActive((current) => {
			const idx = zones.indexOf(current);
			return zones[(idx + 1) % zones.length];
		});
	}, [zones]);

	const prev = useCallback(() => {
		setActive((current) => {
			const idx = zones.indexOf(current);
			return zones[(idx - 1 + zones.length) % zones.length];
		});
	}, [zones]);

	return { active, next, prev, setActive };
}
