import type {
	IInstallerStep,
	InstallerContext,
	InstallerStepDeps,
	InstallerStepResult,
} from "../types";

/**
 * Installation step that creates the user profile.
 * Delegates to {@link InstallerStepDeps.userService} — does not duplicate user logic.
 * Idempotent: skips if a user already exists.
 */
export class UserCreationStep implements IInstallerStep {
	readonly id = "user-creation";
	readonly name = "Create User Profile";
	readonly description = "Creates your user profile for the Flowti system";
	readonly intro =
		"Your user profile is the identity Flowti uses to track your contributions, " +
		"daily notes, and activity across the vault. It is stored locally and never " +
		"leaves your machine.";
	readonly order = 10;

	async execute(
		context: InstallerContext,
		deps: InstallerStepDeps,
	): Promise<InstallerStepResult> {
		if (deps.userService.hasUser()) {
			context.user = deps.userService.getUser()!;
			return { status: "skipped", message: "User already exists" };
		}

		if (!context.userName?.trim()) {
			return { status: "failed", message: "User name is required" };
		}

		const user = await deps.userService.createUser(context.userName);
		context.user = user;
		return { status: "completed", message: `User "${user.name}" created` };
	}
}
