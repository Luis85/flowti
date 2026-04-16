import { describe, expect, it } from 'vitest';
import { runWithConcurrency } from '../../../../src/domain/shared/utils/run-with-concurrency.js';

describe('runWithConcurrency', () => {
	it('runs all tasks when limit is Infinity', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3].map((n) => () => { results.push(n); });
		await runWithConcurrency(tasks, Infinity);
		expect(results).toEqual([1, 2, 3]);
	});

	it('limits concurrent execution', async () => {
		let concurrent = 0;
		let maxConcurrent = 0;
		const tasks = Array.from({ length: 5 }, () => async () => {
			concurrent++;
			maxConcurrent = Math.max(maxConcurrent, concurrent);
			await new Promise((r) => { setTimeout(r, 10); });
			concurrent--;
		});
		await runWithConcurrency(tasks, 2);
		expect(maxConcurrent).toBe(2);
	});

	it('completes all tasks even with limit', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3, 4, 5].map((n) => async () => {
			await new Promise((r) => { setTimeout(r, 5); });
			results.push(n);
		});
		await runWithConcurrency(tasks, 2);
		expect(results).toHaveLength(5);
	});

	it('handles sync tasks in the pool', async () => {
		const results: number[] = [];
		const tasks = [1, 2, 3].map((n) => () => { results.push(n); });
		await runWithConcurrency(tasks, 1);
		expect(results).toEqual([1, 2, 3]);
	});

	it('handles empty task list', async () => {
		await runWithConcurrency([], 2);
	});
});
