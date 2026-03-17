import { ValidationError } from "../../infrastructure/errors/FlowtiError";
import type { IEventBus } from "../../infrastructure/events/types";
import { generateUUID } from "../../utils/helpers";
import type { ITypedStorage } from "../../utils/TypedStorage";
import type { FlowtiUser, IUserService } from "./types";

/**
 * Configuration options for the UserService.
 */
export interface UserServiceOptions {
	storage: ITypedStorage<FlowtiUser>;
	eventBus?: IEventBus;
}

/**
 * Service for managing user data within the Flowti plugin.
 * Handles user creation, retrieval, persistence, and emits events on changes.
 */
export class UserService implements IUserService {
	private user: FlowtiUser | null = null;
	private storage: ITypedStorage<FlowtiUser>;
	private eventBus?: IEventBus;

	/**
	 * Creates a new UserService instance.
	 * @param options - Configuration options including storage and optional event bus
	 */
	constructor(options: UserServiceOptions) {
		this.storage = options.storage;
		this.eventBus = options.eventBus;
	}

	/**
	 * Loads user data from storage.
	 * Emits "user.loaded" event if user data is found.
	 * Should be called during plugin initialization.
	 */
	async load(): Promise<void> {
		const saved = await this.storage.load();
		if (saved) {
			this.user = saved;
			await this.eventBus?.emit("user.loaded", { user: this.user });
		}
	}

	/**
	 * Checks if a user has been set up.
	 * @returns true if a user exists, false otherwise
	 */
	hasUser(): boolean {
		return this.user !== null;
	}

	/**
	 * Gets the current user.
	 * @returns The current user or null if not set up
	 */
	getUser(): FlowtiUser | null {
		return this.user;
	}

	/**
	 * Creates a new user with the given name.
	 * Emits "user.created" event after successful creation.
	 * @param name - The display name for the user
	 * @param role - Optional role identifier (e.g. "user", "supplier-manager")
	 * @returns The newly created user
	 */
	async createUser(name: string, role?: string): Promise<FlowtiUser> {
		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new ValidationError({
				code: "INVALID_USER_NAME",
				message: "User name cannot be empty",
				severity: "medium",
				context: "UserService.createUser",
			});
		}

		const newUser: FlowtiUser = {
			id: generateUUID(),
			name: trimmedName,
			createdAt: new Date().toISOString(),
			...(role ? { role } : {}),
		};

		this.user = newUser;
		await this.saveUser();
		await this.eventBus?.emit("user.created", { user: newUser });
		return newUser;
	}

	/**
	 * Updates the current user's name.
	 * Emits "user.updated" event after successful update.
	 * @param name - The new display name
	 */
	async updateUserName(name: string): Promise<void> {
		if (!this.user) {
			throw new ValidationError({
				code: "NO_USER_EXISTS",
				message: "No user exists to update",
				severity: "medium",
				context: "UserService.updateUserName",
			});
		}

		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new ValidationError({
				code: "INVALID_USER_NAME",
				message: "User name cannot be empty",
				severity: "medium",
				context: "UserService.updateUserName",
			});
		}

		this.user.name = trimmedName;
		await this.saveUser();
		await this.eventBus?.emit("user.updated", { user: this.user });
	}

	/**
	 * Releases resources. UserService is emitter-only (no listeners)
	 * so this is a no-op, provided for lifecycle consistency.
	 */
	dispose(): void {
		// No listeners to clean up — emitter-only service
	}

	/**
	 * Persists the current user to storage.
	 */
	private async saveUser(): Promise<void> {
		await this.storage.save(this.user!);
	}
}
