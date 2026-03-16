/**
 * use-keyboard.ts — Keyboard handler for activity bar section navigation.
 *
 * Only active when the activity bar focus zone is active.
 * Escape is NOT handled here — it is handled exclusively in App.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly enabled: boolean;
}

export function useKeyboard({ sections, activeSection, onSectionChange, enabled }: UseKeyboardOptions): void {
	useInput((_input, key) => {
		if (!enabled) return;
		if (key.upArrow) {
			const idx = sections.findIndex((s) => s.id === activeSection);
			if (idx > 0) {
				onSectionChange(sections[idx - 1].id);
			}
		}
		if (key.downArrow) {
			const idx = sections.findIndex((s) => s.id === activeSection);
			if (idx < sections.length - 1) {
				onSectionChange(sections[idx + 1].id);
			}
		}
	});
}
