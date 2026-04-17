/**
 * JSON.stringify that never throws.  Handles circular references by replacing
 * them with '[Circular]', and returns a stable fallback for values JSON.stringify
 * cannot represent (functions, symbols, BigInts).
 */
export function safeJsonStringify(value: unknown, indent = 2): string {
	if (value === undefined) return 'undefined';
	const seen = new WeakSet<object>();
	const replacer = (_: string, v: unknown): unknown => {
		if (typeof v === 'bigint') return `${v.toString()}n`;
		if (typeof v === 'function') return `[Function${v.name.length > 0 ? `: ${v.name}` : ''}]`;
		if (typeof v === 'symbol') return v.toString();
		if (typeof v === 'object' && v !== null) {
			if (seen.has(v)) return '[Circular]';
			seen.add(v);
		}
		return v;
	};
	return JSON.stringify(value, replacer, indent);
}
