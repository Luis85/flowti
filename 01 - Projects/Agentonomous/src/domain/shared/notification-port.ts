/**
 * User-facing toast notifications.
 *
 * Severity methods map to different visual treatments (color, duration).
 * Use `info` for non-urgent status, `success` after a user-initiated
 * action succeeds, `warn` for recoverable problems the user should know
 * about, and `error` for failures.
 *
 * `show()` is kept as an alias for `info()` to preserve the old API
 * while callers migrate.
 */
export interface NotificationPort {
	info(message: string, opts?: NotificationOptions): void;
	success(message: string, opts?: NotificationOptions): void;
	warn(message: string, opts?: NotificationOptions): void;
	error(message: string, opts?: NotificationOptions): void;
	/** @deprecated Use `info(message)`. */
	show(message: string, opts?: NotificationOptions): void;
}

export type NotificationOptions = {
	/** How long the toast stays, in ms.  Default depends on severity. */
	readonly durationMs?: number;
};
