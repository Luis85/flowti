import { generateUUID } from "../utils/helpers";
import type { IStorageProvider } from "../utils/types";
import type { FlowtiUser, IUserService } from "./types";

/**
 * Service for managing user data within the Flowti plugin.
 * Handles user creation, retrieval, and persistence.
 */
export class UserService implements IUserService {
	private user: FlowtiUser | null = null;
	private storage: IStorageProvider;

	/**
	 * Creates a new UserService instance.
	 * @param storage - Storage provider for persistence
	 */
	constructor(storage: IStorageProvider) {
		this.storage = storage;
	}

	/**
	 * Loads user data from storage.
	 * Should be called during plugin initialization.
	 */
	async load(): Promise<void> {
		const data = (await this.storage.load()) as { user?: FlowtiUser } | null;
		if (data?.user) {
			this.user = data.user;
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
	 * @param name - The display name for the user
	 * @returns The newly created user
	 */
	async createUser(name: string): Promise<FlowtiUser> {
		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new Error("User name cannot be empty");
		}

		const newUser: FlowtiUser = {
			id: generateUUID(),
			name: trimmedName,
			createdAt: new Date().toISOString(),
		};

		this.user = newUser;
		await this.saveUser();
		return newUser;
	}

	/**
	 * Updates the current user's name.
	 * @param name - The new display name
	 */
	async updateUserName(name: string): Promise<void> {
		if (!this.user) {
			throw new Error("No user exists to update");
		}

		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new Error("User name cannot be empty");
		}

		this.user.name = trimmedName;
		await this.saveUser();
	}

	/**
	 * Persists the current user to storage.
	 */
	private async saveUser(): Promise<void> {
		const existingData = ((await this.storage.load()) as object) || {};
		await this.storage.save({
			...existingData,
			user: this.user,
		});
	}
}
