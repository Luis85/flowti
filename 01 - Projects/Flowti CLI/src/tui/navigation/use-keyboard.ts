/**
 * use-keyboard.ts — Global keyboard handler for activity bar section navigation.
 *
 * When the activity bar has focus, arrow up/down cycles through sections.
 */

import { useInput } from "ink";
import type { Section } from "../types.js";

interface UseKeyboardOptions {
	readonly sections: readonly Section[];
	readonly activeSection: string;
	readonly onSectionChange: (sectionId: string) => void;
	readonly onBack: () => void;
}

export function useKeyboard({ sections, activeSection, onSectionChange, onBack }: UseKeyboardOptions): void {
	useInput((_input, key) => {
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
		if (key.escape) {
			onBack();
		}
	});
}
