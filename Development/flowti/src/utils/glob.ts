/**
 * Lightweight glob pattern matching.
 *
 * Supports:
 * - `*` matches any characters except `/`
 * - `**` matches any characters including `/`
 * - `?` matches a single character
 *
 * No external dependencies needed.
 */
export function matchGlob(pattern: string, value: string): boolean {
	const regexStr = pattern
		// Escape regex special chars except * and ?
		.replace(/[.+^${}()|[\]\\]/g, "\\$&")
		// **/ at the start or middle means "any path prefix including none"
		.replace(/\*\*\//g, "\0GLOBSTAR_SEP\0")
		// ** at the end means "everything remaining"
		.replace(/\*\*/g, "\0GLOBSTAR\0")
		// * matches within a single path segment
		.replace(/\*/g, "[^/]*")
		// ? matches a single character
		.replace(/\?/g, ".")
		// Restore globstar with separator: optional prefix
		.replace(/\0GLOBSTAR_SEP\0/g, "(.+/)?")
		// Restore trailing globstar: match everything
		.replace(/\0GLOBSTAR\0/g, ".*");

	const regex = new RegExp(`^${regexStr}$`);
	return regex.test(value);
}
