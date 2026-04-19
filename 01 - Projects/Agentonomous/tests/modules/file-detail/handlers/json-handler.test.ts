import { describe, expect, it } from 'vitest';
import { jsonHandler } from '../../../../src/modules/file-detail/handlers/json-handler.js';

describe('jsonHandler', () => {
	it('detects object type and key count', () => {
		const result = jsonHandler.analyze('{"a":1,"b":2}', 'data.json');
		expect(result.summary['Type']).toBe('object');
		expect(result.summary['Key count']).toBe(2);
	});

	it('detects array type and item count', () => {
		const result = jsonHandler.analyze('[1,2,3]', 'data.json');
		expect(result.summary['Type']).toBe('array');
		expect(result.summary['Item count']).toBe(3);
	});

	it('calculates max nesting depth', () => {
		const result = jsonHandler.analyze('{"a":{"b":{"c":1}}}', 'deep.json');
		expect(result.summary['Depth']).toBe(3);
	});

	it('handles invalid JSON gracefully', () => {
		const result = jsonHandler.analyze('not json', 'bad.json');
		expect(result.summary['Type']).toBe('invalid');
	});

	it('handles primitive type', () => {
		const result = jsonHandler.analyze('"hello"', 'str.json');
		expect(result.summary['Type']).toBe('string');
	});

	it('reports depth 1 for an empty object (the container itself is one level)', () => {
		const result = jsonHandler.analyze('{}', 'empty.json');
		expect(result.summary['Depth']).toBe(1);
	});

	it('reports depth 1 for an empty array (the container itself is one level)', () => {
		const result = jsonHandler.analyze('[]', 'empty.json');
		expect(result.summary['Depth']).toBe(1);
	});

	it('reports depth 0 for a bare primitive', () => {
		const result = jsonHandler.analyze('42', 'num.json');
		expect(result.summary['Depth']).toBe(0);
	});

	it('reports the same depth for a leaf primitive and a leaf empty container at the same nesting', () => {
		const primitive = jsonHandler.analyze('{"a":{"b":1}}', 'a.json');
		const empty = jsonHandler.analyze('{"a":{"b":{}}}', 'a.json');
		expect(primitive.summary['Depth']).toBe(2);
		expect(empty.summary['Depth']).toBe(3); // {} at depth 2 contributes one more level
	});

	it('takes the max across siblings when depths differ', () => {
		const result = jsonHandler.analyze('{"a":1,"b":{"c":{"d":1}}}', 'mixed.json');
		expect(result.summary['Depth']).toBe(3);
	});
});
