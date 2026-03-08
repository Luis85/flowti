/**
 * e2e-helpers.ts — Shared formatting helpers for E2E modules.
 */

/** YAML-safe string escaping. */
export function yamlStr(value: string): string {
	if (/[:\n\r\t#'"{}[\],&*?]|^\s|\s$/.test(value)) return JSON.stringify(value);
	return value;
}
