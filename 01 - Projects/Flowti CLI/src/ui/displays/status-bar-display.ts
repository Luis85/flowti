import { RESET, DIM, YELLOW, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { PendingQuestion } from "../../infrastructure/types.js";

export function renderStatusBar(questions: PendingQuestion[], log: (msg?: string) => void): void {
	if (questions.length === 0) return;
	const oldest = questions[0];
	const who = oldest.persona ?? oldest.agentName;
	const preview = oldest.question.length > 60 ? oldest.question.slice(0, 57) + "..." : oldest.question;
	const badge = questions.length > 1 ? `${YELLOW}${questions.length} agents waiting${RESET} — ` : "";
	log(`  ${YELLOW}⚡${RESET} ${badge}${CYAN}${BOLD}${who}${RESET}${DIM}: ${preview}  ${YELLOW}[! to respond]${RESET}`);
}
