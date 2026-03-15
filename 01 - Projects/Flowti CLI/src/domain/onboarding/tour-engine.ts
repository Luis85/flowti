import type {
	TourStep,
	TourProgress,
	StepResult,
	StepFrontmatter,
	NarrateStep,
	PromptStep,
	DelegateStep,
	AutoStep,
	CheckpointStep,
} from "./onboarding-types.js";

export function resolveTemplate(
	content: string,
	context: Readonly<Record<string, string>>,
): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
		return key in context ? context[key] : match;
	});
}

export function parseStepFrontmatter(
	raw: string,
): { frontmatter: Partial<StepFrontmatter>; body: string } {
	const match = raw.match(/^---\n([\s\S]*?)\n---\n\n?([\s\S]*)$/);
	if (!match) return { frontmatter: {}, body: raw };

	const fm: Partial<StepFrontmatter> = {};
	for (const line of match[1].split("\n")) {
		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (kv) {
			const key = kv[1] as keyof StepFrontmatter;
			if (key === "speaker" || key === "disposition") {
				(fm as Record<string, string>)[key] = kv[2];
			}
		}
	}
	return { frontmatter: fm, body: match[2] };
}

function processNarrate(step: NarrateStep, progress: TourProgress, rawContent: string): StepResult {
	const { frontmatter, body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "narrate",
		content,
		speaker: frontmatter.speaker ?? "Alice",
		disposition: frontmatter.disposition ?? "strategic",
	};
}

function processPrompt(step: PromptStep, _progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	return {
		kind: "prompt",
		content: body,
		field: step.field,
		validation: step.validation,
	};
}

function processDelegate(
	step: DelegateStep,
	progress: TourProgress,
	_rawContent: string,
	hintsContent?: string,
): StepResult {
	return {
		kind: "delegate",
		target: step.target,
		tourId: progress.tourId,
		stepId: step.id,
		hintsContent: hintsContent ? resolveTemplate(hintsContent, progress.context) : undefined,
	};
}

function processAuto(step: AutoStep, progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "auto",
		action: step.action,
		content,
		context: progress.context,
	};
}

function processCheckpoint(step: CheckpointStep, progress: TourProgress, rawContent: string): StepResult {
	const { body } = parseStepFrontmatter(rawContent);
	const content = resolveTemplate(body, progress.context);
	return {
		kind: "checkpoint",
		label: step.label,
		content,
		completedSteps: [...progress.completedSteps, step.id],
	};
}

export function processStep(
	step: TourStep,
	progress: TourProgress,
	rawContent: string,
	hintsContent?: string,
): StepResult {
	switch (step.type) {
		case "narrate": return processNarrate(step, progress, rawContent);
		case "prompt": return processPrompt(step, progress, rawContent);
		case "delegate": return processDelegate(step, progress, rawContent, hintsContent);
		case "auto": return processAuto(step, progress, rawContent);
		case "checkpoint": return processCheckpoint(step, progress, rawContent);
	}
}

export function advanceProgress(
	progress: TourProgress,
	stepId: string,
	newContext?: Readonly<Record<string, string>>,
): TourProgress {
	return {
		...progress,
		currentStepIndex: progress.currentStepIndex + 1,
		completedSteps: [...progress.completedSteps, stepId],
		context: { ...progress.context, ...newContext },
	};
}
