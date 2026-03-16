/**
 * onboarding-loader.ts — Onboarding prerequisite check loader.
 *
 * Checks system prerequisites via the onboarding domain service.
 */

import type { LoaderContext } from "./loader-types.js";
import { checkPrerequisiteIssues } from "../../domain/onboarding/onboarding.js";

export interface OnboardingIssue {
	readonly tool: string;
	readonly message: string;
	readonly severity: string;
}

export interface OnboardingData {
	readonly issues: readonly OnboardingIssue[];
}

export function loadOnboarding(ctx: LoaderContext): OnboardingData {
	try {
		const raw = checkPrerequisiteIssues(16, ctx.deps);
		return {
			issues: raw.map((issue) => ({
				tool: issue.name,
				message: issue.instruction,
				severity: "error",
			})),
		};
	} catch { return { issues: [] }; }
}
