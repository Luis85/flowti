import type { OnboardingDetectionDeps } from "./onboarding-types.js";

const FLAG_FILE = "onboarding-complete";
const FLOWTI_DIR = ".flowti";

export function shouldOnboard(
	vaultRoot: string,
	projectsDir: string,
	deps: OnboardingDetectionDeps,
): boolean {
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	if (deps.disk.existsSync(flagPath)) return false;

	try {
		const entries = deps.disk.readdirSync(projectsDir, { withFileTypes: true });
		const projects = entries.filter((e: { isDirectory: () => boolean }) => e.isDirectory());
		return projects.length === 0;
	} catch {
		return true;
	}
}

export function markOnboardingComplete(
	vaultRoot: string,
	deps: OnboardingDetectionDeps,
): void {
	const dir = deps.paths.join(vaultRoot, FLOWTI_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	deps.disk.writeFileSync(flagPath, new Date().toISOString(), "utf-8");
}

export function resetOnboarding(
	vaultRoot: string,
	deps: OnboardingDetectionDeps,
): void {
	const flagPath = deps.paths.join(vaultRoot, FLOWTI_DIR, FLAG_FILE);
	if (deps.disk.existsSync(flagPath)) {
		deps.disk.unlinkSync(flagPath);
	}
}
