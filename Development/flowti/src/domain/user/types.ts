import { z } from "zod";
import type { UUID } from "../../utils/types";

/**
 * UUID validation regex pattern for v4 UUIDs.
 */
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Zod schema for UUID validation.
 * Uses transform to cast the validated string to the branded UUID type.
 */
export const UUIDSchema = z
	.string()
	.regex(UUID_REGEX, "Invalid UUID format")
	.transform((val) => val as UUID);

/**
 * Zod schema for FlowtiUser validation.
 */
export const FlowtiUserSchema = z.object({
	id: UUIDSchema,
	name: z.string().min(1, "Name cannot be empty"),
	createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, "Invalid ISO date format"),
});

/**
 * Represents a user in the Flowti system.
 * Users are stored locally within the vault.
 */
export type FlowtiUser = z.infer<typeof FlowtiUserSchema>;

/**
 * Interface for user management operations.
 */
export interface IUserService {
	load(): Promise<void>;
	hasUser(): boolean;
	getUser(): FlowtiUser | null;
	createUser(name: string): Promise<FlowtiUser>;
	updateUserName(name: string): Promise<void>;
}
