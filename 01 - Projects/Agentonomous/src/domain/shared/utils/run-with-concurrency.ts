export async function runWithConcurrency(
	tasks: readonly (() => void | Promise<void>)[],
	limit: number,
): Promise<void> {
	if (!Number.isFinite(limit)) {
		await Promise.all(tasks.map((t) => t()));
		return;
	}
	let index = 0;
	async function next(): Promise<void> {
		while (index < tasks.length) {
			const i = index++;
			await tasks[i]?.();
		}
	}
	await Promise.all(
		Array.from({ length: Math.min(limit, tasks.length) }, () => next()),
	);
}
