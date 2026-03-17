import type { FlowtiUser } from "./types";

/**
 * Event types owned by the User domain.
 */
export interface UserEventMap {
	/** Emitted when a new user is created */
	"user.created": { user: FlowtiUser };
	/** Emitted when user data is updated */
	"user.updated": { user: FlowtiUser };
	/** Emitted when user data is loaded from storage */
	"user.loaded": { user: FlowtiUser };
}
