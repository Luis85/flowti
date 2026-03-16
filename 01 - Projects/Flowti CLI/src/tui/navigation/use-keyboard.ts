/**
 * use-keyboard.ts — Keyboard handler for activity bar section navigation.
 *
 * Only active when the activity bar focus zone is active (enabled=true).
 * Handles: ↑↓ to move between sections, Enter to open/select section.
 * Escape is NOT handled here — it is handled exclusively in App.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly onSectionOpen?: (sectionId: string) => void;
	readonly enabled: boolean;
}

export function useKeyboard({ sections, activeSection, onSectionChange, onSectionOpen, enabled }: UseKeyboardOptions): void {
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
		if (key.return) {
			if (onSectionOpen) {
				onSectionOpen(activeSection);
			} else {
				onSectionChange(activeSection);
			}
		}
	});
}
