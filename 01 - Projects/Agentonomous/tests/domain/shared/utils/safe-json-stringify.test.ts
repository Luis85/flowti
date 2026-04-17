import { describe, expect, it } from 'vitest';
import { safeJsonStringify } from '../../../../src/domain/shared/utils/safe-json-stringify.js';

describe('safeJsonStringify', () => {
	it('stringifies plain objects', () => {
		expect(safeJsonStringify({ a: 1, b: 'x' })).toBe('{\n  "a": 1,\n  "b": "x"\n}');
	});

	it('returns "undefined" for undefined input', () => {
		expect(safeJsonStringify(undefined)).toBe('undefined');
	});

	it('handles null', () => {
		expect(safeJsonStringify(null)).toBe('null');
	});

	it('replaces circular references', () => {
		const a: Record<string, unknown> = { name: 'root' };
		a['self'] = a;
		const result = safeJsonStringify(a);
		expect(result).toContain('[Circular]');
		expect(result).toContain('"name": "root"');
	});

	it('serializes bigint with n suffix', () => {
		expect(safeJsonStringify({ n: 10n })).toContain('"10n"');
	});

	it('serializes functions as placeholder', () => {
		const named = function myFn(): void {};
		expect(safeJsonStringify({ fn: named })).toContain('[Function: myFn]');
		expect(safeJsonStringify({ fn: (): void => {} })).toContain('[Function');
	});

	it('serializes symbols as string', () => {
		const result = safeJsonStringify({ s: Symbol('id') });
		expect(result).toContain('Symbol(id)');
	});

	it('respects indent argument', () => {
		expect(safeJsonStringify({ a: 1 }, 0)).toBe('{"a":1}');
	});
});
