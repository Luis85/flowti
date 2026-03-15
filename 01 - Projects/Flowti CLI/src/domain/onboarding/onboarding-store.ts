import type { OnboardingStoreDeps, TourProgress } from "./onboarding-types.js";

const PROGRESS_FILE = "onboarding-progress.json";
const VAR_DIR = ".flowti/var";

export function createInitialProgress(
	tourId: string,
	deps: Pick<OnboardingStoreDeps, "clock">,
): TourProgress {
	return {
		tourId,
		currentStepIndex: 0,
		completedSteps: [],
		context: {},
		startedAt: deps.clock.iso(),
	};
}

export function readProgress(
	vaultRoot: string,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): TourProgress | null {
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	if (!deps.disk.existsSync(filePath)) return null;
	const content = deps.disk.readFileSync(filePath, "utf-8");
	return JSON.parse(content) as TourProgress;
}

export function writeProgress(
	vaultRoot: string,
	progress: TourProgress,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): void {
	const dir = deps.paths.join(vaultRoot, VAR_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	deps.disk.writeFileSync(filePath, JSON.stringify(progress, null, "\t"), "utf-8");
}

export function resetProgress(
	vaultRoot: string,
	deps: Pick<OnboardingStoreDeps, "disk" | "paths">,
): void {
	const filePath = deps.paths.join(vaultRoot, VAR_DIR, PROGRESS_FILE);
	if (deps.disk.existsSync(filePath)) {
		deps.disk.unlinkSync(filePath);
	}
}
